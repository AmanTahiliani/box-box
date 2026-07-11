package web

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AmanTahiliani/box-box/internal/models"
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
