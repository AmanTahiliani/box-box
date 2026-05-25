package ingest

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/store"
)

// Options configures ingestion behavior.
type Options struct {
	DryRun       bool
	RequestDelay time.Duration
	MaxRetries   int
	RetryBackoff time.Duration
	Progress     *Progress
}

// DefaultOptions returns conservative ingestion defaults.
func DefaultOptions() Options {
	return Options{
		RequestDelay: 300 * time.Millisecond,
		MaxRetries:   3,
		RetryBackoff: 500 * time.Millisecond,
		Progress:     NewProgress(nil),
	}
}

// Summary captures the outcome of an ingestion run.
type Summary struct {
	ScopeType      string   `json:"scope_type"`
	ScopeKey       string   `json:"scope_key"`
	Status         string   `json:"status"`
	DryRun         bool     `json:"dry_run"`
	Meetings       int      `json:"meetings"`
	Sessions       int      `json:"sessions"`
	Drivers        int      `json:"drivers"`
	SessionResults int      `json:"session_results"`
	StartingGrid   int      `json:"starting_grid"`
	RawPayloads    int      `json:"raw_payloads"`
	RawInserted    int      `json:"raw_inserted"`
	Errors         []string `json:"errors,omitempty"`
}

// Service orchestrates OpenF1-to-store ingestion workflows.
type Service struct {
	store  *store.Store
	source Source
	opts   Options
}

// NewService creates an ingestion service.
func NewService(st *store.Store, source Source, opts Options) *Service {
	if opts.MaxRetries <= 0 {
		opts.MaxRetries = 3
	}
	if opts.RetryBackoff <= 0 {
		opts.RetryBackoff = 500 * time.Millisecond
	}
	if opts.RequestDelay <= 0 {
		opts.RequestDelay = 300 * time.Millisecond
	}
	if opts.Progress == nil {
		opts.Progress = NewProgress(nil)
	}
	return &Service{store: st, source: source, opts: opts}
}

// IngestYear fetches and stores all meetings for a season year.
func (s *Service) IngestYear(year int) (Summary, error) {
	summary := Summary{
		ScopeType: "year",
		ScopeKey:  fmt.Sprintf("%d", year),
		DryRun:    s.opts.DryRun,
	}
	if year < 2023 {
		return summary, fmt.Errorf("invalid year %d: must be 2023 or later", year)
	}

	runID, err := s.beginRun(summary.ScopeType, summary.ScopeKey)
	if err != nil {
		return summary, err
	}

	s.opts.Progress.Step("fetching meetings for %d", year)
	fetch, meetings, err := fetchWithRetry(s, func() (FetchResult, []models.Meeting, error) {
		return s.source.FetchMeetingsForYear(year)
	})
	if err != nil {
		return s.finishFailed(runID, summary, err)
	}

	summary.RawPayloads++
	if !s.opts.DryRun {
		inserted, err := s.storeRaw(fetch, nil, nil)
		if err != nil {
			return s.finishFailed(runID, summary, err)
		}
		if inserted {
			summary.RawInserted++
		}
	}
	s.delay()

	for _, m := range meetings {
		if s.opts.DryRun {
			summary.Meetings++
			continue
		}
		if err := s.store.UpsertMeeting(meetingToStore(m)); err != nil {
			return s.finishFailed(runID, summary, err)
		}
		summary.Meetings++
	}

	summary.Status = statusForDryRun(s.opts.DryRun)
	s.finishRun(runID, summary)
	s.opts.Progress.Summary(summary)
	return summary, nil
}

// IngestMeeting fetches meeting metadata and all sessions for a meeting key.
func (s *Service) IngestMeeting(meetingKey int) (Summary, error) {
	summary := Summary{
		ScopeType: "meeting",
		ScopeKey:  fmt.Sprintf("%d", meetingKey),
		DryRun:    s.opts.DryRun,
	}

	runID, err := s.beginRun(summary.ScopeType, summary.ScopeKey)
	if err != nil {
		return summary, err
	}

	s.opts.Progress.Step("fetching meeting %d", meetingKey)
	meetingFetch, meetings, err := fetchWithRetry(s, func() (FetchResult, []models.Meeting, error) {
		return s.source.FetchMeetingsForMeetingKey(meetingKey)
	})
	if err != nil {
		return s.finishFailed(runID, summary, err)
	}
	summary.RawPayloads++
	if !s.opts.DryRun {
		mk := meetingKey
		inserted, err := s.storeRaw(meetingFetch, &mk, nil)
		if err != nil {
			return s.finishFailed(runID, summary, err)
		}
		if inserted {
			summary.RawInserted++
		}
	}
	s.delay()

	for _, m := range meetings {
		if s.opts.DryRun {
			summary.Meetings++
			continue
		}
		if err := s.store.UpsertMeeting(meetingToStore(m)); err != nil {
			return s.finishFailed(runID, summary, err)
		}
		summary.Meetings++
	}

	s.opts.Progress.Step("fetching sessions for meeting %d", meetingKey)
	sessionFetch, sessions, err := fetchWithRetry(s, func() (FetchResult, []models.Session, error) {
		return s.source.FetchSessionsForMeeting(meetingKey)
	})
	if err != nil {
		return s.finishFailed(runID, summary, err)
	}
	summary.RawPayloads++
	if !s.opts.DryRun {
		mk := meetingKey
		inserted, err := s.storeRaw(sessionFetch, &mk, nil)
		if err != nil {
			return s.finishFailed(runID, summary, err)
		}
		if inserted {
			summary.RawInserted++
		}
	}
	s.delay()

	for _, sess := range sessions {
		if s.opts.DryRun {
			summary.Sessions++
			continue
		}
		if err := s.store.UpsertSession(sessionToStore(sess)); err != nil {
			return s.finishFailed(runID, summary, err)
		}
		summary.Sessions++
	}

	summary.Status = statusForDryRun(s.opts.DryRun)
	s.finishRun(runID, summary)
	s.opts.Progress.Summary(summary)
	return summary, nil
}

// IngestSession ingests Race Hub v1 datasets for a single session.
func (s *Service) IngestSession(sessionKey int) (Summary, error) {
	summary := Summary{
		ScopeType: "session",
		ScopeKey:  fmt.Sprintf("%d", sessionKey),
		DryRun:    s.opts.DryRun,
	}

	runID, err := s.beginRun(summary.ScopeType, summary.ScopeKey)
	if err != nil {
		return summary, err
	}

	s.opts.Progress.Step("fetching session %d", sessionKey)
	sessionFetch, sessions, err := fetchWithRetry(s, func() (FetchResult, []models.Session, error) {
		return s.source.FetchSessionsForSessionKey(sessionKey)
	})
	if err != nil {
		return s.finishFailed(runID, summary, err)
	}
	if len(sessions) == 0 {
		err := fmt.Errorf("session %d not found", sessionKey)
		return s.finishFailed(runID, summary, err)
	}
	sess := sessions[0]
	meetingKey := sess.MeetingKey
	sk := sessionKey

	summary.RawPayloads++
	if !s.opts.DryRun {
		inserted, err := s.storeRaw(sessionFetch, &meetingKey, &sk)
		if err != nil {
			return s.finishFailed(runID, summary, err)
		}
		if inserted {
			summary.RawInserted++
		}
	}
	s.delay()

	s.opts.Progress.Step("fetching meeting %d for session context", meetingKey)
	meetingFetch, meetings, err := fetchWithRetry(s, func() (FetchResult, []models.Meeting, error) {
		return s.source.FetchMeetingsForMeetingKey(meetingKey)
	})
	if err != nil {
		return s.finishFailed(runID, summary, err)
	}
	summary.RawPayloads++
	if !s.opts.DryRun {
		inserted, err := s.storeRaw(meetingFetch, &meetingKey, &sk)
		if err != nil {
			return s.finishFailed(runID, summary, err)
		}
		if inserted {
			summary.RawInserted++
		}
		for _, m := range meetings {
			if err := s.store.UpsertMeeting(meetingToStore(m)); err != nil {
				return s.finishFailed(runID, summary, err)
			}
			summary.Meetings++
		}
	} else {
		summary.Meetings = len(meetings)
	}
	s.delay()

	if s.opts.DryRun {
		summary.Sessions++
	} else {
		if err := s.store.UpsertSession(sessionToStore(sess)); err != nil {
			return s.finishFailed(runID, summary, err)
		}
		summary.Sessions++
	}

	s.opts.Progress.Step("fetching drivers for session %d", sessionKey)
	driverFetch, drivers, err := fetchWithRetry(s, func() (FetchResult, []models.Driver, error) {
		return s.source.FetchDriversForSession(sessionKey)
	})
	if err != nil {
		return s.finishFailed(runID, summary, err)
	}
	summary.RawPayloads++
	if !s.opts.DryRun {
		inserted, err := s.storeRaw(driverFetch, &meetingKey, &sk)
		if err != nil {
			return s.finishFailed(runID, summary, err)
		}
		if inserted {
			summary.RawInserted++
		}
		for _, d := range drivers {
			if err := s.store.UpsertDriver(driverToStore(d)); err != nil {
				return s.finishFailed(runID, summary, err)
			}
			if err := s.store.UpsertSessionDriver(sessionDriverToStore(d)); err != nil {
				return s.finishFailed(runID, summary, err)
			}
			summary.Drivers++
		}
	} else {
		summary.Drivers = len(drivers)
	}
	s.delay()

	s.opts.Progress.Step("fetching session results for session %d", sessionKey)
	resultFetch, results, err := fetchWithRetry(s, func() (FetchResult, []models.SessionResult, error) {
		return s.source.FetchSessionResult(sessionKey)
	})
	if err != nil {
		return s.finishFailed(runID, summary, err)
	}
	summary.RawPayloads++
	if !s.opts.DryRun {
		inserted, err := s.storeRaw(resultFetch, &meetingKey, &sk)
		if err != nil {
			return s.finishFailed(runID, summary, err)
		}
		if inserted {
			summary.RawInserted++
		}
		for _, r := range results {
			if err := s.store.UpsertSessionResult(sessionResultToStore(r)); err != nil {
				return s.finishFailed(runID, summary, err)
			}
			summary.SessionResults++
		}
	} else {
		summary.SessionResults = len(results)
	}
	s.delay()

	s.opts.Progress.Step("fetching starting grid for session %d", sessionKey)
	gridFetch, grid, err := fetchWithRetry(s, func() (FetchResult, []models.StartingGrid, error) {
		return s.source.FetchStartingGrid(sessionKey)
	})
	if err != nil {
		return s.finishFailed(runID, summary, err)
	}
	summary.RawPayloads++
	if !s.opts.DryRun {
		inserted, err := s.storeRaw(gridFetch, &meetingKey, &sk)
		if err != nil {
			return s.finishFailed(runID, summary, err)
		}
		if inserted {
			summary.RawInserted++
		}
		for _, g := range grid {
			if err := s.store.UpsertStartingGridEntry(startingGridToStore(g)); err != nil {
				return s.finishFailed(runID, summary, err)
			}
			summary.StartingGrid++
		}
	} else {
		summary.StartingGrid = len(grid)
	}

	summary.Status = statusForDryRun(s.opts.DryRun)
	s.finishRun(runID, summary)
	s.opts.Progress.Summary(summary)
	return summary, nil
}

func (s *Service) beginRun(scopeType, scopeKey string) (int64, error) {
	if s.opts.DryRun {
		return 0, nil
	}
	return s.store.CreateIngestionRun(scopeType, scopeKey, false)
}

func (s *Service) finishRun(runID int64, summary Summary) {
	if s.opts.DryRun || runID == 0 {
		return
	}
	b, _ := json.Marshal(summary)
	_ = s.store.FinishIngestionRun(runID, summary.Status, string(b))
}

func (s *Service) finishFailed(runID int64, summary Summary, err error) (Summary, error) {
	summary.Status = "failed"
	summary.Errors = append(summary.Errors, err.Error())
	if runID != 0 && !s.opts.DryRun {
		b, _ := json.Marshal(summary)
		_ = s.store.FinishIngestionRun(runID, summary.Status, string(b))
	}
	s.opts.Progress.Summary(summary)
	return summary, err
}

func (s *Service) storeRaw(fetch FetchResult, meetingKey, sessionKey *int) (bool, error) {
	_, inserted, err := s.store.InsertRawPayload(store.RawPayload{
		Source:         sourceOpenF1,
		Endpoint:       fetch.Endpoint,
		RequestKey:     fetch.RequestKey,
		MeetingKey:     meetingKey,
		SessionKey:     sessionKey,
		Payload:        string(fetch.Body),
		FetchedAt:      fetch.FetchedAt,
		ProvenanceJSON: provenanceJSON(fetch),
	})
	return inserted, err
}

func (s *Service) delay() {
	if s.opts.RequestDelay > 0 {
		time.Sleep(s.opts.RequestDelay)
	}
}

func statusForDryRun(dryRun bool) string {
	if dryRun {
		return "dry_run"
	}
	return "completed"
}

type fetchFunc[T any] func() (FetchResult, T, error)

func fetchWithRetry[T any](s *Service, fn fetchFunc[T]) (FetchResult, T, error) {
	var zero T
	var lastErr error

	for attempt := 0; attempt < s.opts.MaxRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(s.opts.RetryBackoff * time.Duration(attempt))
		}

		fetch, data, err := fn()
		if err == nil {
			return fetch, data, nil
		}
		lastErr = err

		if api.IsLiveSessionError(err) {
			return FetchResult{}, zero, err
		}
		if !isRetryable(err) {
			return FetchResult{}, zero, err
		}
	}

	return FetchResult{}, zero, lastErr
}

func isRetryable(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "status 429") ||
		strings.Contains(msg, "status 5") ||
		strings.Contains(msg, "timeout") ||
		strings.Contains(msg, "connection reset") ||
		strings.Contains(msg, "temporary") {
		return true
	}
	var netErr interface{ Timeout() bool }
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	return false
}
