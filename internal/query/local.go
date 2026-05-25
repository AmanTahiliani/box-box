package query

import (
	"database/sql"
	"errors"

	"github.com/AmanTahiliani/box-box/internal/models"
)

// ListMeetingsByYear returns ingested meetings for a season.
func (s *Service) ListMeetingsByYear(year int) ([]models.Meeting, error) {
	rows, err := s.store.ListMeetingsByYear(year)
	if err != nil {
		return nil, err
	}
	out := make([]models.Meeting, 0, len(rows))
	for _, row := range rows {
		out = append(out, meetingToModel(row))
	}
	return out, nil
}

// ListSessionsByMeeting returns ingested sessions for a meeting.
func (s *Service) ListSessionsByMeeting(meetingKey int) ([]models.Session, error) {
	rows, err := s.store.ListSessionsByMeeting(meetingKey)
	if err != nil {
		return nil, err
	}
	out := make([]models.Session, 0, len(rows))
	for _, row := range rows {
		out = append(out, sessionToModel(row))
	}
	return out, nil
}

// ListDrivers returns ingested drivers for a session.
func (s *Service) ListDrivers(sessionKey int) ([]models.Driver, error) {
	sess, err := s.store.GetSession(sessionKey)
	if err != nil {
		return nil, err
	}
	driverLinks, err := s.store.ListSessionDrivers(sessionKey)
	if err != nil {
		return nil, err
	}
	out := make([]models.Driver, 0, len(driverLinks))
	for _, link := range driverLinks {
		d, err := s.store.GetDriver(link.DriverNumber)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		out = append(out, driverToModel(sessionKey, sess.MeetingKey, link, d))
	}
	return out, nil
}

// ListResults returns ingested session results enriched with driver fields.
func (s *Service) ListResults(sessionKey int) ([]EnrichedResult, error) {
	hub, err := s.GetRaceHub(sessionKey)
	if err != nil {
		return nil, err
	}
	return hub.Results, nil
}

// ListStartingGrid returns ingested starting grid rows enriched with driver fields.
func (s *Service) ListStartingGrid(sessionKey int) ([]EnrichedGrid, error) {
	hub, err := s.GetRaceHub(sessionKey)
	if err != nil {
		return nil, err
	}
	return hub.StartingGrid, nil
}
