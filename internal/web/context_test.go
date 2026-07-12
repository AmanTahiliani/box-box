package web

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/live"
	"github.com/AmanTahiliani/box-box/internal/query"
	"github.com/AmanTahiliani/box-box/internal/store"
)

func openContextStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "context.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func seedContextHandler(t *testing.T, st *store.Store) {
	t.Helper()
	if err := st.UpsertMeeting(store.Meeting{MeetingKey: 1, MeetingName: "British Grand Prix", CircuitShortName: "Silverstone", Year: 2026, DateStart: "2026-07-03T09:00:00Z", DateEnd: "2026-07-05T16:00:00Z"}); err != nil {
		t.Fatal(err)
	}
	if err := st.UpsertSession(store.Session{SessionKey: 11, MeetingKey: 1, SessionName: "Race", SessionType: "Race", DateStart: "2026-07-05T14:00:00Z", DateEnd: "2026-07-05T16:00:00Z"}); err != nil {
		t.Fatal(err)
	}
}

func TestWeekendContextHandlerWithoutStoreReturnsNoSeason(t *testing.T) {
	s := NewServer(nil, 0, nil)
	rr := httptest.NewRecorder()
	s.handleWeekendContext(rr, httptest.NewRequest(http.MethodGet, "/api/v1/weekend-context", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	var got query.WeekendContext
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.TemporalState != query.TemporalNoSeason {
		t.Fatalf("state = %s", got.TemporalState)
	}
}

func TestWeekendContextHandlerUsesLiveHubIdentityWithoutOpenF1(t *testing.T) {
	st := openContextStore(t)
	seedContextHandler(t, st)
	now, _ := time.Parse(time.RFC3339, "2026-07-05T13:55:00Z")
	s := NewServer(nil, 0, st) // a nil OpenF1 client makes any REST dependency panic
	s.query = query.NewServiceWithClock(st, func() time.Time { return now })
	s.hub.applySnapshot(live.LiveStreamData{SessionStatus: "Started", Session: live.LiveSessionMeta{MeetingName: "British Grand Prix", CircuitName: "Silverstone", SessionName: "Race", SessionType: "Race"}}, now)

	handler, err := s.routes()
	if err != nil {
		t.Fatal(err)
	}
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/v1/weekend-context", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rr.Code, rr.Body.String())
	}
	var got query.WeekendContext
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.TemporalState != query.TemporalSessionLive || got.ActiveSession == nil || got.ActiveSession.Session.SessionKey != 11 {
		t.Fatalf("live context = %+v", got)
	}
	if got.ActiveSession.Availability.LiveTransport != "connected" || got.ActiveSession.Availability.LiveSession != "active" {
		t.Fatalf("availability = %+v", got.ActiveSession.Availability)
	}
}

func TestWeekendContextHandlerUsesTerminalArchiveAsCompletionEvidence(t *testing.T) {
	st := openContextStore(t)
	seedContextHandler(t, st)
	now, _ := time.Parse(time.RFC3339, "2026-07-05T16:05:00Z")
	s := NewServer(nil, 0, st)
	s.query = query.NewServiceWithClock(st, func() time.Time { return now })
	s.hub.applySnapshot(live.LiveStreamData{SessionStatus: "Finished", Session: live.LiveSessionMeta{MeetingName: "British Grand Prix", CircuitName: "Silverstone", SessionName: "Race", SessionType: "Race"}}, now)
	rr := httptest.NewRecorder()
	s.handleWeekendContext(rr, httptest.NewRequest(http.MethodGet, "/api/v1/weekend-context", nil))
	var got query.WeekendContext
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.PreviousCompletedSession == nil || got.PreviousCompletedSession.Availability.Archive != "available" {
		t.Fatalf("archive context = %+v", got)
	}
	if got.DefaultAnalysisSession != nil {
		t.Fatal("archive-only session must not become local default analysis")
	}
}

func TestTerminalSessionStatus(t *testing.T) {
	for _, status := range []string{"Finished", "Finalised", "ENDED", "Aborted"} {
		if !terminalSessionStatus(status) {
			t.Errorf("%q should be terminal", status)
		}
	}
	for _, status := range []string{"Started", "Resumed", "Inactive", ""} {
		if terminalSessionStatus(status) {
			t.Errorf("%q should not be terminal", status)
		}
	}
}
