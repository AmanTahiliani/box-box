package web

import (
	"net/http"
	"strings"

	"github.com/AmanTahiliani/box-box/internal/live"
	"github.com/AmanTahiliani/box-box/internal/query"
)

func (s *Server) handleWeekendContext(w http.ResponseWriter, _ *http.Request) {
	markLocalResponse(w, false)
	if !s.hasLocalQuery() {
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
	for _, ref := range []*query.ContextSession{context.ActiveSession, context.PreviousCompletedSession, context.DefaultAnalysisSession, context.NextSession} {
		if ref != nil && ref.Availability.Freshness != "local" {
			markDataResponse(w, ref.Availability.Source, ref.Availability.Freshness)
			break
		}
	}
	writeJSON(w, context)
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
