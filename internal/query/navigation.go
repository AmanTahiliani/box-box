package query

import (
	"database/sql"
	"errors"

	"github.com/AmanTahiliani/box-box/internal/models"
)

// ErrMeetingNotFound is returned when a meeting is not in the local store.
var ErrMeetingNotFound = errors.New("meeting not found")

// WeekendSession is one session within a meeting with dataset coverage.
type WeekendSession struct {
	Session  models.Session         `json:"session"`
	Source   string                 `json:"source"`
	Datasets map[string]DatasetInfo `json:"datasets"`
}

// Weekend is the local-first read model for one race weekend.
type Weekend struct {
	Source            string           `json:"source"`
	MeetingKey        int              `json:"meeting_key"`
	Meeting           models.Meeting   `json:"meeting"`
	Sessions          []WeekendSession `json:"sessions"`
	DefaultSessionKey int              `json:"default_session_key,omitempty"`
}

// ListSeasons returns years with ingested meetings, newest first.
func (s *Service) ListSeasons() ([]int, error) {
	return s.store.ListYears()
}

// GetWeekend loads meeting metadata, sessions, and per-session dataset coverage.
func (s *Service) GetWeekend(meetingKey int) (Weekend, error) {
	meeting, err := s.store.GetMeeting(meetingKey)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Weekend{}, ErrMeetingNotFound
		}
		return Weekend{}, err
	}

	sessions, err := s.store.ListSessionsByMeeting(meetingKey)
	if err != nil {
		return Weekend{}, err
	}

	out := Weekend{
		Source:     ResponseSourceNone,
		MeetingKey: meetingKey,
		Meeting:    meetingToModel(meeting),
		Sessions:   []WeekendSession{},
	}

	if len(sessions) == 0 {
		return out, nil
	}

	out.Sessions = make([]WeekendSession, 0, len(sessions))
	for _, sess := range sessions {
		counts, err := s.store.CountSessionDatasets(sess.SessionKey)
		if err != nil {
			return Weekend{}, err
		}
		datasets := datasetsFromCounts(true, true, counts)
		out.Sessions = append(out.Sessions, WeekendSession{
			Session:  sessionToModel(sess),
			Source:   responseSource(datasets),
			Datasets: datasets,
		})
	}

	out.Source = weekendSource(out.Sessions)
	out.DefaultSessionKey = pickDefaultSession(out.Sessions)
	return out, nil
}

func weekendSource(sessions []WeekendSession) string {
	if len(sessions) == 0 {
		return ResponseSourceNone
	}
	hasLocal := false
	allMissing := true
	for _, sess := range sessions {
		if sess.Source == ResponseSourceNone {
			continue
		}
		allMissing = false
		if sess.Source == ResponseSourceLocal || sess.Source == ResponseSourcePartial {
			hasLocal = true
		}
	}
	if allMissing {
		return ResponseSourceNone
	}
	for _, sess := range sessions {
		if sess.Source == ResponseSourcePartial || sess.Source == ResponseSourceNone {
			return ResponseSourcePartial
		}
	}
	if hasLocal {
		return ResponseSourceLocal
	}
	return ResponseSourceNone
}

func pickDefaultSession(sessions []WeekendSession) int {
	if len(sessions) == 0 {
		return 0
	}

	bestIdx := 0
	bestScore := datasetScore(sessions[0].Datasets)
	for i := 1; i < len(sessions); i++ {
		score := datasetScore(sessions[i].Datasets)
		if score >= bestScore {
			bestScore = score
			bestIdx = i
		}
	}
	return sessions[bestIdx].Session.SessionKey
}

func datasetScore(datasets map[string]DatasetInfo) int {
	score := 0
	for _, info := range datasets {
		if info.Status == DatasetStatusAvailable {
			score++
		}
	}
	return score
}
