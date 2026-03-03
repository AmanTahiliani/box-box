package api

import (
	"strings"
	"testing"
	"time"
)

const (
	testBaseURL  = "https://api.openf1.org"
	testTimeout  = 10 * time.Second
	abuDhabiRace = 9662 // 2024 Abu Dhabi Grand Prix Race session
)

func newTestClient() *OpenF1Client {
	return NewOpenF1Client(testBaseURL, testTimeout)
}

// skipOnRateLimit skips the test if err indicates the API rate-limited us (HTTP 429).
func skipOnRateLimit(t *testing.T, err error) {
	t.Helper()
	if err != nil && strings.Contains(err.Error(), "status 429") {
		t.Skip("skipping: OpenF1 API rate-limited this test run")
	}
}

func TestGetMeetingsForYear(t *testing.T) {
	client := newTestClient()

	meetings, err := client.GetMeetingsForYear(2024)
	skipOnRateLimit(t, err)
	if err != nil {
		t.Fatal(err)
	}

	if len(meetings) == 0 {
		t.Errorf("Expected meetings for 2024, got none")
	}

	for _, meeting := range meetings {
		if meeting.Year != 2024 {
			t.Errorf("Expected meeting year to be 2024, got %d", meeting.Year)
		}
	}
}

func TestGetMeetingsForYearInvalid(t *testing.T) {
	client := newTestClient()

	_, err := client.GetMeetingsForYear(-1)
	if err == nil {
		t.Errorf("Expected error for invalid year, got none")
	}
}

func TestGetSessionsForMeeting(t *testing.T) {
	client := newTestClient()

	sessions, err := client.GetSessionsForMeeting(1304)
	skipOnRateLimit(t, err)
	if err != nil {
		t.Fatal(err)
	}

	if len(sessions) == 0 {
		t.Errorf("Expected sessions for meeting key 1304, got none")
	}

	for _, session := range sessions {
		if session.MeetingKey != 1304 {
			t.Errorf("Expected session meeting key to be 1304, got %d", session.MeetingKey)
		}
	}
}

func TestGetDriversForSession(t *testing.T) {
	client := newTestClient()

	drivers, err := client.GetDriversForSession(abuDhabiRace)
	skipOnRateLimit(t, err)
	if err != nil {
		t.Fatal(err)
	}

	if len(drivers) == 0 {
		t.Errorf("Expected drivers for session %d, got none", abuDhabiRace)
	}

	for _, d := range drivers {
		if d.SessionKey != abuDhabiRace {
			t.Errorf("Expected session_key %d, got %d", abuDhabiRace, d.SessionKey)
		}
		if d.DriverNumber == 0 {
			t.Errorf("Expected non-zero driver_number")
		}
	}
}

func TestGetSessionResult(t *testing.T) {
	client := newTestClient()

	results, err := client.GetSessionResult(abuDhabiRace)
	skipOnRateLimit(t, err)
	if err != nil {
		t.Fatal(err)
	}

	if len(results) == 0 {
		t.Errorf("Expected results for session %d, got none", abuDhabiRace)
	}

	foundFinisher := false
	for _, r := range results {
		if r.SessionKey != abuDhabiRace {
			t.Errorf("Expected session_key %d, got %d", abuDhabiRace, r.SessionKey)
		}
		if r.Position == 1 {
			foundFinisher = true
			// Winner should not be DNF/DNS/DSQ
			if r.DNF || r.DNS || r.DSQ {
				t.Errorf("Race winner (position 1) should not have DNF/DNS/DSQ set")
			}
			// Winner should have points
			if r.Points <= 0 {
				t.Errorf("Race winner should have positive points, got %f", r.Points)
			}
		}
	}
	if !foundFinisher {
		t.Errorf("Expected at least one driver in position 1")
	}
}

func TestGetStintsForSession(t *testing.T) {
	client := newTestClient()

	stints, err := client.GetStintsForSession(abuDhabiRace)
	skipOnRateLimit(t, err)
	if err != nil {
		t.Fatal(err)
	}

	if len(stints) == 0 {
		t.Errorf("Expected stints for session %d, got none", abuDhabiRace)
	}

	validCompounds := map[string]bool{
		"SOFT": true, "MEDIUM": true, "HARD": true,
		"INTERMEDIATE": true, "WET": true, "UNKNOWN": true,
	}

	for _, s := range stints {
		if s.SessionKey != abuDhabiRace {
			t.Errorf("Expected session_key %d, got %d", abuDhabiRace, s.SessionKey)
		}
		if !validCompounds[string(s.Compound)] {
			t.Errorf("Unexpected tyre compound: %q", s.Compound)
		}
	}
}

func TestGetDriverChampionship(t *testing.T) {
	client := newTestClient()

	standings, err := client.GetDriverChampionship(abuDhabiRace)
	skipOnRateLimit(t, err)
	if err != nil {
		t.Fatal(err)
	}

	if len(standings) == 0 {
		t.Errorf("Expected driver championship standings for session %d, got none", abuDhabiRace)
	}

	for _, s := range standings {
		if s.DriverNumber == 0 {
			t.Errorf("Expected non-zero driver_number in championship standings")
		}
		if s.PositionCurrent == 0 {
			t.Errorf("Expected non-zero position_current in championship standings")
		}
		if s.PointsCurrent < 0 {
			t.Errorf("Expected non-negative points_current, got %f", s.PointsCurrent)
		}
	}
}

func TestGetRaceControl(t *testing.T) {
	client := newTestClient()

	messages, err := client.GetRaceControl(abuDhabiRace)
	skipOnRateLimit(t, err)
	if err != nil {
		t.Fatal(err)
	}

	if len(messages) == 0 {
		t.Errorf("Expected race control messages for session %d, got none", abuDhabiRace)
	}

	for _, m := range messages {
		if m.SessionKey != abuDhabiRace {
			t.Errorf("Expected session_key %d, got %d", abuDhabiRace, m.SessionKey)
		}
		if m.Message == "" {
			t.Errorf("Expected non-empty message in race control entry")
		}
		// DriverNumber is a pointer — just verify it doesn't panic (nil is valid)
		_ = m.DriverNumber
	}
}
