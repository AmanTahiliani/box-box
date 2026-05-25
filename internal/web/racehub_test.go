package web

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/query"
	"github.com/AmanTahiliani/box-box/internal/store"
)

func testServer(t *testing.T, st *store.Store) *Server {
	t.Helper()
	client := api.NewOpenF1Client("https://api.openf1.org", 15*time.Second)
	t.Cleanup(func() { _ = client.Close() })
	return NewServer(client, 8080, st)
}

func openTestStore(t *testing.T) *store.Store {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	st, err := store.Open(path)
	if err != nil {
		t.Fatalf("store.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func seedRaceHubStore(t *testing.T, st *store.Store) {
	t.Helper()
	meetingKey := 1229
	sessionKey := 9472

	if err := st.UpsertMeeting(store.Meeting{
		MeetingKey:  meetingKey,
		MeetingName: "Monaco",
		Year:        2025,
	}); err != nil {
		t.Fatalf("UpsertMeeting() error = %v", err)
	}
	if err := st.UpsertSession(store.Session{
		SessionKey:  sessionKey,
		MeetingKey:  meetingKey,
		SessionName: "Race",
		SessionType: "Race",
	}); err != nil {
		t.Fatalf("UpsertSession() error = %v", err)
	}
	if err := st.UpsertDriver(store.Driver{
		DriverNumber: 1,
		FullName:     "Max Verstappen",
		NameAcronym:  "VER",
	}); err != nil {
		t.Fatalf("UpsertDriver() error = %v", err)
	}
	if err := st.UpsertSessionDriver(store.SessionDriver{
		SessionKey:   sessionKey,
		DriverNumber: 1,
		MeetingKey:   meetingKey,
	}); err != nil {
		t.Fatalf("UpsertSessionDriver() error = %v", err)
	}
}

func TestHandleRaceHubWithoutStore(t *testing.T) {
	srv := testServer(t, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/race-hub?session_key=9472", nil)
	rec := httptest.NewRecorder()

	srv.handleRaceHub(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var hub query.RaceHub
	if err := json.Unmarshal(rec.Body.Bytes(), &hub); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if hub.Source != query.ResponseSourceNone {
		t.Fatalf("source = %q, want %q", hub.Source, query.ResponseSourceNone)
	}
	if hub.Datasets["session"].Status != query.DatasetStatusMissing {
		t.Fatalf("session dataset = %+v, want missing", hub.Datasets["session"])
	}
}

func TestHandleRaceHubWithLocalData(t *testing.T) {
	st := openTestStore(t)
	seedRaceHubStore(t, st)
	srv := testServer(t, st)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/race-hub?session_key=9472", nil)
	rec := httptest.NewRecorder()
	srv.handleRaceHub(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var hub query.RaceHub
	if err := json.Unmarshal(rec.Body.Bytes(), &hub); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if hub.Session == nil || hub.Meeting == nil {
		t.Fatal("expected meeting and session in response")
	}
	if hub.Datasets["drivers"].Status != query.DatasetStatusAvailable {
		t.Fatalf("drivers dataset = %+v, want available", hub.Datasets["drivers"])
	}
	if hub.Datasets["results"].Status != query.DatasetStatusMissing {
		t.Fatalf("results dataset = %+v, want missing", hub.Datasets["results"])
	}
}

func TestHandleMeetingsSourceLocal(t *testing.T) {
	st := openTestStore(t)
	seedRaceHubStore(t, st)
	srv := testServer(t, st)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/meetings?year=2025&source=local", nil)
	rec := httptest.NewRecorder()
	srv.handleMeetings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var meetings []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &meetings); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(meetings) != 1 {
		t.Fatalf("meetings len = %d, want 1", len(meetings))
	}
}

func TestHandleRaceHubRequiresSessionKey(t *testing.T) {
	srv := testServer(t, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/race-hub", nil)
	rec := httptest.NewRecorder()

	srv.handleRaceHub(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}
