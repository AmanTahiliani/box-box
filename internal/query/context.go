package query

import (
	"sort"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/store"
)

// TemporalState describes where the fan is in the current season/weekend.
type TemporalState string

const (
	TemporalNoSeason        TemporalState = "no_season"
	TemporalBetweenWeekends TemporalState = "between_weekends"
	TemporalPreSession      TemporalState = "pre_session"
	TemporalSessionLive     TemporalState = "session_live"
	TemporalSessionSettling TemporalState = "session_settling"
	TemporalBetweenSessions TemporalState = "between_sessions"
	TemporalPostWeekend     TemporalState = "post_weekend"
	TemporalSeasonComplete  TemporalState = "season_complete"

	preSessionWindow  = 48 * time.Hour
	postWeekendWindow = 48 * time.Hour
	raceHubPendingPollInterval = 15 * time.Second
)

// LiveEvidence is the small, transport-independent subset of FIA state needed
// by the context resolver. Active identity is authoritative over the schedule.
type LiveEvidence struct {
	Active      bool
	Final       bool
	MeetingName string
	CircuitName string
	SessionName string
	SessionType string
	ObservedAt  time.Time
}

// ContextAvailability is structured source state for a referenced session.
type ContextAvailability struct {
	Source        string   `json:"source"`
	Schedule      string   `json:"schedule"`
	LiveTransport string   `json:"live_transport"`
	LiveSession   string   `json:"live_session"`
	Archive       string   `json:"archive"`
	LocalAnalysis string   `json:"local_analysis"`
	Freshness     string   `json:"freshness"`
	ObservedAt    string   `json:"observed_at,omitempty"`
	Limitations   []string `json:"limitations"`
}

// ContextSession couples a session identity with its availability contract.
type ContextSession struct {
	Session      models.Session      `json:"session"`
	Meeting      *models.Meeting     `json:"meeting,omitempty"`
	Availability ContextAvailability `json:"availability"`
}

// WeekendContext is the canonical local-first previous/current/next model.
type WeekendContext struct {
	Season                   int             `json:"season,omitempty"`
	TemporalState            TemporalState   `json:"temporal_state"`
	PreviousMeeting          *models.Meeting `json:"previous_meeting,omitempty"`
	FocusMeeting             *models.Meeting `json:"focus_meeting,omitempty"`
	NextMeeting              *models.Meeting `json:"next_meeting,omitempty"`
	PreviousCompletedSession *ContextSession `json:"previous_completed_session,omitempty"`
	ActiveSession            *ContextSession `json:"active_session,omitempty"`
	NextSession              *ContextSession `json:"next_session,omitempty"`
	DefaultAnalysisSession   *ContextSession `json:"default_analysis_session,omitempty"`
	RaceHubDefaultSession    *ContextSession `json:"race_hub_default_session,omitempty"`
	RaceHubPreSession        bool            `json:"race_hub_pre_session"`
	RaceHubRefreshAt         string          `json:"race_hub_refresh_at,omitempty"`
	ChampionshipRound        int             `json:"championship_round"`
	TotalChampionshipRounds  int             `json:"total_championship_rounds"`
}

type contextCandidate struct {
	meeting  store.Meeting
	session  store.Session
	start    time.Time
	end      time.Time
	counts   store.SessionDatasetCounts
	complete bool
	archived bool
}

// ResolveWeekendContext computes the canonical context using only the domain
// store, the service clock, and optional in-memory FIA evidence.
func (s *Service) ResolveWeekendContext(evidence LiveEvidence) (WeekendContext, error) {
	now := s.now().UTC()
	out := WeekendContext{TemporalState: TemporalNoSeason}
	years, err := s.store.ListYears()
	if err != nil || len(years) == 0 {
		return out, err
	}
	out.Season = currentLocalSeason(years, now.Year())
	meetings, err := s.store.ListMeetingsByYear(out.Season)
	if err != nil {
		return WeekendContext{}, err
	}
	if len(meetings) == 0 {
		return out, nil
	}

	byMeeting := make(map[int][]store.Session, len(meetings))
	var candidates []contextCandidate
	for i := range meetings {
		m := meetings[i]
		sessions, listErr := s.store.ListSessionsByMeeting(m.MeetingKey)
		if listErr != nil {
			return WeekendContext{}, listErr
		}
		byMeeting[m.MeetingKey] = sessions
		applySessionDisplayRange(&meetings[i], sessions)
		m = meetings[i]
		for _, sess := range sessions {
			if m.IsCancelled || sess.IsCancelled {
				continue
			}
			start, _ := parseContextTime(sess.DateStart)
			end, _ := parseContextTime(sess.DateEnd)
			if end.IsZero() && !start.IsZero() {
				end = start.Add(3 * time.Hour)
			}
			counts, countErr := s.store.CountSessionDatasets(sess.SessionKey)
			if countErr != nil {
				return WeekendContext{}, countErr
			}
			archived := evidence.Final && liveMatches(evidence, m, sess)
			candidates = append(candidates, contextCandidate{
				meeting: m, session: sess, start: start, end: end, counts: counts,
				complete: hasMeaningfulAnalysis(counts) || archived, archived: archived,
			})
		}
	}
	sort.SliceStable(candidates, func(i, j int) bool { return candidates[i].start.Before(candidates[j].start) })

	champMeetings := championshipMeetings(meetings, byMeeting)
	out.TotalChampionshipRounds = len(champMeetings)

	var active *contextCandidate
	if evidence.Active {
		for i := range candidates {
			if liveMatches(evidence, candidates[i].meeting, candidates[i].session) {
				active = &candidates[i]
				break
			}
		}
		if active == nil {
			active = syntheticLiveCandidate(evidence, now)
		}
	}

	var previous, next, defaultAnalysis, pending *contextCandidate
	for i := range candidates {
		c := &candidates[i]
		isActive := active != nil && active.session.SessionKey != 0 && c.session.SessionKey == active.session.SessionKey
		completionEligible := c.start.IsZero() || !c.start.After(now) || c.archived
		if !isActive && c.complete && completionEligible && (previous == nil || candidateTime(*c).After(candidateTime(*previous))) {
			previous = c
		}
		if !isActive && c.complete && hasMeaningfulAnalysis(c.counts) && (c.start.IsZero() || !c.start.After(now)) && (defaultAnalysis == nil || candidateTime(*c).After(candidateTime(*defaultAnalysis))) {
			defaultAnalysis = c
		}
		if !isActive && !c.start.IsZero() && !c.start.Before(now) && (next == nil || c.start.Before(next.start)) {
			next = c
		}
		if !isActive && !c.complete && !c.start.IsZero() && !c.start.After(now) &&
			(c.end.IsZero() || now.Before(c.end)) && (pending == nil || c.start.After(pending.start)) {
			pending = c
		}
	}

	if previous != nil {
		out.PreviousCompletedSession = sessionRef(*previous, evidence, now)
		out.PreviousMeeting = meetingModelByKey(meetings, previous.meeting.MeetingKey)
	}
	if defaultAnalysis != nil {
		out.DefaultAnalysisSession = sessionRef(*defaultAnalysis, evidence, now)
	}
	if next != nil {
		out.NextSession = sessionRef(*next, evidence, now)
		out.NextMeeting = meetingModelByKey(meetings, next.meeting.MeetingKey)
	}
	if active != nil {
		out.ActiveSession = sessionRef(*active, evidence, now)
		out.FocusMeeting = out.ActiveSession.Meeting
		out.TemporalState = TemporalSessionLive
	} else {
		out.FocusMeeting = chooseFocusMeeting(meetings, previous, next)
		out.TemporalState = classifyTemporalState(now, previous, next, candidates, champMeetings, championshipScheduleUnknown(champMeetings, byMeeting))
	}
	if out.FocusMeeting != nil {
		out.ChampionshipRound = championshipRound(champMeetings, int(out.FocusMeeting.MeetingKey))
	}
	applyRaceHubDefault(&out, active, defaultAnalysis, next, pending, now)
	return out, nil
}

// applyRaceHubDefault is deliberately distinct from TemporalPreSession. Other
// weekend surfaces begin preparation 48 hours ahead; Race Hub remains an
// analysis destination until the one-hour handoff before the next session.
func applyRaceHubDefault(out *WeekendContext, active, analysis, next, pending *contextCandidate, now time.Time) {
	if active != nil {
		out.RaceHubDefaultSession = out.ActiveSession
		return
	}
	if next != nil {
		handoff := next.start.Add(-time.Hour)
		if now.Before(handoff) {
			out.RaceHubRefreshAt = handoff.Format(time.RFC3339)
		} else if now.Before(next.start) {
			out.RaceHubDefaultSession = out.NextSession
			out.RaceHubPreSession = true
			out.RaceHubRefreshAt = next.start.Format(time.RFC3339)
			return
		}
	}
	if pending != nil {
		out.RaceHubDefaultSession = sessionRef(*pending, LiveEvidence{}, now)
		out.RaceHubPreSession = true
		out.RaceHubRefreshAt = now.Add(raceHubPendingPollInterval).Format(time.RFC3339)
		return
	}
	if analysis != nil {
		out.RaceHubDefaultSession = out.DefaultAnalysisSession
	}
}

func currentLocalSeason(years []int, current int) int {
	for _, year := range years {
		if year == current {
			return year
		}
	}
	for _, year := range years {
		if year < current {
			return year
		}
	}
	return years[len(years)-1]
}

func parseContextTime(value string) (time.Time, bool) {
	if value == "" {
		return time.Time{}, false
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UTC(), true
		}
	}
	return time.Time{}, false
}

func hasMeaningfulAnalysis(c store.SessionDatasetCounts) bool {
	return c.Results > 0 || c.Laps > 0 || c.Stints > 0 || c.Positions > 0 || c.RaceControl > 0
}

func candidateTime(c contextCandidate) time.Time {
	if !c.end.IsZero() {
		return c.end
	}
	return c.start
}

func liveMatches(e LiveEvidence, m store.Meeting, s store.Session) bool {
	meetingMatch := normalizedContains(e.MeetingName, m.MeetingName) || normalizedContains(e.CircuitName, m.CircuitShortName)
	sessionMatch := normalizedEqual(e.SessionName, s.SessionName)
	if normalizeIdentity(e.SessionName) == "" {
		sessionMatch = normalizedEqual(e.SessionType, s.SessionType)
	}
	return meetingMatch && sessionMatch
}

func normalizedEqual(a, b string) bool {
	return normalizeIdentity(a) != "" && normalizeIdentity(a) == normalizeIdentity(b)
}
func normalizedContains(a, b string) bool {
	a, b = normalizeIdentity(a), normalizeIdentity(b)
	return a != "" && b != "" && (strings.Contains(a, b) || strings.Contains(b, a))
}
func normalizeIdentity(v string) string {
	return strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' {
			return r + ('a' - 'A')
		}
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		return -1
	}, v)
}

func syntheticLiveCandidate(e LiveEvidence, now time.Time) *contextCandidate {
	return &contextCandidate{meeting: store.Meeting{MeetingName: e.MeetingName, CircuitShortName: e.CircuitName}, session: store.Session{SessionName: e.SessionName, SessionType: e.SessionType, DateStart: now.Format(time.RFC3339)}, start: now}
}

func applySessionDisplayRange(m *store.Meeting, sessions []store.Session) {
	var first, last time.Time
	for _, sess := range sessions {
		if sess.IsCancelled {
			continue
		}
		start, ok := parseContextTime(sess.DateStart)
		if ok && (first.IsZero() || start.Before(first)) {
			first = start
		}
		end, ok := parseContextTime(sess.DateEnd)
		if !ok {
			end = start
		}
		if !end.IsZero() && (last.IsZero() || end.After(last)) {
			last = end
		}
	}
	if !first.IsZero() {
		m.DateStart = first.Format(time.RFC3339)
	}
	if !last.IsZero() {
		m.DateEnd = last.Format(time.RFC3339)
	}
}

func meetingModelByKey(meetings []store.Meeting, key int) *models.Meeting {
	for _, meeting := range meetings {
		if meeting.MeetingKey == key {
			model := meetingToModel(meeting)
			return &model
		}
	}
	return nil
}

func sessionRef(c contextCandidate, evidence LiveEvidence, now time.Time) *ContextSession {
	session := sessionToModel(c.session)
	meeting := meetingToModel(c.meeting)
	// Schedule and analysis are domain-store facts. Without an ingestion
	// timestamp the resolver cannot honestly call them network-fresh, so local
	// is the baseline freshness vocabulary exposed to clients.
	availability := ContextAvailability{Source: "local", Schedule: "available", LiveSession: "inactive", Archive: "unavailable", Freshness: "local", Limitations: []string{}}
	availability.LiveTransport = "unknown"
	if c.session.SessionKey == 0 {
		availability.Schedule = "unavailable"
		availability.Limitations = append(availability.Limitations, "schedule_identity_unmatched")
	}
	if evidence.Active && liveMatches(evidence, c.meeting, c.session) {
		availability.Source = "mixed"
		availability.LiveTransport = "connected"
		availability.LiveSession = "active"
		availability.Freshness = "live"
		if !evidence.ObservedAt.IsZero() {
			availability.ObservedAt = evidence.ObservedAt.Format(time.RFC3339)
		}
	}
	if c.archived {
		availability.Source = "mixed"
		availability.Archive = "available"
		availability.Freshness = "archive"
		if !evidence.ObservedAt.IsZero() {
			availability.ObservedAt = evidence.ObservedAt.Format(time.RFC3339)
		}
	}
	if c.counts.Results > 0 && (c.counts.Laps+c.counts.Stints+c.counts.Positions+c.counts.RaceControl > 0) {
		availability.LocalAnalysis = "complete"
	} else if hasMeaningfulAnalysis(c.counts) || c.counts.Drivers+c.counts.StartingGrid+c.counts.Weather > 0 {
		availability.LocalAnalysis = "partial"
	} else if !c.start.IsZero() && c.start.After(now) {
		availability.LocalAnalysis = "not_applicable"
	} else {
		availability.LocalAnalysis = "pending"
	}
	if availability.LocalAnalysis == "partial" && availability.Freshness == "local" {
		availability.Freshness = "partial"
	}
	if c.session.SessionKey == 0 && availability.LiveSession == "active" {
		availability.Source = "fia"
	}
	return &ContextSession{Session: session, Meeting: &meeting, Availability: availability}
}

func chooseFocusMeeting(meetings []store.Meeting, previous, next *contextCandidate) *models.Meeting {
	if next != nil {
		return meetingModelByKey(meetings, next.meeting.MeetingKey)
	}
	if previous != nil {
		return meetingModelByKey(meetings, previous.meeting.MeetingKey)
	}
	return nil
}

func classifyTemporalState(now time.Time, previous, next *contextCandidate, candidates []contextCandidate, championship []store.Meeting, scheduleUnknown bool) TemporalState {
	var latestStarted *contextCandidate
	for i := range candidates {
		if !candidates[i].start.IsZero() && !candidates[i].start.After(now) && (latestStarted == nil || candidates[i].start.After(latestStarted.start)) {
			latestStarted = &candidates[i]
		}
	}
	// Once a new meeting enters its preparation window, an ingest gap from an
	// older meeting must not keep the product stuck in settling.
	if next != nil && next.start.Sub(now) <= preSessionWindow && (latestStarted == nil || latestStarted.meeting.MeetingKey != next.meeting.MeetingKey) {
		return TemporalPreSession
	}
	if latestStarted != nil && !latestStarted.complete && !latestStarted.end.IsZero() {
		if now.Before(latestStarted.end) {
			return TemporalPreSession
		}
		return TemporalSessionSettling
	}
	if previous != nil && next != nil && previous.meeting.MeetingKey == next.meeting.MeetingKey {
		return TemporalBetweenSessions
	}
	if previous != nil && meetingFinalSession(*previous, candidates) && !candidateTime(*previous).After(now) && now.Sub(candidateTime(*previous)) <= postWeekendWindow {
		return TemporalPostWeekend
	}
	if next != nil && next.start.Sub(now) <= preSessionWindow {
		return TemporalPreSession
	}
	if next == nil && len(championship) > 0 && !scheduleUnknown {
		return TemporalSeasonComplete
	}
	return TemporalBetweenWeekends
}

func championshipScheduleUnknown(meetings []store.Meeting, sessions map[int][]store.Session) bool {
	for _, meeting := range meetings {
		for _, session := range sessions[meeting.MeetingKey] {
			if !session.IsCancelled && isChampionshipRace(session) {
				if _, ok := parseContextTime(session.DateStart); !ok {
					return true
				}
			}
		}
	}
	return false
}

func meetingFinalSession(previous contextCandidate, candidates []contextCandidate) bool {
	latest := previous.start
	for _, c := range candidates {
		if c.meeting.MeetingKey == previous.meeting.MeetingKey && c.start.After(latest) {
			return false
		}
	}
	return true
}

func championshipMeetings(meetings []store.Meeting, sessions map[int][]store.Session) []store.Meeting {
	var out []store.Meeting
	for _, m := range meetings {
		if m.IsCancelled || isTestMeeting(m) {
			continue
		}
		for _, sess := range sessions[m.MeetingKey] {
			if !sess.IsCancelled && isChampionshipRace(sess) {
				out = append(out, m)
				break
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, _ := parseContextTime(out[i].DateStart)
		b, _ := parseContextTime(out[j].DateStart)
		return a.Before(b)
	})
	return out
}

func isTestMeeting(m store.Meeting) bool {
	n := strings.ToLower(m.MeetingName + " " + m.MeetingOfficialName)
	return strings.Contains(n, "test")
}
func isChampionshipRace(s store.Session) bool {
	n := strings.ToLower(s.SessionName)
	t := strings.ToLower(s.SessionType)
	return (n == "race" || t == "race") && !strings.Contains(n, "sprint") && !strings.Contains(t, "sprint")
}
func championshipRound(meetings []store.Meeting, key int) int {
	for i, m := range meetings {
		if m.MeetingKey == key {
			return i + 1
		}
	}
	return 0
}
