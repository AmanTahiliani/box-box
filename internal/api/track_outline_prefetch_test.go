package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

func newTrackOutlineTestClient(t *testing.T, srvURL string) *OpenF1Client {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())

	c := NewOpenF1Client(srvURL, 5*time.Second)
	c.pacer = &requestPacer{}
	t.Cleanup(func() { _ = c.Close() })
	return c
}

func TestPrefetchTrackOutlinesForYearSkipsCachedAndWritesLocations(t *testing.T) {
	var sessionsByMeeting = map[string][]models.Session{
		"202": {
			{
				SessionKey:  9002,
				SessionName: "Race",
				MeetingKey:  202,
				CircuitKey:  2,
				DateEnd:     "2026-01-01T12:00:00+00:00",
			},
		},
	}
	var sessionsRequested []string
	var locationsRequested []string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/sessions":
			meetingKey := r.URL.Query().Get("meeting_key")
			sessionsRequested = append(sessionsRequested, meetingKey)
			_ = json.NewEncoder(w).Encode(sessionsByMeeting[meetingKey])
		case "/v1/location":
			sessionKey := r.URL.Query().Get("session_key")
			driverNumber := r.URL.Query().Get("driver_number")
			locationsRequested = append(locationsRequested, sessionKey+"/"+driverNumber)
			_ = json.NewEncoder(w).Encode(testLocations(9002, 1, 51))
		default:
			t.Fatalf("unexpected request path %s", r.URL.Path)
		}
	}))
	defer srv.Close()

	client := newTrackOutlineTestClient(t, srv.URL)
	if err := client.Cache().SetTrackOutline(1, 2026, testLocations(9001, 1, 51)); err != nil {
		t.Fatalf("SetTrackOutline() error = %v", err)
	}

	result := client.PrefetchTrackOutlinesForYear(2026, []models.Meeting{
		{MeetingKey: 101, Year: 2026, Circuit: models.Circuit{CircuitKey: 1}},
		{MeetingKey: 202, Year: 2026, Circuit: models.Circuit{CircuitKey: 2}},
		{MeetingKey: 303, Year: 2026, Circuit: models.Circuit{CircuitKey: 2}},
	})

	if result.UniqueCircuits != 2 {
		t.Fatalf("UniqueCircuits = %d, want 2", result.UniqueCircuits)
	}
	if result.CachedBefore != 1 || result.Skipped != 1 || result.Fetched != 1 || result.Failed != 0 || result.CachedAfter != 2 {
		t.Fatalf("unexpected result: %+v", result)
	}
	if got, want := len(sessionsRequested), 1; got != want {
		t.Fatalf("sessions requested %d time(s), want %d: %v", got, want, sessionsRequested)
	}
	if sessionsRequested[0] != "202" {
		t.Fatalf("requested meeting %s, want 202", sessionsRequested[0])
	}
	if got, want := len(locationsRequested), 1; got != want {
		t.Fatalf("locations requested %d time(s), want %d: %v", got, want, locationsRequested)
	}
	if locationsRequested[0] != "9002/1" {
		t.Fatalf("requested location %s, want 9002/1", locationsRequested[0])
	}

	locs, ok := client.Cache().GetTrackOutline(2, 2026)
	if !ok {
		t.Fatal("expected circuit 2 outline to be cached")
	}
	if len(locs) != 51 {
		t.Fatalf("cached %d locations, want 51", len(locs))
	}
}

func testLocations(sessionKey, driverNumber, count int) []models.Location {
	locs := make([]models.Location, count)
	for i := range locs {
		locs[i] = models.Location{
			Date:         "2026-01-01T12:00:" + strconv.Itoa(i%60) + "+00:00",
			DriverNumber: driverNumber,
			MeetingKey:   202,
			SessionKey:   sessionKey,
			X:            float64(i),
			Y:            float64(i * 2),
		}
	}
	return locs
}
