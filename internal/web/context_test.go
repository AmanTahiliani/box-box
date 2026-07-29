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
	if rr.Header().Get(dataSourceHeader) != "none" || rr.Header().Get(dataFreshnessHeader) != "limited" {
		t.Fatalf("missing context metadata = %q/%q", rr.Header().Get(dataSourceHeader), rr.Header().Get(dataFreshnessHeader))
	}
}

func TestWeekendContextHandlerEmptyStoreReportsLimited(t *testing.T) {
	st := openContextStore(t)
	s := NewServer(nil, 0, st)
	rr := httptest.NewRecorder()
	s.handleWeekendContext(rr, httptest.NewRequest(http.MethodGet, "/api/v1/weekend-context", nil))
	if rr.Code != http.StatusOK || rr.Header().Get(dataSourceHeader) != "none" || rr.Header().Get(dataFreshnessHeader) != "limited" {
		t.Fatalf("empty context = %d %q/%q body=%s", rr.Code, rr.Header().Get(dataSourceHeader), rr.Header().Get(dataFreshnessHeader), rr.Body.String())
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
	if got.ActiveSession.Availability.Source != "mixed" || got.ActiveSession.Availability.Freshness != "live" {
		t.Fatalf("live source/freshness = %+v", got.ActiveSession.Availability)
	}
	if rr.Header().Get(dataSourceHeader) != "mixed" || rr.Header().Get(dataFreshnessHeader) != "live" {
		t.Fatalf("response source/freshness = %q/%q", rr.Header().Get(dataSourceHeader), rr.Header().Get(dataFreshnessHeader))
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
	if got.PreviousCompletedSession.Availability.Source != "mixed" || got.PreviousCompletedSession.Availability.Freshness != "archive" {
		t.Fatalf("archive source/freshness = %+v", got.PreviousCompletedSession.Availability)
	}
	if rr.Header().Get(dataSourceHeader) != "mixed" || rr.Header().Get(dataFreshnessHeader) != "archive" {
		t.Fatalf("archive response source/freshness = %q/%q", rr.Header().Get(dataSourceHeader), rr.Header().Get(dataFreshnessHeader))
	}
	if got.DefaultAnalysisSession != nil {
		t.Fatal("archive-only session must not become local default analysis")
	}
}

func TestWeekendContextMetadataFollowsUpcomingFocusNotTerminalPrevious(t *testing.T) {
	st := openContextStore(t)
	seedContextHandler(t, st)
	if err := st.UpsertMeeting(store.Meeting{MeetingKey: 2, MeetingName: "Belgian Grand Prix", CircuitShortName: "Spa", Year: 2026, DateStart: "2026-07-10T09:00:00Z", DateEnd: "2026-07-12T16:00:00Z"}); err != nil {
		t.Fatal(err)
	}
	if err := st.UpsertSession(store.Session{SessionKey: 21, MeetingKey: 2, SessionName: "Practice 1", SessionType: "Practice", DateStart: "2026-07-10T09:00:00Z", DateEnd: "2026-07-10T10:00:00Z"}); err != nil {
		t.Fatal(err)
	}
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
	if got.FocusMeeting == nil || got.FocusMeeting.MeetingKey != 2 || got.NextSession == nil {
		t.Fatalf("focus context = %+v", got)
	}
	if got.PreviousCompletedSession == nil || got.PreviousCompletedSession.Availability.Freshness != "archive" {
		t.Fatalf("terminal previous missing = %+v", got.PreviousCompletedSession)
	}
	if rr.Header().Get(dataSourceHeader) != "local" || rr.Header().Get(dataFreshnessHeader) != "local" {
		t.Fatalf("focus metadata was overridden by archive = %q/%q", rr.Header().Get(dataSourceHeader), rr.Header().Get(dataFreshnessHeader))
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

func TestWeekendContextHandlerSerializesRaceHubRefreshDeadline(t *testing.T) {
	st := openContextStore(t)
	seedContextHandler(t, st)
	if err := st.UpsertSessionResult(store.SessionResult{SessionKey: 11, MeetingKey: 1, DriverNumber: 1, Position: 1}); err != nil {
		t.Fatal(err)
	}
	if err := st.UpsertMeeting(store.Meeting{MeetingKey: 2, MeetingName: "Belgian Grand Prix", CircuitShortName: "Spa", Year: 2026, DateStart: "2026-07-17T09:00:00Z", DateEnd: "2026-07-19T16:00:00Z"}); err != nil {
		t.Fatal(err)
	}
	if err := st.UpsertSession(store.Session{SessionKey: 21, MeetingKey: 2, SessionName: "Practice 1", SessionType: "Practice", DateStart: "2026-07-17T09:00:00Z", DateEnd: "2026-07-17T10:00:00Z"}); err != nil {
		t.Fatal(err)
	}
	s := NewServer(nil, 0, st)
	s.query = query.NewServiceWithClock(st, func() time.Time {
		return time.Date(2026, 7, 17, 8, 0, 0, 0, time.UTC)
	})
	rr := httptest.NewRecorder()
	s.handleWeekendContext(rr, httptest.NewRequest(http.MethodGet, "/api/v1/weekend-context", nil))
	var got query.WeekendContext
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if !got.RaceHubPreSession || got.RaceHubRefreshAt != "2026-07-17T09:00:00Z" || got.RaceHubDefaultSession == nil || got.RaceHubDefaultSession.Session.SessionKey != 21 {
		t.Fatalf("race hub context = %+v", got)
	}
}
