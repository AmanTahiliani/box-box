package ui

import (
	"fmt"
	"sort"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

const defaultSessionDuration = 3 * time.Hour

func parseScheduleTime(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, fmt.Errorf("empty time value")
	}

	t, err := time.Parse(time.RFC3339, value)
	if err == nil {
		return t.Local(), nil
	}

	t, err = time.Parse("2006-01-02", value[:min(len(value), 10)])
	if err != nil {
		return time.Time{}, err
	}
	return t.Local(), nil
}

func meetingStartTime(meeting models.Meeting) (time.Time, error) {
	return parseScheduleTime(meeting.DateStart)
}

func meetingEndTime(meeting models.Meeting) (time.Time, error) {
	if meeting.DateEnd != "" {
		if end, err := parseScheduleTime(meeting.DateEnd); err == nil {
			return end, nil
		}
	}

	start, err := meetingStartTime(meeting)
	if err != nil {
		return time.Time{}, err
	}
	return start.Add(72 * time.Hour), nil
}

func sessionStartTime(session models.Session) (time.Time, error) {
	return parseScheduleTime(session.DateStart)
}

func sessionEndTime(session models.Session) (time.Time, error) {
	if session.DateEnd != "" {
		if end, err := parseScheduleTime(session.DateEnd); err == nil {
			return end, nil
		}
	}

	start, err := sessionStartTime(session)
	if err != nil {
		return time.Time{}, err
	}
	return start.Add(defaultSessionDuration), nil
}

func sortSessionsByStart(sessions []models.Session) {
	sort.Slice(sessions, func(i, j int) bool {
		left, errLeft := sessionStartTime(sessions[i])
		right, errRight := sessionStartTime(sessions[j])
		if errLeft != nil || errRight != nil {
			return sessions[i].DateStart < sessions[j].DateStart
		}
		return left.Before(right)
	})
}

func currentMeeting(meetings []models.Meeting, now time.Time) *models.Meeting {
	var selected *models.Meeting
	var latest time.Time

	for i := range meetings {
		start, err := meetingStartTime(meetings[i])
		if err != nil || start.After(now) {
			continue
		}
		end, err := meetingEndTime(meetings[i])
		if err != nil || now.After(end.Add(24*time.Hour)) {
			continue
		}
		if selected == nil || start.After(latest) {
			selected = &meetings[i]
			latest = start
		}
	}

	return selected
}

func nextUpcomingMeeting(meetings []models.Meeting, now time.Time) *models.Meeting {
	for i := range meetings {
		start, err := meetingStartTime(meetings[i])
		if err != nil {
			continue
		}
		if start.After(now) {
			return &meetings[i]
		}
	}
	return nil
}

func currentAndNextSession(sessions []models.Session, now time.Time) (*models.Session, *models.Session) {
	for i := range sessions {
		start, err := sessionStartTime(sessions[i])
		if err != nil {
			continue
		}
		end, err := sessionEndTime(sessions[i])
		if err != nil {
			continue
		}

		if (now.Equal(start) || now.After(start)) && now.Before(end) {
			return &sessions[i], nil
		}
		if now.Before(start) {
			return nil, &sessions[i]
		}
	}

	return nil, nil
}

func meetingHasStarted(meeting models.Meeting, now time.Time) bool {
	start, err := meetingStartTime(meeting)
	if err != nil {
		return false
	}
	return !now.Before(start)
}
