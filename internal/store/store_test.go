package store

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"
)

func openTestStore(t *testing.T) *Store {
	t.Helper()

	dir := t.TempDir()
	path := filepath.Join(dir, "test.db")

	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func TestOpenAppliesMigrations(t *testing.T) {
	s := openTestStore(t)

	version, err := s.SchemaVersion()
	if err != nil {
		t.Fatalf("SchemaVersion() error = %v", err)
	}
	if version != 6 {
		t.Fatalf("SchemaVersion() = %d, want 6", version)
	}

	tables := []string{
		"schema_migrations",
		"raw_payloads",
		"ingestion_runs",
		"meetings",
		"sessions",
		"drivers",
		"session_drivers",
		"session_results",
		"starting_grid",
		"stints",
		"pit_stops",
		"positions",
		"race_control",
		"weather",
		"laps",
		"news_sources",
		"news_items",
		"session_coverage",
	}
	for _, table := range tables {
		var name string
		err := s.db.QueryRow(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
			table,
		).Scan(&name)
		if err != nil {
			t.Fatalf("table %q missing: %v", table, err)
		}
	}
}

func TestMigrationsAreIdempotent(t *testing.T) {
	s := openTestStore(t)

	if err := s.applyMigrations(); err != nil {
		t.Fatalf("second applyMigrations() error = %v", err)
	}
	if err := s.applyMigrations(); err != nil {
		t.Fatalf("third applyMigrations() error = %v", err)
	}

	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 1`).Scan(&count); err != nil {
		t.Fatalf("count schema_migrations: %v", err)
	}
	if count != 1 {
		t.Fatalf("schema_migrations count = %d, want 1", count)
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 2`).Scan(&count); err != nil {
		t.Fatalf("count schema_migrations v2: %v", err)
	}
	if count != 1 {
		t.Fatalf("schema_migrations v2 count = %d, want 1", count)
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 3`).Scan(&count); err != nil {
		t.Fatalf("count schema_migrations v3: %v", err)
	}
	if count != 1 {
		t.Fatalf("schema_migrations v3 count = %d, want 1", count)
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 4`).Scan(&count); err != nil {
		t.Fatalf("count schema_migrations v4: %v", err)
	}
	if count != 1 {
		t.Fatalf("schema_migrations v4 count = %d, want 1", count)
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 5`).Scan(&count); err != nil {
		t.Fatalf("count schema_migrations v5: %v", err)
	}
	if count != 1 {
		t.Fatalf("schema_migrations v5 count = %d, want 1", count)
	}
}

func TestRawPayloadInsertAndRead(t *testing.T) {
	s := openTestStore(t)

	meetingKey := 1229
	sessionKey := 9472
	fetchedAt := time.Unix(1710000000, 0).UTC()

	payload := RawPayload{
		Source:         "openf1",
		Endpoint:       "session_result",
		RequestKey:     "session_key=9472",
		MeetingKey:     &meetingKey,
		SessionKey:     &sessionKey,
		Payload:        `[{"position":1,"driver_number":1}]`,
		PayloadHash:    "abc123",
		FetchedAt:      fetchedAt,
		ProvenanceJSON: `{"status":"ok","http_status":200}`,
	}

	id, inserted, err := s.InsertRawPayload(payload)
	if err != nil {
		t.Fatalf("InsertRawPayload() error = %v", err)
	}
	if !inserted {
		t.Fatal("InsertRawPayload() inserted = false, want true")
	}
	if id <= 0 {
		t.Fatalf("InsertRawPayload() id = %d, want > 0", id)
	}

	got, err := s.GetRawPayload(id)
	if err != nil {
		t.Fatalf("GetRawPayload() error = %v", err)
	}

	if got.Source != payload.Source ||
		got.Endpoint != payload.Endpoint ||
		got.RequestKey != payload.RequestKey ||
		got.Payload != payload.Payload ||
		got.PayloadHash != payload.PayloadHash ||
		got.ProvenanceJSON != payload.ProvenanceJSON {
		t.Fatalf("GetRawPayload() = %+v, want provenance preserved", got)
	}
	if got.MeetingKey == nil || *got.MeetingKey != meetingKey {
		t.Fatalf("MeetingKey = %v, want %d", got.MeetingKey, meetingKey)
	}
	if got.SessionKey == nil || *got.SessionKey != sessionKey {
		t.Fatalf("SessionKey = %v, want %d", got.SessionKey, sessionKey)
	}
	if !got.FetchedAt.Equal(fetchedAt) {
		t.Fatalf("FetchedAt = %v, want %v", got.FetchedAt, fetchedAt)
	}

	rows, err := s.ListRawPayloadsBySession(sessionKey)
	if err != nil {
		t.Fatalf("ListRawPayloadsBySession() error = %v", err)
	}
	if len(rows) != 1 || rows[0].ID != id {
		t.Fatalf("ListRawPayloadsBySession() = %+v, want one row id=%d", rows, id)
	}
}

func TestRawPayloadDuplicateIsIdempotent(t *testing.T) {
	s := openTestStore(t)

	payload := RawPayload{
		Source:      "openf1",
		Endpoint:    "meetings",
		RequestKey:  "year=2025",
		Payload:     `[{"meeting_key":1229}]`,
		PayloadHash: "dup-hash",
	}

	firstID, inserted, err := s.InsertRawPayload(payload)
	if err != nil {
		t.Fatalf("first InsertRawPayload() error = %v", err)
	}
	if !inserted {
		t.Fatal("first insert should succeed")
	}

	secondID, inserted, err := s.InsertRawPayload(payload)
	if err != nil {
		t.Fatalf("second InsertRawPayload() error = %v", err)
	}
	if inserted {
		t.Fatal("duplicate insert should not create a new row")
	}
	if secondID != firstID {
		t.Fatalf("duplicate id = %d, want %d", secondID, firstID)
	}

	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM raw_payloads`).Scan(&count); err != nil {
		t.Fatalf("count raw_payloads: %v", err)
	}
	if count != 1 {
		t.Fatalf("raw_payloads count = %d, want 1", count)
	}
}

func TestMeetingSessionDriverUpsertsAreIdempotent(t *testing.T) {
	s := openTestStore(t)

	meeting := Meeting{
		MeetingKey:          1229,
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
	}
	updatedMeeting := meeting
	updatedMeeting.MeetingName = "Monaco GP"

	for i := 0; i < 2; i++ {
		m := meeting
		if i == 1 {
			m = updatedMeeting
		}
		if err := s.UpsertMeeting(m); err != nil {
			t.Fatalf("UpsertMeeting(%d) error = %v", i, err)
		}
	}

	gotMeeting, err := s.GetMeeting(meeting.MeetingKey)
	if err != nil {
		t.Fatalf("GetMeeting() error = %v", err)
	}
	if gotMeeting.MeetingName != updatedMeeting.MeetingName {
		t.Fatalf("MeetingName = %q, want %q", gotMeeting.MeetingName, updatedMeeting.MeetingName)
	}

	var meetingCount int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM meetings`).Scan(&meetingCount); err != nil {
		t.Fatalf("count meetings: %v", err)
	}
	if meetingCount != 1 {
		t.Fatalf("meetings count = %d, want 1", meetingCount)
	}

	session := Session{
		SessionKey:  9472,
		MeetingKey:  meeting.MeetingKey,
		SessionName: "Race",
		SessionType: "Race",
		CircuitKey:  10,
		DateStart:   "2025-05-25T13:00:00+00:00",
	}
	updatedSession := session
	updatedSession.DateEnd = "2025-05-25T15:00:00+00:00"

	for i := 0; i < 2; i++ {
		sess := session
		if i == 1 {
			sess = updatedSession
		}
		if err := s.UpsertSession(sess); err != nil {
			t.Fatalf("UpsertSession(%d) error = %v", i, err)
		}
	}

	gotSession, err := s.GetSession(session.SessionKey)
	if err != nil {
		t.Fatalf("GetSession() error = %v", err)
	}
	if gotSession.DateEnd != updatedSession.DateEnd {
		t.Fatalf("DateEnd = %q, want %q", gotSession.DateEnd, updatedSession.DateEnd)
	}

	driver := Driver{
		DriverNumber: 1,
		FullName:     "Max Verstappen",
		NameAcronym:  "VER",
		TeamName:     "Red Bull Racing",
		TeamColour:   "3671C6",
	}
	updatedDriver := driver
	updatedDriver.TeamName = "Oracle Red Bull Racing"

	for i := 0; i < 2; i++ {
		d := driver
		if i == 1 {
			d = updatedDriver
		}
		if err := s.UpsertDriver(d); err != nil {
			t.Fatalf("UpsertDriver(%d) error = %v", i, err)
		}
	}

	gotDriver, err := s.GetDriver(driver.DriverNumber)
	if err != nil {
		t.Fatalf("GetDriver() error = %v", err)
	}
	if gotDriver.TeamName != updatedDriver.TeamName {
		t.Fatalf("TeamName = %q, want %q", gotDriver.TeamName, updatedDriver.TeamName)
	}

	sessionDriver := SessionDriver{
		SessionKey:   session.SessionKey,
		DriverNumber: driver.DriverNumber,
		MeetingKey:   meeting.MeetingKey,
		TeamName:     "Red Bull Racing",
		TeamColour:   "3671C6",
	}
	if err := s.UpsertSessionDriver(sessionDriver); err != nil {
		t.Fatalf("UpsertSessionDriver() error = %v", err)
	}
	if err := s.UpsertSessionDriver(sessionDriver); err != nil {
		t.Fatalf("second UpsertSessionDriver() error = %v", err)
	}

	meetings, err := s.ListMeetingsByYear(2025)
	if err != nil {
		t.Fatalf("ListMeetingsByYear() error = %v", err)
	}
	if len(meetings) != 1 {
		t.Fatalf("ListMeetingsByYear() len = %d, want 1", len(meetings))
	}

	sessions, err := s.ListSessionsByMeeting(meeting.MeetingKey)
	if err != nil {
		t.Fatalf("ListSessionsByMeeting() error = %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("ListSessionsByMeeting() len = %d, want 1", len(sessions))
	}

	years, err := s.ListYears()
	if err != nil {
		t.Fatalf("ListYears() error = %v", err)
	}
	if len(years) != 1 || years[0] != 2025 {
		t.Fatalf("ListYears() = %v, want [2025]", years)
	}

	counts, err := s.CountSessionDatasets(session.SessionKey)
	if err != nil {
		t.Fatalf("CountSessionDatasets() error = %v", err)
	}
	if counts.Drivers != 1 {
		t.Fatalf("CountSessionDatasets().Drivers = %d, want 1", counts.Drivers)
	}
	if counts.Results != 0 {
		t.Fatalf("CountSessionDatasets().Results = %d, want 0", counts.Results)
	}

	sessionDrivers, err := s.ListSessionDrivers(session.SessionKey)
	if err != nil {
		t.Fatalf("ListSessionDrivers() error = %v", err)
	}
	if len(sessionDrivers) != 1 {
		t.Fatalf("ListSessionDrivers() len = %d, want 1", len(sessionDrivers))
	}
}

func TestSessionResultAndStartingGridUpsertRead(t *testing.T) {
	s := openTestStore(t)

	meetingKey := 1229
	sessionKey := 9472

	if err := s.UpsertMeeting(Meeting{
		MeetingKey:  meetingKey,
		MeetingName: "Monaco",
		Year:        2025,
	}); err != nil {
		t.Fatalf("UpsertMeeting() error = %v", err)
	}
	if err := s.UpsertSession(Session{
		SessionKey:  sessionKey,
		MeetingKey:  meetingKey,
		SessionName: "Race",
		SessionType: "Race",
	}); err != nil {
		t.Fatalf("UpsertSession() error = %v", err)
	}

	result := SessionResult{
		SessionKey:      sessionKey,
		DriverNumber:    1,
		MeetingKey:      meetingKey,
		Position:        1,
		Points:          25,
		NumberOfLaps:    78,
		DurationJSON:    "5234.567",
		GapToLeaderJSON: "0",
	}
	updatedResult := result
	updatedResult.Points = 26

	for i := 0; i < 2; i++ {
		r := result
		if i == 1 {
			r = updatedResult
		}
		if err := s.UpsertSessionResult(r); err != nil {
			t.Fatalf("UpsertSessionResult(%d) error = %v", i, err)
		}
	}

	results, err := s.ListSessionResults(sessionKey)
	if err != nil {
		t.Fatalf("ListSessionResults() error = %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("ListSessionResults() len = %d, want 1", len(results))
	}
	if results[0].Points != updatedResult.Points {
		t.Fatalf("Points = %v, want %v", results[0].Points, updatedResult.Points)
	}

	grid := StartingGridEntry{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
		Position:     1,
		LapDuration:  71.234,
	}
	updatedGrid := grid
	updatedGrid.LapDuration = 71.111

	for i := 0; i < 2; i++ {
		g := grid
		if i == 1 {
			g = updatedGrid
		}
		if err := s.UpsertStartingGridEntry(g); err != nil {
			t.Fatalf("UpsertStartingGridEntry(%d) error = %v", i, err)
		}
	}

	grids, err := s.ListStartingGrid(sessionKey)
	if err != nil {
		t.Fatalf("ListStartingGrid() error = %v", err)
	}
	if len(grids) != 1 {
		t.Fatalf("ListStartingGrid() len = %d, want 1", len(grids))
	}
	if grids[0].LapDuration != updatedGrid.LapDuration {
		t.Fatalf("LapDuration = %v, want %v", grids[0].LapDuration, updatedGrid.LapDuration)
	}

	var resultCount int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM session_results`).Scan(&resultCount); err != nil {
		t.Fatalf("count session_results: %v", err)
	}
	if resultCount != 1 {
		t.Fatalf("session_results count = %d, want 1", resultCount)
	}
}

func TestListSessionResultsSortsNonFinishersLast(t *testing.T) {
	s := openTestStore(t)

	meetingKey := 1230
	sessionKey := 9473

	if err := s.UpsertMeeting(Meeting{
		MeetingKey:  meetingKey,
		MeetingName: "Test GP",
		Year:        2025,
	}); err != nil {
		t.Fatalf("UpsertMeeting() error = %v", err)
	}
	if err := s.UpsertSession(Session{
		SessionKey:  sessionKey,
		MeetingKey:  meetingKey,
		SessionName: "Race",
		SessionType: "Race",
	}); err != nil {
		t.Fatalf("UpsertSession() error = %v", err)
	}

	entries := []SessionResult{
		{SessionKey: sessionKey, DriverNumber: 55, MeetingKey: meetingKey, Position: 0, DNF: true},
		{SessionKey: sessionKey, DriverNumber: 10, MeetingKey: meetingKey, Position: 0, DNS: true},
		{SessionKey: sessionKey, DriverNumber: 1, MeetingKey: meetingKey, Position: 1, Points: 25},
		{SessionKey: sessionKey, DriverNumber: 44, MeetingKey: meetingKey, Position: 2, Points: 18},
	}
	for _, r := range entries {
		if err := s.UpsertSessionResult(r); err != nil {
			t.Fatalf("UpsertSessionResult(%d) error = %v", r.DriverNumber, err)
		}
	}

	results, err := s.ListSessionResults(sessionKey)
	if err != nil {
		t.Fatalf("ListSessionResults() error = %v", err)
	}
	if len(results) != len(entries) {
		t.Fatalf("ListSessionResults() len = %d, want %d", len(results), len(entries))
	}

	wantOrder := []int{1, 44, 10, 55}
	for i, want := range wantOrder {
		if results[i].DriverNumber != want {
			t.Fatalf("results[%d].DriverNumber = %d, want %d", i, results[i].DriverNumber, want)
		}
	}
}

func TestAnalyticsUpsertRead(t *testing.T) {
	s := openTestStore(t)

	meetingKey := 1229
	sessionKey := 9472

	stint := Stint{
		SessionKey:     sessionKey,
		DriverNumber:   1,
		MeetingKey:     meetingKey,
		StintNumber:    1,
		Compound:       "SOFT",
		LapStart:       1,
		LapEnd:         20,
		TyreAgeAtStart: 0,
	}
	if err := s.UpsertStint(stint); err != nil {
		t.Fatalf("UpsertStint() error = %v", err)
	}
	stints, err := s.ListStints(sessionKey)
	if err != nil || len(stints) != 1 || stints[0].Compound != "SOFT" {
		t.Fatalf("ListStints() = %+v, err = %v", stints, err)
	}

	pit := PitStop{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
		LapNumber:    21,
		Date:         "2025-05-25T14:00:00+00:00",
		StopDuration: 2.5,
	}
	if err := s.UpsertPitStop(pit); err != nil {
		t.Fatalf("UpsertPitStop() error = %v", err)
	}
	pits, err := s.ListPitStops(sessionKey)
	if err != nil || len(pits) != 1 {
		t.Fatalf("ListPitStops() = %+v, err = %v", pits, err)
	}

	pos := PositionSample{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
		Date:         "2025-05-25T14:05:00+00:00",
		Position:     1,
	}
	if err := s.UpsertPositionSample(pos); err != nil {
		t.Fatalf("UpsertPositionSample() error = %v", err)
	}
	positions, err := s.ListPositionSamples(sessionKey)
	if err != nil || len(positions) != 1 {
		t.Fatalf("ListPositionSamples() = %+v, err = %v", positions, err)
	}

	rc := RaceControlMessage{
		SessionKey: sessionKey,
		MeetingKey: meetingKey,
		Date:       "2025-05-25T14:10:00+00:00",
		Category:   "Flag",
		Flag:       "YELLOW",
		Message:    "Yellow flag sector 1",
		Scope:      "Track",
	}
	if err := s.UpsertRaceControlMessage(rc); err != nil {
		t.Fatalf("UpsertRaceControlMessage() error = %v", err)
	}
	messages, err := s.ListRaceControlMessages(sessionKey)
	if err != nil || len(messages) != 1 {
		t.Fatalf("ListRaceControlMessages() = %+v, err = %v", messages, err)
	}

	weather := WeatherSample{
		SessionKey:       sessionKey,
		MeetingKey:       meetingKey,
		Date:             "2025-05-25T14:00:00+00:00",
		AirTemperature:   22.5,
		TrackTemperature: 35.0,
		Humidity:         45.0,
	}
	if err := s.UpsertWeatherSample(weather); err != nil {
		t.Fatalf("UpsertWeatherSample() error = %v", err)
	}
	samples, err := s.ListWeatherSamples(sessionKey)
	if err != nil || len(samples) != 1 {
		t.Fatalf("ListWeatherSamples() = %+v, err = %v", samples, err)
	}

	lap := Lap{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
		LapNumber:    1,
		LapDuration:  75.123,
	}
	if err := s.UpsertLap(lap); err != nil {
		t.Fatalf("UpsertLap() error = %v", err)
	}
	laps, err := s.ListLaps(sessionKey)
	if err != nil || len(laps) != 1 {
		t.Fatalf("ListLaps() = %+v, err = %v", laps, err)
	}
}

func TestNewsUpsertRead(t *testing.T) {
	s := openTestStore(t)
	now := time.Unix(1800000000, 0).UTC()
	expires := now.Add(30 * time.Minute)

	if err := s.UpsertNewsSource(NewsSource{
		Source:    "bbc-f1",
		Name:      "BBC Sport F1",
		FeedURL:   "https://feeds.bbci.co.uk/sport/formula1",
		Category:  "news",
		Enabled:   true,
		FetchedAt: &now,
		ExpiresAt: &expires,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("UpsertNewsSource() error = %v", err)
	}

	published := now.Add(-time.Hour)
	item := NewsItem{
		URL:         "https://example.com/f1/story",
		Source:      "bbc-f1",
		Title:       "Paddock update",
		PublishedAt: &published,
		Summary:     "Short briefing text",
		Category:    "news",
		FetchedAt:   now,
	}
	if err := s.UpsertNewsItem(item); err != nil {
		t.Fatalf("UpsertNewsItem() error = %v", err)
	}
	updated := item
	updated.Title = "Paddock update revised"
	if err := s.UpsertNewsItem(updated); err != nil {
		t.Fatalf("second UpsertNewsItem() error = %v", err)
	}

	items, err := s.ListNewsItems(10, "bbc-f1")
	if err != nil {
		t.Fatalf("ListNewsItems() error = %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("items len = %d, want 1", len(items))
	}
	if items[0].Title != updated.Title {
		t.Fatalf("title = %q, want %q", items[0].Title, updated.Title)
	}
	if items[0].PublishedAt == nil || !items[0].PublishedAt.Equal(published) {
		t.Fatalf("published_at = %v, want %v", items[0].PublishedAt, published)
	}
}

func TestWithTxRollback(t *testing.T) {
	s := openTestStore(t)

	err := s.WithTx(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`
			INSERT INTO meetings (meeting_key, meeting_name, year, updated_at)
			VALUES (999, 'Rollback Test', 2025, ?)
		`, time.Now().Unix()); err != nil {
			return err
		}
		return assertAnError("rollback")
	})
	if err == nil {
		t.Fatal("WithTx() error = nil, want rollback error")
	}

	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM meetings WHERE meeting_key = 999`).Scan(&count); err != nil {
		t.Fatalf("count meetings: %v", err)
	}
	if count != 0 {
		t.Fatalf("meetings count after rollback = %d, want 0", count)
	}
}

func assertAnError(msg string) error {
	return &testError{msg: msg}
}

type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}
