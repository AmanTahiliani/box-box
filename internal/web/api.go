package web

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	readability "codeberg.org/readeck/go-readability/v2"

	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/query"
)

// writeJSON writes v as JSON with status 200.
func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, err error, status int, stale bool) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"error": err.Error(), "stale": stale})
}

// --- /api/v1/meetings ---

func (s *Server) handleMeetings(w http.ResponseWriter, r *http.Request) {
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if year == 0 {
		year = time.Now().Year()
	}

	switch parseSourceMode(r) {
	case sourceLocal:
		if !s.hasLocalQuery() {
			writeJSON(w, []models.Meeting{})
			return
		}
		meetings, err := s.query.ListMeetingsByYear(year)
		if err != nil {
			writeError(w, err, http.StatusInternalServerError, false)
			return
		}
		writeJSON(w, meetings)
		return
	case sourceAuto:
		if s.hasLocalQuery() {
			meetings, err := s.query.ListMeetingsByYear(year)
			if err != nil {
				writeError(w, err, http.StatusInternalServerError, false)
				return
			}
			if len(meetings) > 0 {
				writeJSON(w, meetings)
				return
			}
		}
	}

	meetings, err := s.client.GetMeetingsForYear(year)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, meetings)
}

// --- /api/v1/sessions ---

func (s *Server) handleSessions(w http.ResponseWriter, r *http.Request) {
	meetingKey, err := strconv.Atoi(r.URL.Query().Get("meeting_key"))
	if err != nil || meetingKey == 0 {
		http.Error(w, "meeting_key required", http.StatusBadRequest)
		return
	}

	switch parseSourceMode(r) {
	case sourceLocal:
		if !s.hasLocalQuery() {
			writeJSON(w, []models.Session{})
			return
		}
		sessions, err := s.query.ListSessionsByMeeting(meetingKey)
		if err != nil {
			writeError(w, err, http.StatusInternalServerError, false)
			return
		}
		writeJSON(w, sessions)
		return
	case sourceAuto:
		if s.hasLocalQuery() {
			sessions, err := s.query.ListSessionsByMeeting(meetingKey)
			if err != nil {
				writeError(w, err, http.StatusInternalServerError, false)
				return
			}
			if len(sessions) > 0 {
				writeJSON(w, sessions)
				return
			}
		}
	}

	sessions, err := s.client.GetSessionsForMeeting(meetingKey)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, sessions)
}

// --- /api/v1/news ---

func (s *Server) handleNews(w http.ResponseWriter, r *http.Request) {
	if !s.hasLocalQuery() {
		writeJSON(w, []query.NewsItem{})
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	source := strings.TrimSpace(r.URL.Query().Get("source"))
	items, err := s.query.ListNews(limit, source)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, false)
		return
	}
	writeJSON(w, items)
}

// --- /api/v1/news/article ---

type articleResponse struct {
	Title    string `json:"title"`
	Byline   string `json:"byline,omitempty"`
	Excerpt  string `json:"excerpt,omitempty"`
	ImageURL string `json:"image_url,omitempty"`
	Content  string `json:"content"`
	SiteName string `json:"site_name,omitempty"`
}

func (s *Server) handleNewsArticle(w http.ResponseWriter, r *http.Request) {
	rawURL := strings.TrimSpace(r.URL.Query().Get("url"))
	if rawURL == "" {
		http.Error(w, "url required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	withCtx := readability.RequestWith(func(req *http.Request) {
		*req = *req.WithContext(ctx)
	})
	article, err := readability.FromURL(rawURL, 20*time.Second, withCtx)
	if err != nil {
		writeError(w, fmt.Errorf("article fetch: %w", err), http.StatusBadGateway, false)
		return
	}

	var buf strings.Builder
	if article.Node != nil {
		if rerr := article.RenderHTML(&buf); rerr != nil {
			writeError(w, rerr, http.StatusInternalServerError, false)
			return
		}
	}

	writeJSON(w, articleResponse{
		Title:    article.Title(),
		Byline:   article.Byline(),
		Excerpt:  article.Excerpt(),
		ImageURL: article.ImageURL(),
		Content:  buf.String(),
		SiteName: article.SiteName(),
	})
}

// --- /api/v1/news/read ---

func (s *Server) handleNewsRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !s.hasLocalQuery() {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var body struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.URL == "" {
		http.Error(w, "url required", http.StatusBadRequest)
		return
	}
	if err := s.query.MarkNewsRead(body.URL); err != nil {
		writeError(w, err, http.StatusInternalServerError, false)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- /api/v1/drivers ---

func (s *Server) handleDrivers(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}

	switch parseSourceMode(r) {
	case sourceLocal:
		if !s.hasLocalQuery() {
			writeJSON(w, []models.Driver{})
			return
		}
		drivers, err := s.query.ListDrivers(sessionKey)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, []models.Driver{})
				return
			}
			writeError(w, err, http.StatusInternalServerError, false)
			return
		}
		writeJSON(w, drivers)
		return
	case sourceAuto:
		if s.hasLocalQuery() {
			drivers, err := s.query.ListDrivers(sessionKey)
			if err == nil && len(drivers) > 0 {
				writeJSON(w, drivers)
				return
			}
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				writeError(w, err, http.StatusInternalServerError, false)
				return
			}
		}
	}

	drivers, err := s.client.GetDriversForSession(sessionKey)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, drivers)
}

// --- /api/v1/results ---

type resultWithDriver struct {
	models.SessionResult
	NameAcronym string `json:"name_acronym"`
	FullName    string `json:"full_name"`
	TeamName    string `json:"team_name"`
	TeamColour  string `json:"team_colour"`
}

func (s *Server) handleResults(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}

	switch parseSourceMode(r) {
	case sourceLocal:
		if !s.hasLocalQuery() {
			writeJSON(w, []resultWithDriver{})
			return
		}
		results, err := s.query.ListResults(sessionKey)
		if err != nil {
			writeError(w, err, http.StatusInternalServerError, false)
			return
		}
		writeJSON(w, enrichedResultsToAPI(results))
		return
	case sourceAuto:
		if s.hasLocalQuery() {
			results, err := s.query.ListResults(sessionKey)
			if err == nil && len(results) > 0 {
				writeJSON(w, enrichedResultsToAPI(results))
				return
			}
			if err != nil {
				writeError(w, err, http.StatusInternalServerError, false)
				return
			}
		}
	}

	var (
		results    []models.SessionResult
		drivers    []models.Driver
		resultsErr error
		wg         sync.WaitGroup
	)
	wg.Add(2)
	go func() { defer wg.Done(); results, resultsErr = s.client.GetSessionResult(sessionKey) }()
	go func() { defer wg.Done(); drivers, _ = s.client.GetDriversForSession(sessionKey) }()
	wg.Wait()

	if resultsErr != nil {
		writeError(w, resultsErr, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}

	driverMap := buildDriverMap(drivers)
	enriched := make([]resultWithDriver, 0, len(results))
	for _, res := range results {
		e := resultWithDriver{SessionResult: res}
		if d, ok := driverMap[res.DriverNumber]; ok {
			e.NameAcronym = d.NameAcronym
			e.FullName = d.FullName
			e.TeamName = d.TeamName
			e.TeamColour = d.TeamColour
		}
		enriched = append(enriched, e)
	}
	writeJSON(w, enriched)
}

// --- /api/v1/grid ---

type gridWithDriver struct {
	models.StartingGrid
	NameAcronym string `json:"name_acronym"`
	FullName    string `json:"full_name"`
	TeamName    string `json:"team_name"`
	TeamColour  string `json:"team_colour"`
}

func (s *Server) handleGrid(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}

	switch parseSourceMode(r) {
	case sourceLocal:
		if !s.hasLocalQuery() {
			writeJSON(w, []gridWithDriver{})
			return
		}
		grid, err := s.query.ListStartingGrid(sessionKey)
		if err != nil {
			writeError(w, err, http.StatusInternalServerError, false)
			return
		}
		writeJSON(w, enrichedGridToAPI(grid))
		return
	case sourceAuto:
		if s.hasLocalQuery() {
			grid, err := s.query.ListStartingGrid(sessionKey)
			if err == nil && len(grid) > 0 {
				writeJSON(w, enrichedGridToAPI(grid))
				return
			}
			if err != nil {
				writeError(w, err, http.StatusInternalServerError, false)
				return
			}
		}
	}

	var (
		grid    []models.StartingGrid
		drivers []models.Driver
		gridErr error
		wg      sync.WaitGroup
	)
	wg.Add(2)
	go func() { defer wg.Done(); grid, gridErr = s.client.GetStartingGrid(sessionKey) }()
	go func() { defer wg.Done(); drivers, _ = s.client.GetDriversForSession(sessionKey) }()
	wg.Wait()

	if gridErr != nil {
		writeError(w, gridErr, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}

	driverMap := buildDriverMap(drivers)
	enriched := make([]gridWithDriver, 0, len(grid))
	for _, g := range grid {
		e := gridWithDriver{StartingGrid: g}
		if d, ok := driverMap[g.DriverNumber]; ok {
			e.NameAcronym = d.NameAcronym
			e.FullName = d.FullName
			e.TeamName = d.TeamName
			e.TeamColour = d.TeamColour
		}
		enriched = append(enriched, e)
	}
	writeJSON(w, enriched)
}

// --- /api/v1/laps ---

func (s *Server) handleLaps(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}

	if dnStr := r.URL.Query().Get("driver_number"); dnStr != "" {
		driverNumber, err := strconv.Atoi(dnStr)
		if err != nil || driverNumber == 0 {
			http.Error(w, "invalid driver_number", http.StatusBadRequest)
			return
		}
		laps, err := s.client.GetLapsForDriver(sessionKey, driverNumber)
		if err != nil {
			writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
			return
		}
		writeJSON(w, laps)
		return
	}

	laps, err := s.client.GetLapsForSession(sessionKey)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, laps)
}

// --- /api/v1/weather ---

func (s *Server) handleWeather(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}
	weather, err := s.client.GetWeather(sessionKey)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, weather)
}

// --- /api/v1/race-control ---

func (s *Server) handleRaceControl(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}
	rc, err := s.client.GetRaceControl(sessionKey)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, rc)
}

// --- /api/v1/telemetry ---

func (s *Server) handleTelemetry(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}
	driverNumber, err := strconv.Atoi(r.URL.Query().Get("driver_number"))
	if err != nil || driverNumber == 0 {
		http.Error(w, "driver_number required", http.StatusBadRequest)
		return
	}
	carData, err := s.client.GetCarData(sessionKey, driverNumber)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, carData)
}

// --- /api/v1/overtakes ---

func (s *Server) handleOvertakes(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}
	overtakes, err := s.client.GetOvertakesForSession(sessionKey)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, overtakes)
}

// --- /api/v1/team-radio ---

func (s *Server) handleTeamRadio(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}
	driverNumber, err := strconv.Atoi(r.URL.Query().Get("driver_number"))
	if err != nil || driverNumber == 0 {
		http.Error(w, "driver_number required", http.StatusBadRequest)
		return
	}
	radios, err := s.client.GetTeamRadio(sessionKey, driverNumber)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, radios)
}

// --- /api/v1/championship/drivers ---

type champDriverWithInfo struct {
	models.ChampionshipDriver
	NameAcronym string `json:"name_acronym"`
	FullName    string `json:"full_name"`
	TeamName    string `json:"team_name"`
	TeamColour  string `json:"team_colour"`
}

func (s *Server) handleChampionshipDrivers(w http.ResponseWriter, r *http.Request) {
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if year == 0 {
		year = time.Now().Year()
	}
	champ, err := s.client.GetDriverChampionshipForYear(year)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	if len(champ) == 0 {
		writeJSON(w, []any{})
		return
	}

	drivers, _ := s.client.GetDriversForSession(champ[0].SessionKey)
	driverMap := buildDriverMapFirst(drivers)

	enriched := make([]champDriverWithInfo, 0, len(champ))
	for _, c := range champ {
		e := champDriverWithInfo{ChampionshipDriver: c}
		d, ok := s.championshipDriverInfo(c.SessionKey, c.DriverNumber, driverMap)
		if ok {
			e.NameAcronym = d.NameAcronym
			e.FullName = d.FullName
			e.TeamName = d.TeamName
			e.TeamColour = d.TeamColour
		}
		enriched = append(enriched, e)
	}
	writeJSON(w, enriched)
}

func (s *Server) championshipDriverInfo(sessionKey, driverNumber int, fallback map[int]models.Driver) (models.Driver, bool) {
	if d, err := s.client.GetDriver(sessionKey, driverNumber); err == nil && d != nil {
		return *d, true
	}
	d, ok := fallback[driverNumber]
	return d, ok
}

// --- /api/v1/championship/teams ---

func (s *Server) handleChampionshipTeams(w http.ResponseWriter, r *http.Request) {
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if year == 0 {
		year = time.Now().Year()
	}
	teams, err := s.client.GetTeamChampionshipForYear(year)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, teams)
}

// --- /api/v1/championship/hub ---
// Aggregated championship view: official points/positions enriched with derived
// stats (wins, podiums, poles, recent form, teammate head-to-head) and a
// per-round cumulative-points series, computed from season race results.

type champHubDriver struct {
	DriverNumber   int       `json:"driver_number"`
	NameAcronym    string    `json:"name_acronym"`
	FullName       string    `json:"full_name"`
	TeamName       string    `json:"team_name"`
	TeamColour     string    `json:"team_colour"`
	Points         float64   `json:"points"`
	Position       int       `json:"position"`
	Wins           int       `json:"wins"`
	Podiums        int       `json:"podiums"`
	Poles          int       `json:"poles"`
	Form           []float64 `json:"form"`            // last 5 races' points
	Cumulative     []float64 `json:"cumulative"`      // running total per completed round
	RoundPositions []int     `json:"round_positions"` // finishing position per completed round (0 = no result)
	TeammateWins   int       `json:"teammate_wins"`
	TeammateLosses int       `json:"teammate_losses"`
}

type champHubTeam struct {
	TeamName   string  `json:"team_name"`
	TeamColour string  `json:"team_colour"`
	Points     float64 `json:"points"`
	Position   int     `json:"position"`
	Wins       int     `json:"wins"`
}

type champHubResponse struct {
	Season      int              `json:"season"`
	Round       int              `json:"round"`
	TotalRounds int              `json:"total_rounds"`
	RoundsLeft  int              `json:"rounds_left"`
	LastRace    string           `json:"last_race"`
	RoundLabels []string         `json:"round_labels"`
	Drivers     []champHubDriver `json:"drivers"`
	Teams       []champHubTeam   `json:"teams"`
}

// meetingRace bundles a GP meeting with its (already-fetched) race results and grid.
type meetingRace struct {
	Meeting        models.Meeting
	RaceSessionKey int
	Results        []models.SessionResult
	Grid           []models.StartingGrid
}

// champHubWorkers bounds the concurrent per-meeting fetches for the hub.
const champHubWorkers = 5

// champHubCurrentTTL / champHubPastTTL control how long an aggregated hub
// response stays cached: short for the in-progress season, long for past
// seasons whose results are final.
const (
	champHubCurrentTTL = 15 * time.Minute
	champHubPastTTL    = 24 * time.Hour
	// champHubIncompleteTTL keeps a partially-fetched aggregate around just
	// long enough to absorb page-load bursts while retrying soon after.
	champHubIncompleteTTL = 2 * time.Minute
)

// champHubTTL returns the in-memory cache TTL for a season's hub response.
func champHubTTL(year int, now time.Time) time.Duration {
	if year >= now.Year() {
		return champHubCurrentTTL
	}
	return champHubPastTTL
}

type champHubEntry struct {
	resp    champHubResponse
	expires time.Time
}

// champHubCache is an in-memory cache of aggregated hub responses keyed by
// year. The zero value is ready to use.
type champHubCache struct {
	mu      sync.Mutex
	entries map[int]champHubEntry
}

func (c *champHubCache) get(year int, now time.Time) (champHubResponse, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[year]
	if !ok || now.After(e.expires) {
		return champHubResponse{}, false
	}
	return e.resp, true
}

func (c *champHubCache) put(year int, resp champHubResponse, now time.Time, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.entries = map[int]champHubEntry{}
	}
	c.entries[year] = champHubEntry{resp: resp, expires: now.Add(ttl)}
}

// fetchMeetingRaces fans fetch out across meetings with bounded concurrency.
// The returned slice preserves the input meeting order regardless of
// completion order; meetings for which fetch reports ok=false are skipped.
func fetchMeetingRaces(meetings []models.Meeting, workers int, fetch func(models.Meeting) (meetingRace, bool)) []meetingRace {
	if workers < 1 {
		workers = 1
	}
	slots := make([]*meetingRace, len(meetings))
	sem := make(chan struct{}, workers)
	var wg sync.WaitGroup
	for i, m := range meetings {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			if mr, ok := fetch(m); ok {
				slots[i] = &mr
			}
		}()
	}
	wg.Wait()

	races := make([]meetingRace, 0, len(meetings))
	for _, mr := range slots {
		if mr != nil {
			races = append(races, *mr)
		}
	}
	return races
}

func (s *Server) handleChampionshipHub(w http.ResponseWriter, r *http.Request) {
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if year == 0 {
		year = time.Now().Year()
	}
	mode := parseSourceMode(r)

	if mode != sourceLocal {
		if resp, ok := s.hubCache.get(year, time.Now()); ok {
			writeJSON(w, resp)
			return
		}
	}

	if mode == sourceLocal || mode == sourceAuto {
		resp, ok, err := s.localChampionshipHub(year)
		if err != nil {
			writeError(w, err, http.StatusInternalServerError, false)
			return
		}
		if ok {
			s.hubCache.put(year, resp, time.Now(), champHubTTL(year, time.Now()))
			writeJSON(w, resp)
			return
		}
		if mode == sourceLocal {
			writeJSON(w, resp)
			return
		}
	}

	resp, err := s.openF1ChampionshipHub(year)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, resp)
}

func (s *Server) localChampionshipHub(year int) (champHubResponse, bool, error) {
	if !s.hasLocalQuery() {
		return champHubResponse{Season: year, RoundLabels: []string{}, Drivers: []champHubDriver{}, Teams: []champHubTeam{}}, false, nil
	}

	inputs, err := s.query.GetChampionshipInputs(year)
	if err != nil {
		return champHubResponse{}, false, err
	}
	if len(inputs.Champ) == 0 {
		return champHubResponse{Season: year, RoundLabels: []string{}, Drivers: []champHubDriver{}, Teams: []champHubTeam{}}, false, nil
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
	return aggregateChampionshipHub(year, races, inputs.Champ, inputs.Teams, inputs.DriverMap), true, nil
}

func (s *Server) openF1ChampionshipHub(year int) (champHubResponse, error) {
	champ, err := s.client.GetDriverChampionshipForYear(year)
	if err != nil {
		return champHubResponse{}, err
	}
	if len(champ) == 0 {
		return champHubResponse{Season: year, RoundLabels: []string{}, Drivers: []champHubDriver{}, Teams: []champHubTeam{}}, nil
	}
	teams, _ := s.client.GetTeamChampionshipForYear(year)

	driverInfo := map[int]models.Driver{}
	if ds, derr := s.client.GetDriversForSession(champ[0].SessionKey); derr == nil {
		driverInfo = buildDriverMapFirst(ds)
	}

	races, incomplete, err := s.fetchSeasonRaces(year)
	if err != nil {
		return champHubResponse{}, err
	}

	resp := aggregateChampionshipHub(year, races, champ, teams, driverInfo)
	ttl := champHubTTL(year, time.Now())
	if incomplete {
		// Any per-meeting fetch failure (network, rate limit) yields an incomplete
		// aggregate: serve it so the page still renders, but cache it only briefly
		// so a partial view of the season doesn't stick around for the full TTL.
		ttl = champHubIncompleteTTL
	}
	s.hubCache.put(year, resp, time.Now(), ttl)
	return resp, nil
}

// fetchSeasonRaces returns a season's GP meetings in date order, each bundled
// with its race results and starting grid fetched from OpenF1. incomplete
// reports whether any per-meeting fetch failed, so callers can avoid caching a
// partial view of the season for long.
func (s *Server) fetchSeasonRaces(year int) (races []meetingRace, incomplete bool, err error) {
	meetings, err := s.client.GetMeetingsForYear(year)
	if err != nil {
		return nil, false, err
	}
	sort.Slice(meetings, func(i, j int) bool { return meetings[i].DateStart < meetings[j].DateStart })

	var failed atomic.Bool
	races = fetchMeetingRaces(meetings, champHubWorkers, func(m models.Meeting) (meetingRace, bool) {
		sessions, serr := s.client.GetSessionsForMeeting(int(m.MeetingKey))
		if serr != nil {
			failed.Store(true)
			return meetingRace{}, false
		}
		raceKey := 0
		for _, sess := range sessions {
			if strings.EqualFold(sess.SessionName, "Race") {
				raceKey = sess.SessionKey
				break
			}
		}
		if raceKey == 0 {
			return meetingRace{}, false // not a GP meeting (e.g. pre-season testing)
		}
		results, rerr := s.client.GetSessionResult(raceKey)
		grid, gerr := s.client.GetStartingGrid(raceKey)
		if rerr != nil || gerr != nil {
			failed.Store(true)
		}
		return meetingRace{Meeting: m, RaceSessionKey: raceKey, Results: results, Grid: grid}, true
	})
	return races, failed.Load(), nil
}

// aggregateChampionshipHub is the pure aggregation core (no network) so it can be
// unit-tested with synthetic data. races must be ordered ascending by date and
// contain only GP meetings (those with a Race session).
func aggregateChampionshipHub(
	year int,
	races []meetingRace,
	champ []models.ChampionshipDriver,
	teams []models.ChampionshipTeam,
	driverInfo map[int]models.Driver,
) champHubResponse {
	type acc struct {
		wins, podiums, poles int
		form                 []float64
		finishByRound        map[int]int
	}
	accs := map[int]*acc{}
	getAcc := func(num int) *acc {
		a := accs[num]
		if a == nil {
			a = &acc{finishByRound: map[int]int{}}
			accs[num] = a
		}
		return a
	}

	completed := 0
	lastRace := ""
	roundPoints := []map[int]float64{} // per completed round: driver -> race points

	for _, mr := range races {
		if len(mr.Results) == 0 {
			continue // round not completed yet
		}
		completed++
		lastRace = mr.Meeting.MeetingName
		for _, g := range mr.Grid {
			if g.Position == 1 {
				getAcc(g.DriverNumber).poles++
			}
		}
		rp := map[int]float64{}
		for _, res := range mr.Results {
			a := getAcc(res.DriverNumber)
			if res.Position == 1 {
				a.wins++
			}
			if res.Position >= 1 && res.Position <= 3 {
				a.podiums++
			}
			a.form = append(a.form, res.Points)
			a.finishByRound[completed] = res.Position
			rp[res.DriverNumber] += res.Points
		}
		roundPoints = append(roundPoints, rp)
	}

	roundLabels := make([]string, 0, completed)
	for i := 1; i <= completed; i++ {
		roundLabels = append(roundLabels, fmt.Sprintf("R%d", i))
	}

	// Official totals are authoritative; reconcile the cumulative endpoint to them.
	champPts := map[int]float64{}
	for _, c := range champ {
		champPts[c.DriverNumber] = c.PointsCurrent
	}

	cumulative := map[int][]float64{}
	for num := range accs {
		running := 0.0
		series := make([]float64, 0, completed)
		for i := 0; i < completed; i++ {
			running += roundPoints[i][num]
			series = append(series, running)
		}
		if completed > 0 {
			if off, ok := champPts[num]; ok {
				series[completed-1] = off
			}
		}
		cumulative[num] = series
	}

	// Teammate head-to-head: per round, the teammate finishing ahead wins.
	teamOf := func(num int) string { return driverInfo[num].TeamName }
	byTeam := map[string][]int{}
	for num := range accs {
		byTeam[teamOf(num)] = append(byTeam[teamOf(num)], num)
	}
	twins := map[int]int{}
	tloss := map[int]int{}
	for team, members := range byTeam {
		if team == "" || len(members) < 2 {
			continue
		}
		for round := 1; round <= completed; round++ {
			for i := 0; i < len(members); i++ {
				for j := i + 1; j < len(members); j++ {
					p1, ok1 := accs[members[i]].finishByRound[round]
					p2, ok2 := accs[members[j]].finishByRound[round]
					if !ok1 || !ok2 {
						continue
					}
					if p1 < p2 {
						twins[members[i]]++
						tloss[members[j]]++
					} else if p2 < p1 {
						twins[members[j]]++
						tloss[members[i]]++
					}
				}
			}
		}
	}

	sortedChamp := make([]models.ChampionshipDriver, len(champ))
	copy(sortedChamp, champ)
	sort.Slice(sortedChamp, func(i, j int) bool { return sortedChamp[i].PositionCurrent < sortedChamp[j].PositionCurrent })

	drivers := make([]champHubDriver, 0, len(sortedChamp))
	for _, c := range sortedChamp {
		a := accs[c.DriverNumber]
		if a == nil {
			a = &acc{}
		}
		form := a.form
		if len(form) > 5 {
			form = form[len(form)-5:]
		}
		roundPositions := make([]int, completed)
		for round := 1; round <= completed; round++ {
			roundPositions[round-1] = a.finishByRound[round]
		}
		info := driverInfo[c.DriverNumber]
		drivers = append(drivers, champHubDriver{
			DriverNumber:   c.DriverNumber,
			NameAcronym:    info.NameAcronym,
			FullName:       info.FullName,
			TeamName:       info.TeamName,
			TeamColour:     info.TeamColour,
			Points:         c.PointsCurrent,
			Position:       c.PositionCurrent,
			Wins:           a.wins,
			Podiums:        a.podiums,
			Poles:          a.poles,
			Form:           form,
			Cumulative:     cumulative[c.DriverNumber],
			RoundPositions: roundPositions,
			TeammateWins:   twins[c.DriverNumber],
			TeammateLosses: tloss[c.DriverNumber],
		})
	}

	teamWins := map[string]int{}
	teamColour := map[string]string{}
	for num, a := range accs {
		teamWins[teamOf(num)] += a.wins
		if col := driverInfo[num].TeamColour; col != "" {
			teamColour[teamOf(num)] = col
		}
	}
	sortedTeams := make([]models.ChampionshipTeam, len(teams))
	copy(sortedTeams, teams)
	sort.Slice(sortedTeams, func(i, j int) bool { return sortedTeams[i].PositionCurrent < sortedTeams[j].PositionCurrent })
	teamsOut := make([]champHubTeam, 0, len(sortedTeams))
	for _, t := range sortedTeams {
		teamsOut = append(teamsOut, champHubTeam{
			TeamName:   t.TeamName,
			TeamColour: teamColour[t.TeamName],
			Points:     t.PointsCurrent,
			Position:   t.PositionCurrent,
			Wins:       teamWins[t.TeamName],
		})
	}

	totalRounds := len(races)
	return champHubResponse{
		Season:      year,
		Round:       completed,
		TotalRounds: totalRounds,
		RoundsLeft:  totalRounds - completed,
		LastRace:    lastRace,
		RoundLabels: roundLabels,
		Drivers:     drivers,
		Teams:       teamsOut,
	}
}

// --- /api/v1/track-outline ---
// Accepts circuit_key and year (the frontend has both from meeting+session data).

type trackPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type trackBounds struct {
	MinX float64 `json:"minX"`
	MaxX float64 `json:"maxX"`
	MinY float64 `json:"minY"`
	MaxY float64 `json:"maxY"`
}

type trackOutlineResponse struct {
	CircuitKey int          `json:"circuit_key"`
	Points     []trackPoint `json:"points"`
	Bounds     trackBounds  `json:"bounds"`
}

func (s *Server) handleTrackOutline(w http.ResponseWriter, r *http.Request) {
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if year == 0 {
		year = time.Now().Year()
	}
	circuitKey, err := strconv.Atoi(r.URL.Query().Get("circuit_key"))
	if err != nil {
		circuitKey = 0
	}
	if circuitKey == 0 {
		circuitKey = s.resolveCircuitKey(year, r.URL.Query().Get("meeting_name"), r.URL.Query().Get("circuit_name"))
	}
	if circuitKey == 0 {
		http.Error(w, "circuit_key or live meeting identity required", http.StatusBadRequest)
		return
	}

	locs, ok := s.client.Cache().GetTrackOutline(circuitKey, year)
	if !ok || len(locs) == 0 {
		writeJSON(w, map[string]any{"error": "track outline not available", "circuit_key": circuitKey})
		return
	}

	// Normalize X/Y to [0, 1].
	minX, maxX := locs[0].X, locs[0].X
	minY, maxY := locs[0].Y, locs[0].Y
	for _, l := range locs {
		if l.X < minX {
			minX = l.X
		}
		if l.X > maxX {
			maxX = l.X
		}
		if l.Y < minY {
			minY = l.Y
		}
		if l.Y > maxY {
			maxY = l.Y
		}
	}
	rangeX := maxX - minX
	rangeY := maxY - minY
	if rangeX == 0 {
		rangeX = 1
	}
	if rangeY == 0 {
		rangeY = 1
	}

	// Deduplicate points.
	type key2 struct{ x, y float64 }
	seen := make(map[key2]bool, len(locs))
	points := make([]trackPoint, 0, len(locs))
	for _, l := range locs {
		p := trackPoint{
			X: (l.X - minX) / rangeX,
			Y: (l.Y - minY) / rangeY,
		}
		k := key2{p.X, p.Y}
		if !seen[k] {
			seen[k] = true
			points = append(points, p)
		}
	}

	writeJSON(w, trackOutlineResponse{
		CircuitKey: circuitKey,
		Points:     points,
		Bounds:     trackBounds{MinX: minX, MaxX: maxX, MinY: minY, MaxY: maxY},
	})
}

func (s *Server) resolveCircuitKey(year int, meetingName, circuitName string) int {
	if !s.hasLocalQuery() {
		return 0
	}
	meetings, err := s.query.ListMeetingsByYear(year)
	if err != nil {
		return 0
	}
	wantMeeting := normalizeTrackIdentity(meetingName)
	wantCircuit := normalizeTrackIdentity(circuitName)
	bestScore := 0
	bestCircuitKey := 0
	for _, m := range meetings {
		if m.CircuitKey == 0 {
			continue
		}
		score := identityScore(wantMeeting, m.MeetingName, m.MeetingOfficialName, m.Location)
		score += identityScore(wantCircuit, m.CircuitShortName, m.Location, m.MeetingName)
		if score > bestScore {
			bestScore = score
			bestCircuitKey = m.CircuitKey
		}
	}
	if bestScore == 0 {
		return 0
	}
	return bestCircuitKey
}

func identityScore(want string, candidates ...string) int {
	if want == "" {
		return 0
	}
	best := 0
	for _, candidate := range candidates {
		got := normalizeTrackIdentity(candidate)
		if got == "" {
			continue
		}
		switch {
		case got == want:
			if best < 4 {
				best = 4
			}
		case strings.Contains(got, want) || strings.Contains(want, got):
			if best < 2 {
				best = 2
			}
		}
	}
	return best
}

func normalizeTrackIdentity(s string) string {
	s = strings.ToLower(s)
	replacer := strings.NewReplacer(
		"grand prix", "",
		" gp", "",
		"circuit", "",
		"autodromo", "",
		"autódromo", "",
		"international", "",
		"street", "",
		" ", "",
		"-", "",
		"_", "",
		".", "",
		",", "",
		"'", "",
		"’", "",
	)
	return strings.TrimSpace(replacer.Replace(s))
}

// --- /api/v1/strategy ---

type scPeriod struct {
	LapStart int    `json:"lap_start"`
	LapEnd   int    `json:"lap_end"`
	Type     string `json:"type"` // "SC" or "VSC"
}

type stintInfo struct {
	StintNumber    int    `json:"stint_number"`
	Compound       string `json:"compound"`
	LapStart       int    `json:"lap_start"`
	LapEnd         int    `json:"lap_end"`
	LapCount       int    `json:"lap_count"`
	TyreAgeAtStart int    `json:"tyre_age_at_start"`
	IsNew          bool   `json:"is_new"`
}

type pitStopInfo struct {
	LapNumber    int     `json:"lap_number"`
	StopDuration float64 `json:"stop_duration"`
	LaneDuration float64 `json:"lane_duration"`
}

type strategyDriver struct {
	DriverNumber   int           `json:"driver_number"`
	NameAcronym    string        `json:"name_acronym"`
	TeamColour     string        `json:"team_colour"`
	FinishPosition int           `json:"finish_position"`
	DNF            bool          `json:"dnf"`
	DNS            bool          `json:"dns"`
	DSQ            bool          `json:"dsq"`
	Stints         []stintInfo   `json:"stints"`
	PitStops       []pitStopInfo `json:"pit_stops"`
}

type strategyResponse struct {
	SessionKey int              `json:"session_key"`
	TotalLaps  int              `json:"total_laps"`
	SCPeriods  []scPeriod       `json:"sc_periods"`
	Drivers    []strategyDriver `json:"drivers"`
}

func (s *Server) handleStrategy(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}

	var (
		stints    []models.Stint
		pits      []models.Pit
		results   []models.SessionResult
		drivers   []models.Driver
		rc        []models.RaceControl
		stintsErr error
		pitsErr   error
		resErr    error
		wg        sync.WaitGroup
	)
	wg.Add(5)
	go func() { defer wg.Done(); stints, stintsErr = s.client.GetStintsForSession(sessionKey) }()
	go func() { defer wg.Done(); pits, pitsErr = s.client.GetPitStopsForSession(sessionKey) }()
	go func() { defer wg.Done(); results, resErr = s.client.GetSessionResult(sessionKey) }()
	go func() { defer wg.Done(); drivers, _ = s.client.GetDriversForSession(sessionKey) }()
	go func() { defer wg.Done(); rc, _ = s.client.GetRaceControl(sessionKey) }()
	wg.Wait()

	if stintsErr != nil || pitsErr != nil || resErr != nil {
		e := stintsErr
		if e == nil {
			e = pitsErr
		}
		if e == nil {
			e = resErr
		}
		writeError(w, e, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}

	// Non-race sessions have no stints.
	if len(stints) == 0 {
		writeJSON(w, map[string]any{"note": "Not applicable", "drivers": []any{}})
		return
	}

	driverMap := buildDriverMap(drivers)

	resultMap := make(map[int]models.SessionResult, len(results))
	totalLaps := 0
	for _, res := range results {
		resultMap[res.DriverNumber] = res
		if res.NumberOfLaps > totalLaps {
			totalLaps = res.NumberOfLaps
		}
	}

	stintMap := make(map[int][]models.Stint)
	for _, st := range stints {
		stintMap[st.DriverNumber] = append(stintMap[st.DriverNumber], st)
	}

	pitMap := make(map[int][]models.Pit)
	for _, p := range pits {
		pitMap[p.DriverNumber] = append(pitMap[p.DriverNumber], p)
	}

	// Collect all driver numbers.
	seenDrivers := make(map[int]bool)
	for _, st := range stints {
		seenDrivers[st.DriverNumber] = true
	}
	for _, res := range results {
		seenDrivers[res.DriverNumber] = true
	}

	stratDrivers := make([]strategyDriver, 0, len(seenDrivers))
	for dn := range seenDrivers {
		d := driverMap[dn]
		res := resultMap[dn]

		sd := strategyDriver{
			DriverNumber:   dn,
			NameAcronym:    d.NameAcronym,
			TeamColour:     d.TeamColour,
			FinishPosition: res.Position,
			DNF:            res.DNF,
			DNS:            res.DNS,
			DSQ:            res.DSQ,
		}

		if res.DNS {
			sd.Stints = []stintInfo{}
		} else {
			for _, st := range stintMap[dn] {
				lapEnd := st.LapEnd
				if res.DNF && lapEnd > res.NumberOfLaps && res.NumberOfLaps > 0 {
					lapEnd = res.NumberOfLaps
				}
				sd.Stints = append(sd.Stints, stintInfo{
					StintNumber:    st.StintNumber,
					Compound:       string(st.Compound),
					LapStart:       st.LapStart,
					LapEnd:         lapEnd,
					LapCount:       lapEnd - st.LapStart + 1,
					TyreAgeAtStart: st.TyreAgeAtStart,
					IsNew:          st.TyreAgeAtStart == 0,
				})
			}
		}

		for _, p := range pitMap[dn] {
			sd.PitStops = append(sd.PitStops, pitStopInfo{
				LapNumber:    p.LapNumber,
				StopDuration: p.StopDuration,
				LaneDuration: p.LaneDuration,
			})
		}
		stratDrivers = append(stratDrivers, sd)
	}

	// Sort by finish position (DNF/DNS/no-result last).
	sort.Slice(stratDrivers, func(i, j int) bool {
		pi, pj := stratDrivers[i].FinishPosition, stratDrivers[j].FinishPosition
		if pi == 0 {
			pi = 999
		}
		if pj == 0 {
			pj = 999
		}
		return pi < pj
	})

	writeJSON(w, strategyResponse{
		SessionKey: sessionKey,
		TotalLaps:  totalLaps,
		SCPeriods:  extractSCPeriods(rc),
		Drivers:    stratDrivers,
	})
}

// extractSCPeriods parses race control messages to find SC/VSC deployment periods.
func extractSCPeriods(rc []models.RaceControl) []scPeriod {
	type pending struct {
		lapStart int
		scType   string
	}
	var periods []scPeriod
	var active *pending

	for _, msg := range rc {
		if msg.Category != models.CategorySafetyCar {
			continue
		}
		text := strings.ToUpper(msg.Message)
		lap := 0
		if msg.LapNumber != nil {
			lap = *msg.LapNumber
		}

		if strings.Contains(text, "DEPLOYED") {
			scType := "SC"
			if strings.Contains(text, "VIRTUAL") {
				scType = "VSC"
			}
			active = &pending{lapStart: lap, scType: scType}
		} else if active != nil && (strings.Contains(text, "IN THIS LAP") ||
			strings.Contains(text, "ENDING") ||
			strings.Contains(text, "WITHDRAWN") ||
			strings.Contains(text, "RESUME")) {
			periods = append(periods, scPeriod{
				LapStart: active.lapStart,
				LapEnd:   lap,
				Type:     active.scType,
			})
			active = nil
		}
	}
	// If SC was still active at end of data, close it with an estimate.
	if active != nil && active.lapStart > 0 {
		periods = append(periods, scPeriod{
			LapStart: active.lapStart,
			LapEnd:   active.lapStart + 5,
			Type:     active.scType,
		})
	}
	return periods
}

// --- /api/v1/laps/comparison ---

type lapWithCompound struct {
	models.Lap
	Compound string `json:"compound"`
}

type comparisonDriver struct {
	DriverNumber int               `json:"driver_number"`
	NameAcronym  string            `json:"name_acronym"`
	TeamColour   string            `json:"team_colour"`
	Laps         []lapWithCompound `json:"laps"`
}

type lapsComparisonResponse struct {
	SessionKey int                `json:"session_key"`
	SCPeriods  []scPeriod         `json:"sc_periods"`
	PitLaps    map[string][]int   `json:"pit_laps"`
	Drivers    []comparisonDriver `json:"drivers"`
}

func (s *Server) handleLapsComparison(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}

	// Parse requested driver numbers (comma-separated).
	var requestedDrivers []int
	if drvParam := r.URL.Query().Get("drivers"); drvParam != "" {
		for _, part := range strings.Split(drvParam, ",") {
			if n, err := strconv.Atoi(strings.TrimSpace(part)); err == nil && n > 0 {
				requestedDrivers = append(requestedDrivers, n)
			}
		}
	}

	var (
		allLaps []models.Lap
		stints  []models.Stint
		pits    []models.Pit
		rc      []models.RaceControl
		wg      sync.WaitGroup
	)
	wg.Add(4)
	go func() { defer wg.Done(); allLaps, _ = s.client.GetLapsForSession(sessionKey) }()
	go func() { defer wg.Done(); stints, _ = s.client.GetStintsForSession(sessionKey) }()
	go func() { defer wg.Done(); pits, _ = s.client.GetPitStopsForSession(sessionKey) }()
	go func() { defer wg.Done(); rc, _ = s.client.GetRaceControl(sessionKey) }()
	wg.Wait()

	allDrivers, _ := s.client.GetDriversForSession(sessionKey)
	driverMap := buildDriverMap(allDrivers)

	// If no filter, default to first 3 unique driver numbers from lap data.
	if len(requestedDrivers) == 0 {
		seen := make(map[int]bool)
		for _, l := range allLaps {
			if !seen[l.DriverNumber] {
				seen[l.DriverNumber] = true
				requestedDrivers = append(requestedDrivers, l.DriverNumber)
			}
			if len(requestedDrivers) >= 3 {
				break
			}
		}
	}

	// Build per-driver lap map.
	lapMap := make(map[int][]models.Lap)
	for _, l := range allLaps {
		lapMap[l.DriverNumber] = append(lapMap[l.DriverNumber], l)
	}

	// Build stint map for compound lookup.
	stintMap := make(map[int][]models.Stint)
	for _, st := range stints {
		stintMap[st.DriverNumber] = append(stintMap[st.DriverNumber], st)
	}

	// Build pit laps map.
	pitLaps := make(map[string][]int)
	for _, p := range pits {
		key := strconv.Itoa(p.DriverNumber)
		pitLaps[key] = append(pitLaps[key], p.LapNumber)
	}

	compDrivers := make([]comparisonDriver, 0, len(requestedDrivers))
	for _, dn := range requestedDrivers {
		d := driverMap[dn]
		cd := comparisonDriver{
			DriverNumber: dn,
			NameAcronym:  d.NameAcronym,
			TeamColour:   d.TeamColour,
			Laps:         make([]lapWithCompound, 0, len(lapMap[dn])),
		}
		for _, lap := range lapMap[dn] {
			cd.Laps = append(cd.Laps, lapWithCompound{
				Lap:      lap,
				Compound: compoundForLap(lap.LapNumber, stintMap[dn]),
			})
		}
		compDrivers = append(compDrivers, cd)
	}

	writeJSON(w, lapsComparisonResponse{
		SessionKey: sessionKey,
		SCPeriods:  extractSCPeriods(rc),
		PitLaps:    pitLaps,
		Drivers:    compDrivers,
	})
}

// compoundForLap returns the tyre compound active on a given lap number.
func compoundForLap(lapNum int, stints []models.Stint) string {
	for _, st := range stints {
		if lapNum >= st.LapStart && lapNum <= st.LapEnd {
			return string(st.Compound)
		}
	}
	return "UNKNOWN"
}

// buildDriverMap returns a map of driver_number → Driver.
func buildDriverMap(drivers []models.Driver) map[int]models.Driver {
	m := make(map[int]models.Driver, len(drivers))
	for _, d := range drivers {
		m[d.DriverNumber] = d
	}
	return m
}

func buildDriverMapFirst(drivers []models.Driver) map[int]models.Driver {
	m := make(map[int]models.Driver, len(drivers))
	for _, d := range drivers {
		if _, exists := m[d.DriverNumber]; !exists {
			m[d.DriverNumber] = d
		}
	}
	return m
}

func enrichedResultsToAPI(results []query.EnrichedResult) []resultWithDriver {
	out := make([]resultWithDriver, 0, len(results))
	for _, res := range results {
		out = append(out, resultWithDriver{
			SessionResult: res.SessionResult,
			NameAcronym:   res.NameAcronym,
			FullName:      res.FullName,
			TeamName:      res.TeamName,
			TeamColour:    res.TeamColour,
		})
	}
	return out
}

func enrichedGridToAPI(grid []query.EnrichedGrid) []gridWithDriver {
	out := make([]gridWithDriver, 0, len(grid))
	for _, g := range grid {
		out = append(out, gridWithDriver{
			StartingGrid: g.StartingGrid,
			NameAcronym:  g.NameAcronym,
			FullName:     g.FullName,
			TeamName:     g.TeamName,
			TeamColour:   g.TeamColour,
		})
	}
	return out
}
