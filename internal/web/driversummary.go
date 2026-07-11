package web

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

// --- /api/v1/driver/summary ---
// Per-driver season summary: championship standing plus per-round race results,
// aggregated server-side from the same sources as the championship hub. Caching
// relies on the OpenF1 client's HTTP cache TTLs — no extra layer here.

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

	champ, err := s.client.GetDriverChampionshipForYear(year)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	var entry *models.ChampionshipDriver
	for i := range champ {
		if champ[i].DriverNumber == driverNumber {
			entry = &champ[i]
			break
		}
	}
	if entry == nil {
		http.Error(w, fmt.Sprintf("driver %d not found in %d championship", driverNumber, year), http.StatusNotFound)
		return
	}

	driverInfo := map[int]models.Driver{}
	if ds, derr := s.client.GetDriversForSession(champ[0].SessionKey); derr == nil {
		driverInfo = buildDriverMapFirst(ds)
	}
	if d, ok := s.championshipDriverInfo(entry.SessionKey, driverNumber, driverInfo); ok {
		driverInfo[driverNumber] = d
	}

	races, _, err := s.fetchSeasonRaces(year)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}

	resp, ok := aggregateDriverSummary(year, driverNumber, races, champ, driverInfo)
	if !ok {
		http.Error(w, fmt.Sprintf("driver %d not found in %d championship", driverNumber, year), http.StatusNotFound)
		return
	}
	writeJSON(w, resp)
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
