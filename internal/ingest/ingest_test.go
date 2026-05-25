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

	return meetingKey, sessionKey, src
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
	if summary.RawPayloads != 5 {
		t.Fatalf("summary.RawPayloads = %d, want 5", summary.RawPayloads)
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
	if len(raw) != 5 {
		t.Fatalf("raw payloads = %d, want 5", len(raw))
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
