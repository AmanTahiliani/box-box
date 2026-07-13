package query

import (
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/store"
)

func contextService(t *testing.T, now time.Time) *Service {
	t.Helper()
	base := openTestService(t)
	return NewServiceWithClock(base.store, func() time.Time { return now })
}

func addContextMeeting(t *testing.T, svc *Service, key int, name, start, end string, cancelled bool) {
	t.Helper()
	if err := svc.store.UpsertMeeting(store.Meeting{MeetingKey: key, MeetingName: name, MeetingOfficialName: name, CircuitShortName: name, Year: 2026, DateStart: start, DateEnd: end, IsCancelled: cancelled}); err != nil {
		t.Fatal(err)
	}
}

func addContextSession(t *testing.T, svc *Service, key, meeting int, name, start, end string, cancelled bool) {
	t.Helper()
	if err := svc.store.UpsertSession(store.Session{SessionKey: key, MeetingKey: meeting, SessionName: name, SessionType: name, DateStart: start, DateEnd: end, IsCancelled: cancelled}); err != nil {
		t.Fatal(err)
	}
}

func completeContextSession(t *testing.T, svc *Service, key, meeting int) {
	t.Helper()
	if err := svc.store.UpsertSessionResult(store.SessionResult{SessionKey: key, MeetingKey: meeting, DriverNumber: 1, Position: 1}); err != nil {
		t.Fatal(err)
	}
}

func TestResolveWeekendContextTemporalStates(t *testing.T) {
	tests := []struct {
		name     string
		now      string
		seed     func(*testing.T, *Service)
		evidence LiveEvidence
		want     TemporalState
	}{
		{name: "no season", now: "2026-06-01T12:00:00Z", want: TemporalNoSeason},
		{name: "between weekends", now: "2026-06-10T12:00:00Z", seed: func(t *testing.T, s *Service) {
			addContextMeeting(t, s, 1, "Monaco Grand Prix", "2026-06-01T09:00:00Z", "2026-06-02T16:00:00Z", false)
			addContextSession(t, s, 11, 1, "Race", "2026-06-02T14:00:00Z", "2026-06-02T16:00:00Z", false)
			completeContextSession(t, s, 11, 1)
			addContextMeeting(t, s, 2, "Canada Grand Prix", "2026-06-20T09:00:00Z", "2026-06-22T16:00:00Z", false)
			addContextSession(t, s, 21, 2, "Practice 1", "2026-06-20T09:00:00Z", "2026-06-20T10:00:00Z", false)
			addContextSession(t, s, 22, 2, "Race", "2026-06-22T14:00:00Z", "2026-06-22T16:00:00Z", false)
		}, want: TemporalBetweenWeekends},
		{name: "pre session", now: "2026-06-19T12:00:00Z", seed: func(t *testing.T, s *Service) {
			addContextMeeting(t, s, 2, "Canada Grand Prix", "2026-06-20T09:00:00Z", "2026-06-22T16:00:00Z", false)
			addContextSession(t, s, 21, 2, "Practice 1", "2026-06-20T09:00:00Z", "2026-06-20T10:00:00Z", false)
			addContextSession(t, s, 22, 2, "Race", "2026-06-22T14:00:00Z", "2026-06-22T16:00:00Z", false)
		}, want: TemporalPreSession},
		{name: "session live overrides schedule", now: "2026-06-20T12:00:00Z", seed: func(t *testing.T, s *Service) {
			addContextMeeting(t, s, 2, "Canada Grand Prix", "2026-06-20T09:00:00Z", "2026-06-22T16:00:00Z", false)
			addContextSession(t, s, 21, 2, "Practice 1", "2026-06-20T09:00:00Z", "2026-06-20T10:00:00Z", false)
			addContextSession(t, s, 22, 2, "Race", "2026-06-22T14:00:00Z", "2026-06-22T16:00:00Z", false)
		}, evidence: LiveEvidence{Active: true, MeetingName: "Canadian Grand Prix", CircuitName: "Canada Grand Prix", SessionName: "Practice 1", SessionType: "Practice 1"}, want: TemporalSessionLive},
		{name: "session settling", now: "2026-06-20T11:00:00Z", seed: func(t *testing.T, s *Service) {
			addContextMeeting(t, s, 2, "Canada Grand Prix", "2026-06-20T09:00:00Z", "2026-06-22T16:00:00Z", false)
			addContextSession(t, s, 21, 2, "Practice 1", "2026-06-20T09:00:00Z", "2026-06-20T10:00:00Z", false)
			addContextSession(t, s, 22, 2, "Race", "2026-06-22T14:00:00Z", "2026-06-22T16:00:00Z", false)
		}, want: TemporalSessionSettling},
		{name: "between sessions", now: "2026-06-20T11:00:00Z", seed: func(t *testing.T, s *Service) {
			addContextMeeting(t, s, 2, "Canada Grand Prix", "2026-06-20T09:00:00Z", "2026-06-22T16:00:00Z", false)
			addContextSession(t, s, 21, 2, "Practice 1", "2026-06-20T09:00:00Z", "2026-06-20T10:00:00Z", false)
			completeContextSession(t, s, 21, 2)
			addContextSession(t, s, 22, 2, "Race", "2026-06-22T14:00:00Z", "2026-06-22T16:00:00Z", false)
		}, want: TemporalBetweenSessions},
		{name: "post weekend", now: "2026-06-22T18:00:00Z", seed: func(t *testing.T, s *Service) {
			addContextMeeting(t, s, 2, "Canada Grand Prix", "2026-06-20T09:00:00Z", "2026-06-22T16:00:00Z", false)
			addContextSession(t, s, 22, 2, "Race", "2026-06-22T14:00:00Z", "2026-06-22T16:00:00Z", false)
			completeContextSession(t, s, 22, 2)
		}, want: TemporalPostWeekend},
		{name: "season complete", now: "2026-06-30T12:00:00Z", seed: func(t *testing.T, s *Service) {
			addContextMeeting(t, s, 2, "Canada Grand Prix", "2026-06-20T09:00:00Z", "2026-06-22T16:00:00Z", false)
			addContextSession(t, s, 22, 2, "Race", "2026-06-22T14:00:00Z", "2026-06-22T16:00:00Z", false)
			completeContextSession(t, s, 22, 2)
		}, want: TemporalSeasonComplete},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			now, _ := time.Parse(time.RFC3339, tt.now)
			svc := contextService(t, now)
			if tt.seed != nil {
				tt.seed(t, svc)
			}
			got, err := svc.ResolveWeekendContext(tt.evidence)
			if err != nil {
				t.Fatal(err)
			}
			if got.TemporalState != tt.want {
				t.Fatalf("state = %s, want %s; context=%+v", got.TemporalState, tt.want, got)
			}
		})
	}
}

func TestResolveWeekendContextTruthRules(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-07-10T12:00:00Z")
	svc := contextService(t, now)
	addContextMeeting(t, svc, 1, "Pre-Season Testing", "2026-02-01T00:00:00Z", "2026-02-03T00:00:00Z", false)
	addContextSession(t, svc, 10, 1, "Race", "2026-02-03T10:00:00Z", "2026-02-03T12:00:00Z", false)
	addContextMeeting(t, svc, 2, "Cancelled Grand Prix", "2026-03-01T00:00:00Z", "2026-03-03T00:00:00Z", true)
	addContextSession(t, svc, 20, 2, "Race", "2026-03-03T10:00:00Z", "2026-03-03T12:00:00Z", false)
	addContextMeeting(t, svc, 3, "British Grand Prix", "2026-07-01T00:00:00Z", "2026-07-05T00:00:00Z", false)
	addContextSession(t, svc, 30, 3, "Practice 1", "2026-07-03T09:00:00Z", "2026-07-03T10:00:00Z", false)
	addContextSession(t, svc, 31, 3, "Sprint", "2026-07-04T10:00:00Z", "2026-07-04T11:00:00Z", false)
	addContextSession(t, svc, 32, 3, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
	completeContextSession(t, svc, 32, 3)
	addContextMeeting(t, svc, 4, "Belgian Grand Prix", "2026-07-16T00:00:00Z", "2026-07-18T00:00:00Z", false)
	addContextSession(t, svc, 40, 4, "Practice 1", "2026-07-17T09:00:00Z", "2026-07-17T10:00:00Z", false)
	addContextSession(t, svc, 41, 4, "Cancelled Practice", "2026-07-18T09:00:00Z", "2026-07-18T10:00:00Z", true)
	addContextSession(t, svc, 42, 4, "Race", "2026-07-19T14:00:00Z", "2026-07-19T16:00:00Z", false)

	got, err := svc.ResolveWeekendContext(LiveEvidence{})
	if err != nil {
		t.Fatal(err)
	}
	if got.TotalChampionshipRounds != 2 || got.ChampionshipRound != 2 {
		t.Fatalf("rounds = %d/%d, want 2/2", got.ChampionshipRound, got.TotalChampionshipRounds)
	}
	if got.DefaultAnalysisSession == nil || got.DefaultAnalysisSession.Session.SessionKey != 32 {
		t.Fatalf("default analysis = %+v, want completed race 32", got.DefaultAnalysisSession)
	}
	if got.NextSession == nil || got.NextSession.Session.SessionKey != 40 {
		t.Fatalf("next = %+v, want 40", got.NextSession)
	}
	if got.NextMeeting.DateStart != "2026-07-17T09:00:00Z" || got.NextMeeting.DateEnd != "2026-07-19T16:00:00Z" {
		t.Fatalf("display range = %s..%s", got.NextMeeting.DateStart, got.NextMeeting.DateEnd)
	}
}

func TestResolveWeekendContextPassedTimeDoesNotCompleteSession(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-07-05T18:00:00Z")
	svc := contextService(t, now)
	addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T00:00:00Z", "2026-07-05T16:00:00Z", false)
	addContextSession(t, svc, 11, 1, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
	got, err := svc.ResolveWeekendContext(LiveEvidence{})
	if err != nil {
		t.Fatal(err)
	}
	if got.PreviousCompletedSession != nil || got.DefaultAnalysisSession != nil {
		t.Fatalf("passed schedule was treated complete: %+v", got)
	}
	archive, err := svc.ResolveWeekendContext(LiveEvidence{Final: true, MeetingName: "British Grand Prix", CircuitName: "British Grand Prix", SessionName: "Race", SessionType: "Race", ObservedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	if archive.PreviousCompletedSession == nil || archive.PreviousCompletedSession.Availability.Archive != "available" {
		t.Fatalf("final archive not used: %+v", archive)
	}
	if archive.DefaultAnalysisSession != nil {
		t.Fatal("archive without local analysis must not become default analysis")
	}
}

func TestResolveWeekendContextAvailabilityUsesTruthfulSources(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-07-05T18:00:00Z")
	svc := contextService(t, now)
	addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T00:00:00Z", "2026-07-05T16:00:00Z", false)
	addContextSession(t, svc, 11, 1, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
	// Results without laps/stints/positions are meaningful but incomplete local
	// analysis, so they must not be labelled universally fresh.
	completeContextSession(t, svc, 11, 1)
	addContextMeeting(t, svc, 2, "Belgian Grand Prix", "2026-07-17T00:00:00Z", "2026-07-19T16:00:00Z", false)
	addContextSession(t, svc, 21, 2, "Practice 1", "2026-07-17T09:00:00Z", "2026-07-17T10:00:00Z", false)
	addContextSession(t, svc, 22, 2, "Race", "2026-07-19T14:00:00Z", "2026-07-19T16:00:00Z", false)

	local, err := svc.ResolveWeekendContext(LiveEvidence{})
	if err != nil {
		t.Fatal(err)
	}
	if got := local.PreviousCompletedSession.Availability; got.Source != "local" || got.Freshness != "partial" || got.LocalAnalysis != "partial" {
		t.Fatalf("partial local availability = %+v", got)
	}
	if got := local.NextSession.Availability; got.Source != "local" || got.Freshness != "local" {
		t.Fatalf("future local availability = %+v", got)
	}

	liveContext, err := svc.ResolveWeekendContext(LiveEvidence{Active: true, MeetingName: "Belgian Grand Prix", CircuitName: "Belgian Grand Prix", SessionName: "Practice 1", SessionType: "Practice 1", ObservedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	if got := liveContext.ActiveSession.Availability; got.Source != "mixed" || got.Freshness != "live" || got.LiveSession != "active" {
		t.Fatalf("FIA + local availability = %+v", got)
	}

	archiveContext, err := svc.ResolveWeekendContext(LiveEvidence{Final: true, MeetingName: "British Grand Prix", CircuitName: "British Grand Prix", SessionName: "Race", SessionType: "Race", ObservedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	if got := archiveContext.PreviousCompletedSession.Availability; got.Source != "mixed" || got.Freshness != "archive" || got.Archive != "available" {
		t.Fatalf("FIA archive + local availability = %+v", got)
	}

	synthetic, err := svc.ResolveWeekendContext(LiveEvidence{Active: true, MeetingName: "Unscheduled Grand Prix", SessionName: "Race", SessionType: "Race", ObservedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	if got := synthetic.ActiveSession.Availability; got.Source != "fia" || got.Freshness != "live" || got.Schedule != "unavailable" {
		t.Fatalf("synthetic FIA availability = %+v", got)
	}
}

func TestResolveWeekendContextNeverUsesFutureAnalysis(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-07-01T12:00:00Z")
	svc := contextService(t, now)
	addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T00:00:00Z", "2026-07-05T16:00:00Z", false)
	addContextSession(t, svc, 11, 1, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
	completeContextSession(t, svc, 11, 1) // bad/preloaded data must not make a future session canonical
	got, err := svc.ResolveWeekendContext(LiveEvidence{})
	if err != nil {
		t.Fatal(err)
	}
	if got.PreviousCompletedSession != nil || got.DefaultAnalysisSession != nil {
		t.Fatalf("future analysis selected: %+v", got)
	}
}

func TestResolveWeekendContextSprintWeekendHandoff(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-07-04T12:00:00Z")
	svc := contextService(t, now)
	addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T09:00:00Z", "2026-07-05T16:00:00Z", false)
	addContextSession(t, svc, 11, 1, "Sprint", "2026-07-04T10:00:00Z", "2026-07-04T11:00:00Z", false)
	addContextSession(t, svc, 12, 1, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
	completeContextSession(t, svc, 11, 1)
	got, err := svc.ResolveWeekendContext(LiveEvidence{})
	if err != nil {
		t.Fatal(err)
	}
	if got.TemporalState != TemporalBetweenSessions || got.PreviousCompletedSession.Session.SessionKey != 11 || got.NextSession.Session.SessionKey != 12 {
		t.Fatalf("sprint handoff = %+v", got)
	}
	if got.TotalChampionshipRounds != 1 {
		t.Fatalf("sprint created extra championship round: %d", got.TotalChampionshipRounds)
	}
}

func TestResolveWeekendContextBoundaryTimestamps(t *testing.T) {
	t.Run("pre-session window is inclusive", func(t *testing.T) {
		now, _ := time.Parse(time.RFC3339, "2026-07-01T09:00:00Z")
		svc := contextService(t, now)
		addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T09:00:00Z", "2026-07-05T16:00:00Z", false)
		addContextSession(t, svc, 11, 1, "Practice 1", "2026-07-03T09:00:00Z", "2026-07-03T10:00:00Z", false)
		addContextSession(t, svc, 12, 1, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
		got, err := svc.ResolveWeekendContext(LiveEvidence{})
		if err != nil {
			t.Fatal(err)
		}
		if got.TemporalState != TemporalPreSession {
			t.Fatalf("state = %s", got.TemporalState)
		}
	})
	t.Run("scheduled end enters settling", func(t *testing.T) {
		now, _ := time.Parse(time.RFC3339, "2026-07-03T10:00:00Z")
		svc := contextService(t, now)
		addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T09:00:00Z", "2026-07-05T16:00:00Z", false)
		addContextSession(t, svc, 11, 1, "Practice 1", "2026-07-03T09:00:00Z", "2026-07-03T10:00:00Z", false)
		addContextSession(t, svc, 12, 1, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
		got, err := svc.ResolveWeekendContext(LiveEvidence{})
		if err != nil {
			t.Fatal(err)
		}
		if got.TemporalState != TemporalSessionSettling {
			t.Fatalf("state = %s", got.TemporalState)
		}
	})
	t.Run("post-weekend window is inclusive", func(t *testing.T) {
		now, _ := time.Parse(time.RFC3339, "2026-07-07T16:00:00Z")
		svc := contextService(t, now)
		addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T09:00:00Z", "2026-07-05T16:00:00Z", false)
		addContextSession(t, svc, 12, 1, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
		completeContextSession(t, svc, 12, 1)
		got, err := svc.ResolveWeekendContext(LiveEvidence{})
		if err != nil {
			t.Fatal(err)
		}
		if got.TemporalState != TemporalPostWeekend {
			t.Fatalf("state = %s", got.TemporalState)
		}
	})
}

func TestResolveWeekendContextPartialFutureSchedule(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-07-01T12:00:00Z")
	svc := contextService(t, now)
	addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T09:00:00Z", "", false)
	addContextSession(t, svc, 11, 1, "Practice 1", "", "", false)
	addContextSession(t, svc, 12, 1, "Race", "2026-07-05T14:00:00Z", "", false)
	got, err := svc.ResolveWeekendContext(LiveEvidence{})
	if err != nil {
		t.Fatal(err)
	}
	if got.NextSession == nil || got.NextSession.Session.SessionKey != 12 {
		t.Fatalf("partial schedule next = %+v", got.NextSession)
	}
	if got.FocusMeeting == nil || got.FocusMeeting.DateStart != "2026-07-05T14:00:00Z" || got.FocusMeeting.DateEnd != "2026-07-05T14:00:00Z" {
		t.Fatalf("partial display range = %+v", got.FocusMeeting)
	}
}

func TestResolveWeekendContextActiveSessionIsNotCompletedOrDefault(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-07-05T15:00:00Z")
	svc := contextService(t, now)
	addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T09:00:00Z", "2026-07-05T16:00:00Z", false)
	addContextSession(t, svc, 10, 1, "Qualifying", "2026-07-04T14:00:00Z", "2026-07-04T15:00:00Z", false)
	completeContextSession(t, svc, 10, 1)
	addContextSession(t, svc, 11, 1, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
	completeContextSession(t, svc, 11, 1)

	got, err := svc.ResolveWeekendContext(LiveEvidence{Active: true, MeetingName: "British Grand Prix", CircuitName: "British Grand Prix", SessionName: "Race", SessionType: "Race", ObservedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	if got.ActiveSession == nil || got.ActiveSession.Session.SessionKey != 11 {
		t.Fatalf("active = %+v", got.ActiveSession)
	}
	if got.PreviousCompletedSession == nil || got.PreviousCompletedSession.Session.SessionKey != 10 {
		t.Fatalf("previous = %+v, want earlier completed session", got.PreviousCompletedSession)
	}
	if got.DefaultAnalysisSession == nil || got.DefaultAnalysisSession.Session.SessionKey != 10 {
		t.Fatalf("default = %+v, want earlier completed session", got.DefaultAnalysisSession)
	}
}

func TestResolveWeekendContextOldIncompleteSessionDoesNotSuppressNextWeekend(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-07-16T12:00:00Z")
	svc := contextService(t, now)
	addContextMeeting(t, svc, 1, "British Grand Prix", "2026-07-03T09:00:00Z", "2026-07-05T16:00:00Z", false)
	addContextSession(t, svc, 11, 1, "Race", "2026-07-05T14:00:00Z", "2026-07-05T16:00:00Z", false)
	addContextMeeting(t, svc, 2, "Belgian Grand Prix", "2026-07-17T09:00:00Z", "2026-07-19T16:00:00Z", false)
	addContextSession(t, svc, 21, 2, "Practice 1", "2026-07-17T09:00:00Z", "2026-07-17T10:00:00Z", false)
	addContextSession(t, svc, 22, 2, "Race", "2026-07-19T14:00:00Z", "2026-07-19T16:00:00Z", false)

	got, err := svc.ResolveWeekendContext(LiveEvidence{})
	if err != nil {
		t.Fatal(err)
	}
	if got.TemporalState != TemporalPreSession {
		t.Fatalf("state = %s, want %s; context=%+v", got.TemporalState, TemporalPreSession, got)
	}
	if got.FocusMeeting == nil || got.FocusMeeting.MeetingKey != 2 {
		t.Fatalf("focus = %+v, want Belgian weekend", got.FocusMeeting)
	}
}

func TestResolveWeekendContextMissingScheduleDoesNotClaimSeasonComplete(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-07-01T12:00:00Z")
	svc := contextService(t, now)
	addContextMeeting(t, svc, 1, "British Grand Prix", "", "", false)
	addContextSession(t, svc, 11, 1, "Race", "", "", false)

	got, err := svc.ResolveWeekendContext(LiveEvidence{})
	if err != nil {
		t.Fatal(err)
	}
	if got.TemporalState != TemporalBetweenWeekends {
		t.Fatalf("state = %s, want limited %s context", got.TemporalState, TemporalBetweenWeekends)
	}
	if got.TotalChampionshipRounds != 1 {
		t.Fatalf("total rounds = %d, want scheduled round retained", got.TotalChampionshipRounds)
	}
}
