package web

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

// --- /api/v1/driver/summary ---
// Per-driver season summary: championship standing plus per-round race results.
// Current-season identity/results are local-first from the domain DB. Optional
// OpenF1 enrichment (headshot / polished identity) is bounded so it cannot hang
// the profile when remote data is slow or unavailable.

// driverEnrichmentTimeout bounds optional remote enrichment so a hung OpenF1
// call never blocks a local-first profile response. Overridable in tests.
var driverEnrichmentTimeout = 2 * time.Second

type driverSummaryRound struct {
	MeetingKey  int    `json:"meeting_key"`
	MeetingName string `json:"meeting_name"`
	CountryCode string `json:"country_code"`
	CountryName string `json:"country_name"`
	// RacePosition and GridPosition are 0 when the driver has no entry for the
	// round (did not enter, or data missing).
	RacePosition int `json:"race_position"`
	GridPosition int `json:"grid_position"`
	// QualiPosition is derived from the starting grid in v1 (full qualifying
	// session results are deferred); omitted when unknown.
	QualiPosition int     `json:"quali_position,omitempty"`
	Points        float64 `json:"points"`
	DNF           bool    `json:"dnf"`
	DNS           bool    `json:"dns"`
	DSQ           bool    `json:"dsq"`
}

type driverSummaryResponse struct {
	Season       int                  `json:"season"`
	DriverNumber int                  `json:"driver_number"`
	NameAcronym  string               `json:"name_acronym"`
	FullName     string               `json:"full_name"`
	TeamName     string               `json:"team_name"`
	TeamColour   string               `json:"team_colour"`
	HeadshotURL  string               `json:"headshot_url"`
	Points       float64              `json:"points"`
	Position     int                  `json:"position"`
	Wins         int                  `json:"wins"`
	Podiums      int                  `json:"podiums"`
	Poles        int                  `json:"poles"`
	Form         []float64            `json:"form"`
	Cumulative   []float64            `json:"cumulative"`
	RoundLabels  []string             `json:"round_labels"`
	Rounds       []driverSummaryRound `json:"rounds"`
	// Source is "local" when served from the domain DB, else "openf1".
	Source string `json:"source,omitempty"`
	// Enrichment is "full" when optional remote identity landed, "limited"
	// when it timed out/failed, or "none" when no enrichment was attempted.
	Enrichment string `json:"enrichment,omitempty"`
}

func (s *Server) handleDriverSummary(w http.ResponseWriter, r *http.Request) {
	driverNumber, err := strconv.Atoi(r.URL.Query().Get("driver_number"))
	if err != nil || driverNumber <= 0 {
		http.Error(w, "driver_number required", http.StatusBadRequest)
		return
	}
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if year == 0 {
		year = time.Now().Year()
	}
	mode := parseSourceMode(r)
	// Driver summary is local-first for current-season identity/results. When the
	// caller omits ?source=, prefer auto (local then OpenF1) rather than the
	// package default of openf1-only.
	if r.URL.Query().Get("source") == "" {
		mode = sourceAuto
	}

	if mode == sourceLocal || mode == sourceAuto {
		resp, sessionKey, ok, lerr := s.localDriverSummary(year, driverNumber)
		if lerr != nil {
			writeError(w, lerr, http.StatusInternalServerError, false)
			return
		}
		if ok {
			if mode != sourceLocal {
				s.tryEnrichDriverSummary(&resp, sessionKey)
			}
			writeJSON(w, resp)
			return
		}
		if mode == sourceLocal {
			http.Error(w, fmt.Sprintf("driver %d not found in %d championship", driverNumber, year), http.StatusNotFound)
			return
		}
	}

	resp, err := s.openF1DriverSummary(year, driverNumber)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	if resp == nil {
		http.Error(w, fmt.Sprintf("driver %d not found in %d championship", driverNumber, year), http.StatusNotFound)
		return
	}
	writeJSON(w, resp)
}

func (s *Server) localDriverSummary(year, driverNumber int) (driverSummaryResponse, int, bool, error) {
	if !s.hasLocalQuery() {
		return driverSummaryResponse{}, 0, false, nil
	}
	inputs, err := s.query.GetChampionshipInputs(year)
	if err != nil {
		return driverSummaryResponse{}, 0, false, err
	}
	if len(inputs.Champ) == 0 {
		return driverSummaryResponse{}, 0, false, nil
	}

	races := make([]meetingRace, 0, len(inputs.Races))
	for _, race := range inputs.Races {
		races = append(races, meetingRace{
			Meeting:        race.Meeting,
			RaceSessionKey: race.RaceSessionKey,
			Results:        race.Results,
			Grid:           race.Grid,
		})
	}

	resp, ok := aggregateDriverSummary(year, driverNumber, races, inputs.Champ, inputs.DriverMap)
	if !ok {
		return driverSummaryResponse{}, 0, false, nil
	}
	resp.Source = "local"
	resp.Enrichment = "none"

	sessionKey := 0
	for _, c := range inputs.Champ {
		if c.DriverNumber == driverNumber && c.SessionKey > 0 {
			sessionKey = c.SessionKey
			break
		}
		if sessionKey == 0 && c.SessionKey > 0 {
			sessionKey = c.SessionKey
		}
	}
	return resp, sessionKey, true, nil
}

func (s *Server) openF1DriverSummary(year, driverNumber int) (*driverSummaryResponse, error) {
	champ, err := s.client.GetDriverChampionshipForYear(year)
	if err != nil {
		return nil, err
	}
	var entry *models.ChampionshipDriver
	for i := range champ {
		if champ[i].DriverNumber == driverNumber {
			entry = &champ[i]
			break
		}
	}
	if entry == nil {
		return nil, nil
	}

	driverInfo := map[int]models.Driver{}
	sessionKey := champ[0].SessionKey
	if ds, derr := s.client.GetDriversForSession(sessionKey); derr == nil {
		driverInfo = buildDriverMapFirst(ds)
	}
	if d, ok := s.championshipDriverInfo(entry.SessionKey, driverNumber, driverInfo); ok {
		driverInfo[driverNumber] = d
	}

	races, _, err := s.fetchSeasonRaces(year)
	if err != nil {
		return nil, err
	}

	resp, ok := aggregateDriverSummary(year, driverNumber, races, champ, driverInfo)
	if !ok {
		return nil, nil
	}
	resp.Source = "openf1"
	resp.Enrichment = "full"
	return &resp, nil
}

// tryEnrichDriverSummary optionally fills headshot / polished identity from
// OpenF1. It never blocks longer than driverEnrichmentTimeout — on timeout or
// failure the local profile remains intact with enrichment=limited.
func (s *Server) tryEnrichDriverSummary(resp *driverSummaryResponse, sessionKey int) {
	if resp == nil || s.client == nil || sessionKey <= 0 {
		if resp != nil && resp.Enrichment == "none" {
			// No session to enrich from — leave as none (local identity only).
		}
		return
	}

	type enrichResult struct {
		driver models.Driver
		ok     bool
	}

	done := make(chan enrichResult, 1)
	go func() {
		d, ok := s.championshipDriverInfo(sessionKey, resp.DriverNumber, nil)
		done <- enrichResult{driver: d, ok: ok}
	}()

	select {
	case result := <-done:
		if !result.ok {
			resp.Enrichment = "limited"
			return
		}
		applyDriverEnrichment(resp, result.driver)
		resp.Enrichment = "full"
	case <-time.After(driverEnrichmentTimeout):
		resp.Enrichment = "limited"
	}
}

func applyDriverEnrichment(resp *driverSummaryResponse, d models.Driver) {
	if d.HeadshotURL != "" {
		resp.HeadshotURL = d.HeadshotURL
	}
	if d.FullName != "" {
		resp.FullName = d.FullName
	}
	if d.NameAcronym != "" {
		resp.NameAcronym = d.NameAcronym
	}
	if d.TeamName != "" {
		resp.TeamName = d.TeamName
	}
	if d.TeamColour != "" {
		resp.TeamColour = d.TeamColour
	}
}

// aggregateDriverSummary is the pure aggregation core (no network) so it can be
// unit-tested with synthetic data. It reuses the championship-hub aggregation
// for the derived season stats (wins, podiums, poles, form, cumulative) and
// adds the per-round result rows. races must be ordered ascending by date and
// contain only GP meetings. Returns ok=false when the driver is not in champ.
func aggregateDriverSummary(
	year, driverNumber int,
	races []meetingRace,
	champ []models.ChampionshipDriver,
	driverInfo map[int]models.Driver,
) (driverSummaryResponse, bool) {
	hub := aggregateChampionshipHub(year, races, champ, nil, driverInfo)

	var hd *champHubDriver
	for i := range hub.Drivers {
		if hub.Drivers[i].DriverNumber == driverNumber {
			hd = &hub.Drivers[i]
			break
		}
	}
	if hd == nil {
		return driverSummaryResponse{}, false
	}

	rounds := make([]driverSummaryRound, 0, len(races))
	for _, mr := range races {
		if len(mr.Results) == 0 {
			continue // round not completed yet
		}
		round := driverSummaryRound{
			MeetingKey:  int(mr.Meeting.MeetingKey),
			MeetingName: mr.Meeting.MeetingName,
			CountryCode: mr.Meeting.CountryCode,
			CountryName: mr.Meeting.CountryName,
		}
		for _, res := range mr.Results {
			if res.DriverNumber == driverNumber {
				round.RacePosition = res.Position
				round.Points = res.Points
				round.DNF = res.DNF
				round.DNS = res.DNS
				round.DSQ = res.DSQ
				break
			}
		}
		for _, g := range mr.Grid {
			if g.DriverNumber == driverNumber {
				round.GridPosition = g.Position
				round.QualiPosition = g.Position
				break
			}
		}
		rounds = append(rounds, round)
	}

	return driverSummaryResponse{
		Season:       year,
		DriverNumber: hd.DriverNumber,
		NameAcronym:  hd.NameAcronym,
		FullName:     hd.FullName,
		TeamName:     hd.TeamName,
		TeamColour:   hd.TeamColour,
		HeadshotURL:  driverInfo[driverNumber].HeadshotURL,
		Points:       hd.Points,
		Position:     hd.Position,
		Wins:         hd.Wins,
		Podiums:      hd.Podiums,
		Poles:        hd.Poles,
		Form:         hd.Form,
		Cumulative:   hd.Cumulative,
		RoundLabels:  hub.RoundLabels,
		Rounds:       rounds,
	}, true
}
