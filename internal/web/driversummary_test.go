package web

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/store"
)

func driverSummaryFixtures() ([]meetingRace, []models.ChampionshipDriver, map[int]models.Driver) {
	driverInfo := map[int]models.Driver{
		1: {DriverNumber: 1, NameAcronym: "VER", FullName: "Max Verstappen", TeamName: "Red Bull", TeamColour: "3671c6", HeadshotURL: "https://example.com/ver.png"},
		3: {DriverNumber: 3, NameAcronym: "HAM", FullName: "Lewis Hamilton", TeamName: "Mercedes", TeamColour: "27f4d2"},
	}

	champ := []models.ChampionshipDriver{
		{DriverNumber: 1, PointsCurrent: 50, PositionCurrent: 1, SessionKey: 99},
		{DriverNumber: 3, PointsCurrent: 33, PositionCurrent: 2, SessionKey: 99},
	}

	// Round 1: VER P1 from pole, HAM P2 from P3.
	// Round 2: VER P1 from P2, HAM P3 from pole.
	// Round 3: not yet run — must not appear in rounds.
	races := []meetingRace{
		{
			Meeting: models.Meeting{MeetingKey: 1201, MeetingName: "Bahrain GP", CountryCode: "BHR", CountryName: "Bahrain"},
			Results: []models.SessionResult{raceResult(1, 1, 25), raceResult(3, 2, 18)},
			Grid:    []models.StartingGrid{{DriverNumber: 1, Position: 1}, {DriverNumber: 3, Position: 3}},
		},
		{
			Meeting: models.Meeting{MeetingKey: 1202, MeetingName: "Saudi GP", CountryCode: "SAU", CountryName: "Saudi Arabia"},
			Results: []models.SessionResult{raceResult(1, 1, 25), raceResult(3, 3, 15)},
			Grid:    []models.StartingGrid{{DriverNumber: 3, Position: 1}, {DriverNumber: 1, Position: 2}},
		},
		{Meeting: models.Meeting{MeetingKey: 1203, MeetingName: "Australia GP"}},
	}
	return races, champ, driverInfo
}

func TestAggregateDriverSummary(t *testing.T) {
	races, champ, driverInfo := driverSummaryFixtures()

	resp, ok := aggregateDriverSummary(2025, 1, races, champ, driverInfo)
	if !ok {
		t.Fatal("aggregateDriverSummary ok = false, want true")
	}

	if resp.Season != 2025 || resp.DriverNumber != 1 {
		t.Errorf("season/driver = %d/%d, want 2025/1", resp.Season, resp.DriverNumber)
	}
	if resp.NameAcronym != "VER" || resp.FullName != "Max Verstappen" || resp.TeamName != "Red Bull" || resp.TeamColour != "3671c6" {
		t.Errorf("driver identity = %s %s %s %s", resp.NameAcronym, resp.FullName, resp.TeamName, resp.TeamColour)
	}
	if resp.HeadshotURL != "https://example.com/ver.png" {
		t.Errorf("headshot = %q", resp.HeadshotURL)
	}
	if resp.Points != 50 || resp.Position != 1 {
		t.Errorf("points/position = %v/%d, want 50/1", resp.Points, resp.Position)
	}
	if resp.Wins != 2 || resp.Podiums != 2 || resp.Poles != 1 {
		t.Errorf("wins/podiums/poles = %d/%d/%d, want 2/2/1", resp.Wins, resp.Podiums, resp.Poles)
	}
	if len(resp.Form) != 2 || resp.Form[0] != 25 || resp.Form[1] != 25 {
		t.Errorf("form = %v, want [25 25]", resp.Form)
	}
	// Cumulative reconciles the last value to the official total.
	if len(resp.Cumulative) != 2 || resp.Cumulative[0] != 25 || resp.Cumulative[1] != 50 {
		t.Errorf("cumulative = %v, want [25 50]", resp.Cumulative)
	}
	if len(resp.RoundLabels) != 2 || resp.RoundLabels[0] != "R1" {
		t.Errorf("round labels = %v, want [R1 R2]", resp.RoundLabels)
	}

	// Only completed rounds appear.
	if len(resp.Rounds) != 2 {
		t.Fatalf("rounds = %d, want 2", len(resp.Rounds))
	}
	r1 := resp.Rounds[0]
	if r1.MeetingKey != 1201 || r1.MeetingName != "Bahrain GP" || r1.CountryCode != "BHR" || r1.CountryName != "Bahrain" {
		t.Errorf("round 1 meeting = %+v", r1)
	}
	if r1.RacePosition != 1 || r1.GridPosition != 1 || r1.QualiPosition != 1 || r1.Points != 25 {
		t.Errorf("round 1 result = %+v, want P1 from P1 with 25 pts", r1)
	}
	r2 := resp.Rounds[1]
	if r2.RacePosition != 1 || r2.GridPosition != 2 || r2.Points != 25 {
		t.Errorf("round 2 result = %+v, want P1 from P2 with 25 pts", r2)
	}
}

func TestAggregateDriverSummaryDriverMissingFromRound(t *testing.T) {
	races, champ, driverInfo := driverSummaryFixtures()
	// Drop HAM from round 2's results and grid: the round still appears with
	// zero-valued positions so round indexing stays aligned with the season.
	races[1].Results = []models.SessionResult{raceResult(1, 1, 25)}
	races[1].Grid = []models.StartingGrid{{DriverNumber: 1, Position: 2}}

	resp, ok := aggregateDriverSummary(2025, 3, races, champ, driverInfo)
	if !ok {
		t.Fatal("aggregateDriverSummary ok = false, want true")
	}
	if len(resp.Rounds) != 2 {
		t.Fatalf("rounds = %d, want 2", len(resp.Rounds))
	}
	r2 := resp.Rounds[1]
	if r2.RacePosition != 0 || r2.GridPosition != 0 || r2.QualiPosition != 0 || r2.Points != 0 {
		t.Errorf("round 2 for absent driver = %+v, want zero values", r2)
	}
}

func TestAggregateDriverSummaryUnknownDriver(t *testing.T) {
	races, champ, driverInfo := driverSummaryFixtures()
	if _, ok := aggregateDriverSummary(2025, 44, races, champ, driverInfo); ok {
		t.Error("unknown driver should return ok = false")
	}
}

func TestHandleDriverSummaryBadRequest(t *testing.T) {
	srv := testServer(t, nil)

	// Missing, non-numeric, zero, and negative driver_number are all rejected.
	for _, url := range []string{
		"/api/v1/driver/summary?year=2025",
		"/api/v1/driver/summary?year=2025&driver_number=abc",
		"/api/v1/driver/summary?year=2025&driver_number=0",
		"/api/v1/driver/summary?year=2025&driver_number=-4",
	} {
		req := httptest.NewRequest(http.MethodGet, url, nil)
		rec := httptest.NewRecorder()
		srv.handleDriverSummary(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400", url, rec.Code)
		}
	}
}

func seedDriverSummaryStore(t *testing.T, st *store.Store) {
	t.Helper()
	meetingKey := 1201
	sessionKey := 9901

	if err := st.UpsertMeeting(store.Meeting{
		MeetingKey:  meetingKey,
		MeetingName: "Bahrain GP",
		CountryCode: "BHR",
		CountryName: "Bahrain",
		Year:        2025,
		DateStart:   "2025-03-02",
	}); err != nil {
		t.Fatalf("UpsertMeeting: %v", err)
	}
	if err := st.UpsertSession(store.Session{
		SessionKey:  sessionKey,
		MeetingKey:  meetingKey,
		SessionName: "Race",
		SessionType: "Race",
		DateStart:   "2025-03-02T15:00:00Z",
	}); err != nil {
		t.Fatalf("UpsertSession: %v", err)
	}
	if err := st.UpsertDriver(store.Driver{
		DriverNumber: 1,
		FullName:     "Max Verstappen",
		NameAcronym:  "VER",
		TeamName:     "Red Bull",
		TeamColour:   "3671c6",
	}); err != nil {
		t.Fatalf("UpsertDriver: %v", err)
	}
	if err := st.UpsertSessionDriver(store.SessionDriver{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
		FullName:     "Max Verstappen",
		NameAcronym:  "VER",
		TeamName:     "Red Bull",
		TeamColour:   "3671c6",
	}); err != nil {
		t.Fatalf("UpsertSessionDriver: %v", err)
	}
	if err := st.UpsertSessionResult(store.SessionResult{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
		Position:     1,
		Points:       25,
	}); err != nil {
		t.Fatalf("UpsertSessionResult: %v", err)
	}
	if err := st.UpsertStartingGridEntry(store.StartingGridEntry{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
		Position:     1,
	}); err != nil {
		t.Fatalf("UpsertStartingGridEntry: %v", err)
	}
}

func TestHandleDriverSummaryLocalFirstIgnoresHangingEnrichment(t *testing.T) {
	prev := driverEnrichmentTimeout
	driverEnrichmentTimeout = 40 * time.Millisecond
	t.Cleanup(func() { driverEnrichmentTimeout = prev })

	st := openTestStore(t)
	seedDriverSummaryStore(t, st)

	// Enrichment seam: OpenF1 hangs until released. Local summary must still return.
	release := make(chan struct{})
	hang := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	t.Cleanup(func() {
		close(release)
		hang.Close()
	})

	client := api.NewOpenF1Client(hang.URL, 15*time.Second)
	t.Cleanup(func() { _ = client.Close() })
	srv := NewServer(client, 8080, st)

	start := time.Now()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/driver/summary?year=2025&driver_number=1", nil)
	rec := httptest.NewRecorder()
	srv.handleDriverSummary(rec, req)
	elapsed := time.Since(start)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	if elapsed > 500*time.Millisecond {
		t.Fatalf("handler blocked on enrichment for %v", elapsed)
	}

	var resp driverSummaryResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Source != "local" {
		t.Errorf("source = %q, want local", resp.Source)
	}
	if resp.Enrichment != "limited" {
		t.Errorf("enrichment = %q, want limited", resp.Enrichment)
	}
	if rec.Header().Get(dataSourceHeader) != "local" || rec.Header().Get(dataFreshnessHeader) != "limited" {
		t.Errorf("limited metadata = %q/%q", rec.Header().Get(dataSourceHeader), rec.Header().Get(dataFreshnessHeader))
	}
	if resp.DriverNumber != 1 || resp.NameAcronym != "VER" || resp.Points != 25 {
		t.Errorf("local identity/results missing: %+v", resp)
	}
}

func TestHandleDriverSummaryLocalFirstWithFailingEnrichment(t *testing.T) {
	prev := driverEnrichmentTimeout
	driverEnrichmentTimeout = 200 * time.Millisecond
	t.Cleanup(func() { driverEnrichmentTimeout = prev })

	st := openTestStore(t)
	seedDriverSummaryStore(t, st)

	fail := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	t.Cleanup(fail.Close)

	client := api.NewOpenF1Client(fail.URL, 2*time.Second)
	t.Cleanup(func() { _ = client.Close() })
	srv := NewServer(client, 8080, st)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/driver/summary?year=2025&driver_number=1&source=auto", nil)
	rec := httptest.NewRecorder()
	srv.handleDriverSummary(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var resp driverSummaryResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Source != "local" {
		t.Errorf("source = %q, want local", resp.Source)
	}
	if resp.Enrichment != "limited" {
		t.Errorf("enrichment = %q, want limited", resp.Enrichment)
	}
	if rec.Header().Get(dataSourceHeader) != "local" || rec.Header().Get(dataFreshnessHeader) != "limited" {
		t.Errorf("limited metadata = %q/%q", rec.Header().Get(dataSourceHeader), rec.Header().Get(dataFreshnessHeader))
	}
	if resp.FullName != "Max Verstappen" {
		t.Errorf("full_name = %q, want local identity", resp.FullName)
	}
}

func TestHandleDriverSummarySourceLocalOnly(t *testing.T) {
	st := openTestStore(t)
	seedDriverSummaryStore(t, st)

	// Even with a broken OpenF1 client, source=local must succeed from the DB.
	fail := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusInternalServerError)
	}))
	t.Cleanup(fail.Close)
	client := api.NewOpenF1Client(fail.URL, time.Second)
	t.Cleanup(func() { _ = client.Close() })
	srv := NewServer(client, 8080, st)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/driver/summary?year=2025&driver_number=1&source=local", nil)
	rec := httptest.NewRecorder()
	srv.handleDriverSummary(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get(dataSourceHeader) != "local" || rec.Header().Get(dataFreshnessHeader) != "local" {
		t.Fatalf("local metadata = %q/%q", rec.Header().Get(dataSourceHeader), rec.Header().Get(dataFreshnessHeader))
	}
}
