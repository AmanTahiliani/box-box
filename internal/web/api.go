package web

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
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
	sessions, err := s.client.GetSessionsForMeeting(meetingKey)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, s.client.LastResponseWasStale())
		return
	}
	writeJSON(w, sessions)
}

// --- /api/v1/drivers ---

func (s *Server) handleDrivers(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
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
	driverMap := buildDriverMap(drivers)

	enriched := make([]champDriverWithInfo, 0, len(champ))
	for _, c := range champ {
		e := champDriverWithInfo{ChampionshipDriver: c}
		if d, ok := driverMap[c.DriverNumber]; ok {
			e.NameAcronym = d.NameAcronym
			e.FullName = d.FullName
			e.TeamName = d.TeamName
			e.TeamColour = d.TeamColour
		}
		enriched = append(enriched, e)
	}
	writeJSON(w, enriched)
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

// --- /api/v1/track-outline ---
// Accepts circuit_key and year (the frontend has both from meeting+session data).

type trackPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type trackOutlineResponse struct {
	CircuitKey int          `json:"circuit_key"`
	Points     []trackPoint `json:"points"`
}

func (s *Server) handleTrackOutline(w http.ResponseWriter, r *http.Request) {
	circuitKey, err := strconv.Atoi(r.URL.Query().Get("circuit_key"))
	if err != nil || circuitKey == 0 {
		http.Error(w, "circuit_key required", http.StatusBadRequest)
		return
	}
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if year == 0 {
		year = time.Now().Year()
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

	writeJSON(w, trackOutlineResponse{CircuitKey: circuitKey, Points: points})
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
	SessionKey int              `json:"session_key"`
	SCPeriods  []scPeriod       `json:"sc_periods"`
	PitLaps    map[string][]int `json:"pit_laps"`
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
