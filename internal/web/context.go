package web

import (
	"net/http"
	"strings"

	"github.com/AmanTahiliani/box-box/internal/live"
	"github.com/AmanTahiliani/box-box/internal/query"
)

func (s *Server) handleWeekendContext(w http.ResponseWriter, _ *http.Request) {
	if !s.hasLocalQuery() {
		markDataResponse(w, "none", "limited")
		writeJSON(w, query.WeekendContext{TemporalState: query.TemporalNoSeason})
		return
	}

	state := s.hub.State()
	evidence := query.LiveEvidence{}
	if state.IsLive && state.Data != nil {
		evidence = liveEvidence(state.Data, true, false)
	} else if state.LastSnapshot != nil && terminalSessionStatus(state.LastSnapshot.SessionStatus) {
		evidence = liveEvidence(state.LastSnapshot, false, true)
		if state.LastSnapshotAt != nil {
			evidence.ObservedAt = *state.LastSnapshotAt
		}
	}
	context, err := s.query.ResolveWeekendContext(evidence)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, false)
		return
	}
	if focus := focusedContextSession(context); focus != nil {
		markDataResponse(w, focus.Availability.Source, focus.Availability.Freshness)
	} else {
		markDataResponse(w, "none", "limited")
	}
	writeJSON(w, context)
}

// focusedContextSession selects the session whose state the Weekend shell is
// presenting. An older terminal/default session must never override an
// upcoming focus session's metadata.
func focusedContextSession(context query.WeekendContext) *query.ContextSession {
	if context.ActiveSession != nil {
		return context.ActiveSession
	}
	if context.FocusMeeting == nil {
		return nil
	}
	focusKey := context.FocusMeeting.MeetingKey
	for _, ref := range []*query.ContextSession{context.NextSession, context.PreviousCompletedSession, context.DefaultAnalysisSession} {
		if ref != nil && ref.Meeting != nil && ref.Meeting.MeetingKey == focusKey {
			return ref
		}
	}
	return nil
}

func liveEvidence(data *live.LiveStreamData, active, final bool) query.LiveEvidence {
	return query.LiveEvidence{Active: active, Final: final, MeetingName: data.Session.MeetingName, CircuitName: data.Session.CircuitName, SessionName: data.Session.SessionName, SessionType: data.Session.SessionType}
}

func terminalSessionStatus(status string) bool {
	normalized := strings.ToLower(strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			return r
		}
		return -1
	}, status))
	switch normalized {
	case "finished", "finalised", "finalized", "ended", "aborted":
		return true
	default:
		return false
	}
}
