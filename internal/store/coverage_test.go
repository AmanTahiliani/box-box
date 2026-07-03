package store

import (
	"testing"
)

func TestCoverageCRUD(t *testing.T) {
	s := openTestStore(t)

	// Verify all migrations are applied.
	version, err := s.SchemaVersion()
	if err != nil {
		t.Fatalf("SchemaVersion() error = %v", err)
	}
	if version != 7 {
		t.Fatalf("SchemaVersion() = %d, want 7", version)
	}

	// Verify session_coverage table exists
	var tableName string
	err = s.db.QueryRow(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'session_coverage'`,
	).Scan(&tableName)
	if err != nil {
		t.Fatalf("session_coverage table is missing: %v", err)
	}

	// Insert meeting and session to test GetSeasonCoverage joins
	meetingKey := 1234
	sessionKey := 5678
	year := 2024

	if err := s.UpsertMeeting(Meeting{
		MeetingKey:  meetingKey,
		MeetingName: "Test Grand Prix",
		Year:        year,
		DateStart:   "2024-03-01T12:00:00Z",
	}); err != nil {
		t.Fatalf("UpsertMeeting() error = %v", err)
	}

	if err := s.UpsertSession(Session{
		SessionKey:  sessionKey,
		MeetingKey:  meetingKey,
		SessionName: "Qualifying",
		SessionType: "Qualifying",
		DateStart:   "2024-03-02T14:00:00Z",
	}); err != nil {
		t.Fatalf("UpsertSession() error = %v", err)
	}

	// 1. Test empty session coverage
	cov, err := s.GetSessionCoverage(sessionKey)
	if err != nil {
		t.Fatalf("GetSessionCoverage() error = %v", err)
	}
	if len(cov) != 0 {
		t.Fatalf("Expected empty coverage, got: %v", cov)
	}

	// 2. Upsert multiple datasets
	err = s.UpsertCoverage(sessionKey, "drivers", "complete", 20, "")
	if err != nil {
		t.Fatalf("UpsertCoverage() drivers error = %v", err)
	}
	err = s.UpsertCoverage(sessionKey, "laps", "failed", 0, "429 Rate Limit")
	if err != nil {
		t.Fatalf("UpsertCoverage() laps error = %v", err)
	}

	// 3. Retrieve session coverage
	cov, err = s.GetSessionCoverage(sessionKey)
	if err != nil {
		t.Fatalf("GetSessionCoverage() error = %v", err)
	}
	if len(cov) != 2 {
		t.Fatalf("Expected coverage size 2, got: %d", len(cov))
	}

	drv, ok := cov["drivers"]
	if !ok {
		t.Fatalf("Expected 'drivers' key to exist in coverage map")
	}
	if drv.Status != "complete" || drv.RowCount != 20 || drv.ErrorMsg != "" {
		t.Fatalf("Unexpected drivers status: %+v", drv)
	}

	laps, ok := cov["laps"]
	if !ok {
		t.Fatalf("Expected 'laps' key to exist in coverage map")
	}
	if laps.Status != "failed" || laps.RowCount != 0 || laps.ErrorMsg != "429 Rate Limit" {
		t.Fatalf("Unexpected laps status: %+v", laps)
	}

	// 4. Test updates (idempotency/upsert)
	err = s.UpsertCoverage(sessionKey, "laps", "complete", 150, "")
	if err != nil {
		t.Fatalf("UpsertCoverage() second laps error = %v", err)
	}
	cov, err = s.GetSessionCoverage(sessionKey)
	if err != nil {
		t.Fatalf("GetSessionCoverage() error = %v", err)
	}
	laps = cov["laps"]
	if laps.Status != "complete" || laps.RowCount != 150 || laps.ErrorMsg != "" {
		t.Fatalf("Expected updated laps status to be complete with 150 rows, got: %+v", laps)
	}

	// 5. Test GetSeasonCoverage joins
	seasonRows, err := s.GetSeasonCoverage(year)
	if err != nil {
		t.Fatalf("GetSeasonCoverage() error = %v", err)
	}
	if len(seasonRows) != 2 {
		t.Fatalf("Expected 2 season coverage rows, got: %d", len(seasonRows))
	}

	// The two rows should correspond to drivers and laps datasets
	for _, row := range seasonRows {
		if row.MeetingKey != meetingKey || row.MeetingName != "Test Grand Prix" {
			t.Errorf("Unexpected meeting info: %+v", row)
		}
		if row.SessionKey != sessionKey || row.SessionName != "Qualifying" {
			t.Errorf("Unexpected session info: %+v", row)
		}
		if row.Dataset != "drivers" && row.Dataset != "laps" {
			t.Errorf("Unexpected dataset: %q", row.Dataset)
		}
		if row.Status != "complete" {
			t.Errorf("Expected status to be 'complete', got %q", row.Status)
		}
	}
}
