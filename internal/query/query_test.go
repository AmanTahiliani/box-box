package query

import (
	"database/sql"
	"errors"
	"path/filepath"
	"testing"

	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/store"
)

func openTestService(t *testing.T) *Service {
	t.Helper()

	dir := t.TempDir()
	path := filepath.Join(dir, "test.db")

	st, err := store.Open(path)
	if err != nil {
		t.Fatalf("store.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return NewService(st)
}

func seedRaceHubData(t *testing.T, st *store.Store) {
	t.Helper()

	meetingKey := 1229
	sessionKey := 9472

	if err := st.UpsertMeeting(store.Meeting{
		MeetingKey:          meetingKey,
		MeetingName:         "Monaco",
		MeetingOfficialName: "FORMULA 1 GRAND PRIX DE MONACO 2025",
		Location:            "Monaco",
		CountryCode:         "MON",
		CountryName:         "Monaco",
		CircuitKey:          10,
		CircuitShortName:    "Monaco",
		Year:                2025,
		DateStart:           "2025-05-23T00:00:00+00:00",
		DateEnd:             "2025-05-25T00:00:00+00:00",
	}); err != nil {
		t.Fatalf("UpsertMeeting() error = %v", err)
	}
	if err := st.UpsertSession(store.Session{
		SessionKey:  sessionKey,
		MeetingKey:  meetingKey,
		SessionName: "Race",
		SessionType: "Race",
		CircuitKey:  10,
		DateStart:   "2025-05-25T13:00:00+00:00",
		DateEnd:     "2025-05-25T15:00:00+00:00",
	}); err != nil {
		t.Fatalf("UpsertSession() error = %v", err)
	}
	if err := st.UpsertDriver(store.Driver{
		DriverNumber: 1,
		FullName:     "Max Verstappen",
		NameAcronym:  "VER",
		TeamName:     "Red Bull Racing",
		TeamColour:   "3671C6",
	}); err != nil {
		t.Fatalf("UpsertDriver() error = %v", err)
	}
	if err := st.UpsertSessionDriver(store.SessionDriver{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
		TeamName:     "Red Bull Racing",
		TeamColour:   "3671C6",
	}); err != nil {
		t.Fatalf("UpsertSessionDriver() error = %v", err)
	}
	if err := st.UpsertStartingGridEntry(store.StartingGridEntry{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
		Position:     1,
		LapDuration:  71.234,
	}); err != nil {
		t.Fatalf("UpsertStartingGridEntry() error = %v", err)
	}
}

func TestGetRaceHubMissingSession(t *testing.T) {
	svc := openTestService(t)

	hub, err := svc.GetRaceHub(9472)
	if err != nil {
		t.Fatalf("GetRaceHub() error = %v", err)
	}
	if hub.Source != ResponseSourceNone {
		t.Fatalf("Source = %q, want %q", hub.Source, ResponseSourceNone)
	}
	if hub.Datasets["session"].Status != DatasetStatusMissing {
		t.Fatalf("session status = %q, want %q", hub.Datasets["session"].Status, DatasetStatusMissing)
	}
	if hub.Meeting != nil || hub.Session != nil {
		t.Fatal("expected no meeting/session for missing session")
	}
}

func TestGetRaceHubPartialData(t *testing.T) {
	svc := openTestService(t)
	seedRaceHubData(t, svc.store)

	hub, err := svc.GetRaceHub(9472)
	if err != nil {
		t.Fatalf("GetRaceHub() error = %v", err)
	}
	if hub.Source != ResponseSourcePartial {
		t.Fatalf("Source = %q, want %q", hub.Source, ResponseSourcePartial)
	}
	if hub.Session == nil || hub.Meeting == nil {
		t.Fatal("expected meeting and session")
	}
	if len(hub.Drivers) != 1 || hub.Drivers[0].NameAcronym != "VER" {
		t.Fatalf("Drivers = %+v, want one VER entry", hub.Drivers)
	}
	if hub.Datasets["results"].Status != DatasetStatusMissing {
		t.Fatalf("results status = %q, want %q", hub.Datasets["results"].Status, DatasetStatusMissing)
	}
	if len(hub.StartingGrid) != 1 {
		t.Fatalf("StartingGrid len = %d, want 1", len(hub.StartingGrid))
	}
	if hub.StartingGrid[0].NameAcronym != "VER" {
		t.Fatalf("StartingGrid driver = %+v, want enriched VER", hub.StartingGrid[0])
	}
}

func TestGetRaceHubCompleteData(t *testing.T) {
	svc := openTestService(t)
	seedRaceHubData(t, svc.store)

	if err := svc.store.UpsertSessionResult(store.SessionResult{
		SessionKey:      9472,
		DriverNumber:    1,
		MeetingKey:      1229,
		Position:        1,
		Points:          25,
		NumberOfLaps:    78,
		DurationJSON:    "5234.567",
		GapToLeaderJSON: "0",
	}); err != nil {
		t.Fatalf("UpsertSessionResult() error = %v", err)
	}

	hub, err := svc.GetRaceHub(9472)
	if err != nil {
		t.Fatalf("GetRaceHub() error = %v", err)
	}
	if hub.Source != ResponseSourcePartial {
		t.Fatalf("Source = %q, want %q (core datasets complete, analytics missing)", hub.Source, ResponseSourcePartial)
	}
	if len(hub.Results) != 1 {
		t.Fatalf("Results len = %d, want 1", len(hub.Results))
	}
	if hub.Results[0].FullName != "Max Verstappen" {
		t.Fatalf("Results[0].FullName = %q, want Max Verstappen", hub.Results[0].FullName)
	}
	if hub.Datasets["results"].Count != 1 {
		t.Fatalf("results count = %d, want 1", hub.Datasets["results"].Count)
	}
}

func TestListMeetingsByYear(t *testing.T) {
	svc := openTestService(t)
	seedRaceHubData(t, svc.store)

	meetings, err := svc.ListMeetingsByYear(2025)
	if err != nil {
		t.Fatalf("ListMeetingsByYear() error = %v", err)
	}
	if len(meetings) != 1 || meetings[0].MeetingName != "Monaco" {
		t.Fatalf("ListMeetingsByYear() = %+v, want Monaco meeting", meetings)
	}

	empty, err := svc.ListMeetingsByYear(2024)
	if err != nil {
		t.Fatalf("ListMeetingsByYear(2024) error = %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("ListMeetingsByYear(2024) len = %d, want 0", len(empty))
	}
}

func TestGetRaceHubAnalyticsDatasets(t *testing.T) {
	svc := openTestService(t)
	seedRaceHubData(t, svc.store)

	sessionKey := 9472
	meetingKey := 1229

	if err := svc.store.UpsertStint(store.Stint{
		SessionKey: sessionKey, DriverNumber: 1, MeetingKey: meetingKey,
		StintNumber: 1, Compound: "MEDIUM", LapStart: 1, LapEnd: 30,
	}); err != nil {
		t.Fatalf("UpsertStint() error = %v", err)
	}
	if err := svc.store.UpsertPositionSample(store.PositionSample{
		SessionKey: sessionKey, DriverNumber: 1, MeetingKey: meetingKey,
		Date: "2025-05-25T13:05:00+00:00", Position: 1,
	}); err != nil {
		t.Fatalf("UpsertPositionSample() error = %v", err)
	}

	hub, err := svc.GetRaceHub(sessionKey)
	if err != nil {
		t.Fatalf("GetRaceHub() error = %v", err)
	}
	if hub.Datasets["stints"].Status != DatasetStatusAvailable {
		t.Fatalf("stints status = %+v, want available", hub.Datasets["stints"])
	}
	if hub.Datasets["positions"].Status != DatasetStatusAvailable {
		t.Fatalf("positions status = %+v, want available", hub.Datasets["positions"])
	}
	if len(hub.Stints) != 1 || hub.Stints[0].Compound != models.CompoundMedium {
		t.Fatalf("Stints = %+v, want one MEDIUM stint", hub.Stints)
	}
	if len(hub.Positions) != 1 {
		t.Fatalf("Positions len = %d, want 1", len(hub.Positions))
	}
	if hub.Datasets["pit_stops"].Status != DatasetStatusMissing {
		t.Fatalf("pit_stops status = %+v, want missing", hub.Datasets["pit_stops"])
	}
}

func TestListDriversRequiresSession(t *testing.T) {
	svc := openTestService(t)

	_, err := svc.ListDrivers(9472)
	if err == nil {
		t.Fatal("ListDrivers() error = nil, want sql.ErrNoRows")
	}
	if err != sql.ErrNoRows {
		t.Fatalf("ListDrivers() error = %v, want sql.ErrNoRows", err)
	}
}

func TestListSeasonsEmpty(t *testing.T) {
	svc := openTestService(t)

	years, err := svc.ListSeasons()
	if err != nil {
		t.Fatalf("ListSeasons() error = %v", err)
	}
	if len(years) != 0 {
		t.Fatalf("ListSeasons() = %v, want empty", years)
	}
}

func TestListSeasonsWithData(t *testing.T) {
	svc := openTestService(t)
	seedRaceHubData(t, svc.store)

	years, err := svc.ListSeasons()
	if err != nil {
		t.Fatalf("ListSeasons() error = %v", err)
	}
	if len(years) != 1 || years[0] != 2025 {
		t.Fatalf("ListSeasons() = %v, want [2025]", years)
	}
}

func TestGetWeekendMissingMeeting(t *testing.T) {
	svc := openTestService(t)

	_, err := svc.GetWeekend(1229)
	if err == nil {
		t.Fatal("GetWeekend() error = nil, want ErrMeetingNotFound")
	}
	if !errors.Is(err, ErrMeetingNotFound) {
		t.Fatalf("GetWeekend() error = %v, want ErrMeetingNotFound", err)
	}
}

func TestGetWeekendWithSessions(t *testing.T) {
	svc := openTestService(t)
	seedRaceHubData(t, svc.store)

	if err := svc.store.UpsertSession(store.Session{
		SessionKey:  9000,
		MeetingKey:  1229,
		SessionName: "Core Only",
		SessionType: "Race",
		DateStart:   "2025-05-24T13:00:00+00:00",
	}); err != nil {
		t.Fatalf("UpsertSession() error = %v", err)
	}
	if err := svc.store.UpsertSessionDriver(store.SessionDriver{
		SessionKey: 9000, DriverNumber: 1, MeetingKey: 1229,
	}); err != nil {
		t.Fatalf("UpsertSessionDriver() error = %v", err)
	}

	weekend, err := svc.GetWeekend(1229)
	if err != nil {
		t.Fatalf("GetWeekend() error = %v", err)
	}
	if weekend.Meeting.MeetingName != "Monaco" {
		t.Fatalf("MeetingName = %q, want Monaco", weekend.Meeting.MeetingName)
	}
	if len(weekend.Sessions) != 2 {
		t.Fatalf("Sessions len = %d, want 2", len(weekend.Sessions))
	}
	if weekend.DefaultSessionKey != 9472 {
		t.Fatalf("DefaultSessionKey = %d, want 9472 (full data session)", weekend.DefaultSessionKey)
	}
	if weekend.Sessions[0].Datasets["drivers"].Status != DatasetStatusAvailable {
		t.Fatalf("first session drivers = %+v, want available", weekend.Sessions[0].Datasets["drivers"])
	}
}
