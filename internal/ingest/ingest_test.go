package ingest

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/store"
)

type fakeSource struct {
	meetingsByYear    map[int][]models.Meeting
	meetingsByKey     map[int][]models.Meeting
	sessionsByMeeting map[int][]models.Session
	sessionsByKey     map[int][]models.Session
	drivers           map[int][]models.Driver
	results           map[int][]models.SessionResult
	grid              map[int][]models.StartingGrid
	stints            map[int][]models.Stint
	pitStops          map[int][]models.Pit
	positions         map[int][]models.Position
	raceControl       map[int][]models.RaceControl
	weather           map[int][]models.Weather
	laps              map[int][]models.Lap
	failOn            string
	liveLockout       bool
}

func newFakeSource() *fakeSource {
	return &fakeSource{
		meetingsByYear:    make(map[int][]models.Meeting),
		meetingsByKey:     make(map[int][]models.Meeting),
		sessionsByMeeting: make(map[int][]models.Session),
		sessionsByKey:     make(map[int][]models.Session),
		drivers:           make(map[int][]models.Driver),
		results:           make(map[int][]models.SessionResult),
		grid:              make(map[int][]models.StartingGrid),
		stints:            make(map[int][]models.Stint),
		pitStops:          make(map[int][]models.Pit),
		positions:         make(map[int][]models.Position),
		raceControl:       make(map[int][]models.RaceControl),
		weather:           make(map[int][]models.Weather),
		laps:              make(map[int][]models.Lap),
	}
}

func (f *fakeSource) maybeFail(endpoint string) error {
	if f.liveLockout {
		return fmt.Errorf("%w", api.ErrLiveSessionLocked)
	}
	if f.failOn == endpoint {
		return errors.New("simulated fetch failure")
	}
	return nil
}

func (f *fakeSource) wrap(endpoint, requestKey string, payload any) FetchResult {
	body, _ := json.Marshal(payload)
	return FetchResult{
		Endpoint:   endpoint,
		RequestKey: requestKey,
		URL:        "fake://" + endpoint + "?" + requestKey,
		Body:       body,
		FetchedAt:  time.Now(),
	}
}

func (f *fakeSource) FetchMeetingsForYear(year int) (FetchResult, []models.Meeting, error) {
	if err := f.maybeFail("meetings"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.meetingsByYear[year]
	return f.wrap("meetings", fmt.Sprintf("year=%d", year), data), data, nil
}

func (f *fakeSource) FetchMeetingsForMeetingKey(meetingKey int) (FetchResult, []models.Meeting, error) {
	if err := f.maybeFail("meetings"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.meetingsByKey[meetingKey]
	return f.wrap("meetings", fmt.Sprintf("meeting_key=%d", meetingKey), data), data, nil
}

func (f *fakeSource) FetchSessionsForMeeting(meetingKey int) (FetchResult, []models.Session, error) {
	if err := f.maybeFail("sessions"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.sessionsByMeeting[meetingKey]
	return f.wrap("sessions", fmt.Sprintf("meeting_key=%d", meetingKey), data), data, nil
}

func (f *fakeSource) FetchSessionsForSessionKey(sessionKey int) (FetchResult, []models.Session, error) {
	if err := f.maybeFail("sessions"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.sessionsByKey[sessionKey]
	return f.wrap("sessions", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func (f *fakeSource) FetchDriversForSession(sessionKey int) (FetchResult, []models.Driver, error) {
	if err := f.maybeFail("drivers"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.drivers[sessionKey]
	return f.wrap("drivers", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func (f *fakeSource) FetchSessionResult(sessionKey int) (FetchResult, []models.SessionResult, error) {
	if err := f.maybeFail("session_result"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.results[sessionKey]
	return f.wrap("session_result", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func (f *fakeSource) FetchStartingGrid(sessionKey int) (FetchResult, []models.StartingGrid, error) {
	if err := f.maybeFail("starting_grid"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.grid[sessionKey]
	return f.wrap("starting_grid", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func (f *fakeSource) FetchStintsForSession(sessionKey int) (FetchResult, []models.Stint, error) {
	if err := f.maybeFail("stints"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.stints[sessionKey]
	return f.wrap("stints", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func (f *fakeSource) FetchPitStopsForSession(sessionKey int) (FetchResult, []models.Pit, error) {
	if err := f.maybeFail("pit"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.pitStops[sessionKey]
	return f.wrap("pit", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func (f *fakeSource) FetchPositionsForSession(sessionKey int) (FetchResult, []models.Position, error) {
	if err := f.maybeFail("position"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.positions[sessionKey]
	return f.wrap("position", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func (f *fakeSource) FetchRaceControlForSession(sessionKey int) (FetchResult, []models.RaceControl, error) {
	if err := f.maybeFail("race_control"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.raceControl[sessionKey]
	return f.wrap("race_control", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func (f *fakeSource) FetchWeatherForSession(sessionKey int) (FetchResult, []models.Weather, error) {
	if err := f.maybeFail("weather"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.weather[sessionKey]
	return f.wrap("weather", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func (f *fakeSource) FetchLapsForSession(sessionKey int) (FetchResult, []models.Lap, error) {
	if err := f.maybeFail("laps"); err != nil {
		return FetchResult{}, nil, err
	}
	data := f.laps[sessionKey]
	return f.wrap("laps", fmt.Sprintf("session_key=%d", sessionKey), data), data, nil
}

func openTestStore(t *testing.T) *store.Store {
	t.Helper()
	path := filepath.Join(t.TempDir(), "ingest.db")
	s, err := store.Open(path)
	if err != nil {
		t.Fatalf("store.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func testSessionFixtures() (int, int, *fakeSource) {
	const meetingKey = 1229
	const sessionKey = 9472

	src := newFakeSource()
	src.meetingsByKey[meetingKey] = []models.Meeting{{
		MeetingKey:          meetingKey,
		MeetingName:         "Monaco",
		MeetingOfficialName: "FORMULA 1 GRAND PRIX DE MONACO 2025",
		Location:            "Monaco",
		CountryCode:         "MON",
		CountryName:         "Monaco",
		Circuit: models.Circuit{
			CircuitKey:       10,
			CircuitShortName: "Monte Carlo",
		},
		Year: 2025,
	}}
	src.sessionsByKey[sessionKey] = []models.Session{{
		SessionKey:  sessionKey,
		MeetingKey:  meetingKey,
		SessionName: "Race",
		SessionType: "Race",
		CircuitKey:  10,
	}}
	src.drivers[sessionKey] = []models.Driver{
		{
			DriverNumber: 1,
			FullName:     "Max Verstappen",
			SessionKey:   sessionKey,
			MeetingKey:   meetingKey,
			TeamName:     "Red Bull Racing",
			TeamColour:   "3671C6",
		},
		{
			DriverNumber: 44,
			FullName:     "Lewis Hamilton",
			SessionKey:   sessionKey,
			MeetingKey:   meetingKey,
			TeamName:     "Ferrari",
			TeamColour:   "E8002D",
		},
	}
	src.results[sessionKey] = []models.SessionResult{
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 1, Position: 1, Points: 25, NumberOfLaps: 78},
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 44, Position: 2, Points: 18, NumberOfLaps: 78, GapToLeader: 1.5},
	}
	src.grid[sessionKey] = []models.StartingGrid{
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 1, Position: 1, LapDuration: 71.234},
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 44, Position: 2, LapDuration: 71.456},
	}
	src.stints[sessionKey] = []models.Stint{
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 1, StintNumber: 1, Compound: models.CompoundMedium, LapStart: 1, LapEnd: 30},
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 44, StintNumber: 1, Compound: models.CompoundSoft, LapStart: 1, LapEnd: 18},
	}
	src.pitStops[sessionKey] = []models.Pit{
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 44, LapNumber: 19, Date: "2025-05-25T14:00:00+00:00", StopDuration: 2.4},
	}
	src.positions[sessionKey] = []models.Position{
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 1, Date: "2025-05-25T13:05:00+00:00", Position: 1},
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 1, Date: "2025-05-25T13:10:00+00:00", Position: 1},
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 44, Date: "2025-05-25T13:05:00+00:00", Position: 2},
	}
	src.raceControl[sessionKey] = []models.RaceControl{
		{SessionKey: sessionKey, MeetingKey: meetingKey, Date: "2025-05-25T13:01:00+00:00", Category: models.CategoryFlag, Flag: models.FlagGreen, Message: "Green light"},
	}
	src.weather[sessionKey] = []models.Weather{
		{SessionKey: sessionKey, MeetingKey: meetingKey, Date: "2025-05-25T13:00:00+00:00", AirTemperature: 22.0, TrackTemperature: 34.0},
	}
	src.laps[sessionKey] = []models.Lap{
		{SessionKey: sessionKey, MeetingKey: meetingKey, DriverNumber: 1, LapNumber: 1, LapDuration: ptrFloat64(75.1)},
	}

	return meetingKey, sessionKey, src
}

func ptrFloat64(v float64) *float64 {
	return &v
}

func TestIngestSessionWritesDomainAndRawRows(t *testing.T) {
	_, sessionKey, src := testSessionFixtures()
	st := openTestStore(t)

	opts := DefaultOptions()
	opts.RequestDelay = 0
	svc := NewService(st, src, opts)

	summary, err := svc.IngestSession(sessionKey)
	if err != nil {
		t.Fatalf("IngestSession() error = %v", err)
	}
	if summary.Status != "completed" {
		t.Fatalf("summary.Status = %q, want completed", summary.Status)
	}
	if summary.Drivers != 2 || summary.SessionResults != 2 || summary.StartingGrid != 2 {
		t.Fatalf("summary counts = %+v, want 2 drivers/results/grid", summary)
	}
	if summary.Stints != 2 || summary.PitStops != 1 || summary.Positions != 3 {
		t.Fatalf("summary analytics counts = %+v, want stints=2 pits=1 positions=3", summary)
	}
	if summary.RawPayloads != 11 {
		t.Fatalf("summary.RawPayloads = %d, want 11", summary.RawPayloads)
	}

	drivers, err := st.ListSessionDrivers(sessionKey)
	if err != nil {
		t.Fatalf("ListSessionDrivers() error = %v", err)
	}
	if len(drivers) != 2 {
		t.Fatalf("session drivers = %d, want 2", len(drivers))
	}

	results, err := st.ListSessionResults(sessionKey)
	if err != nil {
		t.Fatalf("ListSessionResults() error = %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("session results = %d, want 2", len(results))
	}

	grid, err := st.ListStartingGrid(sessionKey)
	if err != nil {
		t.Fatalf("ListStartingGrid() error = %v", err)
	}
	if len(grid) != 2 {
		t.Fatalf("starting grid = %d, want 2", len(grid))
	}

	raw, err := st.ListRawPayloadsBySession(sessionKey)
	if err != nil {
		t.Fatalf("ListRawPayloadsBySession() error = %v", err)
	}
	if len(raw) != 11 {
		t.Fatalf("raw payloads = %d, want 11", len(raw))
	}

	stints, err := st.ListStints(sessionKey)
	if err != nil || len(stints) != 2 {
		t.Fatalf("stints = %+v, err = %v, want 2", stints, err)
	}
	positions, err := st.ListPositionSamples(sessionKey)
	if err != nil || len(positions) != 3 {
		t.Fatalf("positions = %+v, err = %v, want 3", positions, err)
	}
}

func TestIngestSessionIsIdempotent(t *testing.T) {
	_, sessionKey, src := testSessionFixtures()
	st := openTestStore(t)

	opts := DefaultOptions()
	opts.RequestDelay = 0
	svc := NewService(st, src, opts)

	if _, err := svc.IngestSession(sessionKey); err != nil {
		t.Fatalf("first IngestSession() error = %v", err)
	}
	if _, err := svc.IngestSession(sessionKey); err != nil {
		t.Fatalf("second IngestSession() error = %v", err)
	}

	count := func(query string) int {
		var n int
		if err := st.DB().QueryRow(query, sessionKey).Scan(&n); err != nil {
			t.Fatalf("count query failed: %v", err)
		}
		return n
	}

	if got := count(`SELECT COUNT(*) FROM session_drivers WHERE session_key = ?`); got != 2 {
		t.Fatalf("session_drivers count = %d, want 2", got)
	}
	if got := count(`SELECT COUNT(*) FROM session_results WHERE session_key = ?`); got != 2 {
		t.Fatalf("session_results count = %d, want 2", got)
	}
	if got := count(`SELECT COUNT(*) FROM starting_grid WHERE session_key = ?`); got != 2 {
		t.Fatalf("starting_grid count = %d, want 2", got)
	}
}

func TestDryRunDoesNotWriteDomainRows(t *testing.T) {
	_, sessionKey, src := testSessionFixtures()
	st := openTestStore(t)

	opts := DefaultOptions()
	opts.DryRun = true
	opts.RequestDelay = 0
	svc := NewService(st, src, opts)

	summary, err := svc.IngestSession(sessionKey)
	if err != nil {
		t.Fatalf("IngestSession() error = %v", err)
	}
	if summary.Status != "dry_run" {
		t.Fatalf("summary.Status = %q, want dry_run", summary.Status)
	}

	var driverCount int
	if err := st.DB().QueryRow(`SELECT COUNT(*) FROM drivers`).Scan(&driverCount); err != nil {
		t.Fatalf("count drivers: %v", err)
	}
	if driverCount != 0 {
		t.Fatalf("drivers written during dry-run = %d, want 0", driverCount)
	}

	var rawCount int
	if err := st.DB().QueryRow(`SELECT COUNT(*) FROM raw_payloads`).Scan(&rawCount); err != nil {
		t.Fatalf("count raw payloads: %v", err)
	}
	if rawCount != 0 {
		t.Fatalf("raw payloads written during dry-run = %d, want 0", rawCount)
	}
}

func TestSourceErrorStopsRun(t *testing.T) {
	_, sessionKey, src := testSessionFixtures()
	src.failOn = "session_result"
	st := openTestStore(t)

	opts := DefaultOptions()
	opts.RequestDelay = 0
	svc := NewService(st, src, opts)

	summary, err := svc.IngestSession(sessionKey)
	if err == nil {
		t.Fatal("IngestSession() expected error, got nil")
	}
	if summary.Status != "failed" {
		t.Fatalf("summary.Status = %q, want failed", summary.Status)
	}

	var resultCount int
	if err := st.DB().QueryRow(`SELECT COUNT(*) FROM session_results WHERE session_key = ?`, sessionKey).Scan(&resultCount); err != nil {
		t.Fatalf("count session_results: %v", err)
	}
	if resultCount != 0 {
		t.Fatalf("session_results after failure = %d, want 0", resultCount)
	}
}

func TestLiveSessionLockoutSurfacesControlledFailure(t *testing.T) {
	_, sessionKey, src := testSessionFixtures()
	src.liveLockout = true
	st := openTestStore(t)

	opts := DefaultOptions()
	opts.RequestDelay = 0
	svc := NewService(st, src, opts)

	_, err := svc.IngestSession(sessionKey)
	if err == nil {
		t.Fatal("IngestSession() expected live lockout error, got nil")
	}
	if !api.IsLiveSessionError(err) {
		t.Fatalf("error = %v, want live session lockout", err)
	}
}

func TestIngestYearAndMeeting(t *testing.T) {
	src := newFakeSource()
	src.meetingsByYear[2025] = []models.Meeting{
		{MeetingKey: 100, MeetingName: "Bahrain", Year: 2025},
		{MeetingKey: 101, MeetingName: "Saudi Arabia", Year: 2025},
	}
	src.meetingsByKey[100] = src.meetingsByYear[2025][:1]
	src.sessionsByMeeting[100] = []models.Session{
		{SessionKey: 9001, MeetingKey: 100, SessionName: "Race", SessionType: "Race"},
	}

	st := openTestStore(t)
	opts := DefaultOptions()
	opts.RequestDelay = 0
	svc := NewService(st, src, opts)

	yearSummary, err := svc.IngestYear(2025)
	if err != nil {
		t.Fatalf("IngestYear() error = %v", err)
	}
	if yearSummary.Meetings != 2 {
		t.Fatalf("year meetings = %d, want 2", yearSummary.Meetings)
	}

	meetingSummary, err := svc.IngestMeeting(100)
	if err != nil {
		t.Fatalf("IngestMeeting() error = %v", err)
	}
	if meetingSummary.Sessions != 1 {
		t.Fatalf("meeting sessions = %d, want 1", meetingSummary.Sessions)
	}
}
