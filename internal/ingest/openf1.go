package ingest

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/store"
)

const sourceOpenF1 = "openf1"

// FetchResult holds a fetched OpenF1 endpoint response with provenance metadata.
type FetchResult struct {
	Endpoint   string
	RequestKey string
	URL        string
	Body       []byte
	FetchedAt  time.Time
}

// Source fetches OpenF1 REST data for ingestion workflows.
type Source interface {
	FetchMeetingsForYear(year int) (FetchResult, []models.Meeting, error)
	FetchMeetingsForMeetingKey(meetingKey int) (FetchResult, []models.Meeting, error)
	FetchSessionsForMeeting(meetingKey int) (FetchResult, []models.Session, error)
	FetchSessionsForSessionKey(sessionKey int) (FetchResult, []models.Session, error)
	FetchDriversForSession(sessionKey int) (FetchResult, []models.Driver, error)
	FetchSessionResult(sessionKey int) (FetchResult, []models.SessionResult, error)
	FetchStartingGrid(sessionKey int) (FetchResult, []models.StartingGrid, error)
}

// OpenF1Source adapts OpenF1Client for ingestion using strict fetches.
type OpenF1Source struct {
	client *api.OpenF1Client
}

// NewOpenF1Source returns a Source backed by the OpenF1 API client.
func NewOpenF1Source(client *api.OpenF1Client) *OpenF1Source {
	return &OpenF1Source{client: client}
}

func (s *OpenF1Source) FetchMeetingsForYear(year int) (FetchResult, []models.Meeting, error) {
	url := fmt.Sprintf("%s/v1/meetings?year=%d", s.client.BaseURL(), year)
	return s.fetchMeetings(url, "meetings", fmt.Sprintf("year=%d", year))
}

func (s *OpenF1Source) FetchMeetingsForMeetingKey(meetingKey int) (FetchResult, []models.Meeting, error) {
	url := fmt.Sprintf("%s/v1/meetings?meeting_key=%d", s.client.BaseURL(), meetingKey)
	return s.fetchMeetings(url, "meetings", fmt.Sprintf("meeting_key=%d", meetingKey))
}

func (s *OpenF1Source) FetchSessionsForMeeting(meetingKey int) (FetchResult, []models.Session, error) {
	url := fmt.Sprintf("%s/v1/sessions?meeting_key=%d", s.client.BaseURL(), meetingKey)
	return s.fetchSessions(url, "sessions", fmt.Sprintf("meeting_key=%d", meetingKey))
}

func (s *OpenF1Source) FetchSessionsForSessionKey(sessionKey int) (FetchResult, []models.Session, error) {
	url := fmt.Sprintf("%s/v1/sessions?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchSessions(url, "sessions", fmt.Sprintf("session_key=%d", sessionKey))
}

func (s *OpenF1Source) FetchDriversForSession(sessionKey int) (FetchResult, []models.Driver, error) {
	url := fmt.Sprintf("%s/v1/drivers?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchDrivers(url, "drivers", fmt.Sprintf("session_key=%d", sessionKey))
}

func (s *OpenF1Source) FetchSessionResult(sessionKey int) (FetchResult, []models.SessionResult, error) {
	url := fmt.Sprintf("%s/v1/session_result?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchSessionResults(url, "session_result", fmt.Sprintf("session_key=%d", sessionKey))
}

func (s *OpenF1Source) FetchStartingGrid(sessionKey int) (FetchResult, []models.StartingGrid, error) {
	url := fmt.Sprintf("%s/v1/starting_grid?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchStartingGrid(url, "starting_grid", fmt.Sprintf("session_key=%d", sessionKey))
}

func (s *OpenF1Source) fetchMeetings(url, endpoint, requestKey string) (FetchResult, []models.Meeting, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.Meeting
	if err := json.Unmarshal(body, &result); err != nil {
		return FetchResult{}, nil, err
	}
	return FetchResult{
		Endpoint:   endpoint,
		RequestKey: requestKey,
		URL:        url,
		Body:       body,
		FetchedAt:  time.Now(),
	}, result, nil
}

func (s *OpenF1Source) fetchSessions(url, endpoint, requestKey string) (FetchResult, []models.Session, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.Session
	if err := json.Unmarshal(body, &result); err != nil {
		return FetchResult{}, nil, err
	}
	return FetchResult{
		Endpoint:   endpoint,
		RequestKey: requestKey,
		URL:        url,
		Body:       body,
		FetchedAt:  time.Now(),
	}, result, nil
}

func (s *OpenF1Source) fetchDrivers(url, endpoint, requestKey string) (FetchResult, []models.Driver, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.Driver
	if err := json.Unmarshal(body, &result); err != nil {
		return FetchResult{}, nil, err
	}
	return FetchResult{
		Endpoint:   endpoint,
		RequestKey: requestKey,
		URL:        url,
		Body:       body,
		FetchedAt:  time.Now(),
	}, result, nil
}

func (s *OpenF1Source) fetchSessionResults(url, endpoint, requestKey string) (FetchResult, []models.SessionResult, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.SessionResult
	if err := json.Unmarshal(body, &result); err != nil {
		return FetchResult{}, nil, err
	}
	return FetchResult{
		Endpoint:   endpoint,
		RequestKey: requestKey,
		URL:        url,
		Body:       body,
		FetchedAt:  time.Now(),
	}, result, nil
}

func (s *OpenF1Source) fetchStartingGrid(url, endpoint, requestKey string) (FetchResult, []models.StartingGrid, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.StartingGrid
	if err := json.Unmarshal(body, &result); err != nil {
		return FetchResult{}, nil, err
	}
	return FetchResult{
		Endpoint:   endpoint,
		RequestKey: requestKey,
		URL:        url,
		Body:       body,
		FetchedAt:  time.Now(),
	}, result, nil
}

func meetingToStore(m models.Meeting) store.Meeting {
	return store.Meeting{
		MeetingKey:          int(m.MeetingKey),
		MeetingName:         m.MeetingName,
		MeetingOfficialName: m.MeetingOfficialName,
		Location:            m.Location,
		CountryCode:         m.CountryCode,
		CountryName:         m.CountryName,
		CircuitKey:          m.CircuitKey,
		CircuitShortName:    m.CircuitShortName,
		GMTOffset:           m.GMTOffset,
		DateStart:           m.DateStart,
		DateEnd:             m.DateEnd,
		Year:                m.Year,
	}
}

func sessionToStore(s models.Session) store.Session {
	return store.Session{
		SessionKey:  s.SessionKey,
		MeetingKey:  s.MeetingKey,
		SessionName: s.SessionName,
		SessionType: s.SessionType,
		CircuitKey:  s.CircuitKey,
		DateStart:   s.DateStart,
		DateEnd:     s.DateEnd,
		GMTOffset:   s.GMTOffset,
	}
}

func driverToStore(d models.Driver) store.Driver {
	return store.Driver{
		DriverNumber:  d.DriverNumber,
		BroadcastName: d.BroadcastName,
		FirstName:     d.FirstName,
		FullName:      d.FullName,
		LastName:      d.LastName,
		NameAcronym:   d.NameAcronym,
		HeadshotURL:   d.HeadshotURL,
		TeamName:      d.TeamName,
		TeamColour:    d.TeamColour,
	}
}

func sessionDriverToStore(d models.Driver) store.SessionDriver {
	return store.SessionDriver{
		SessionKey:   d.SessionKey,
		DriverNumber: d.DriverNumber,
		MeetingKey:   d.MeetingKey,
		TeamName:     d.TeamName,
		TeamColour:   d.TeamColour,
	}
}

func sessionResultToStore(r models.SessionResult) store.SessionResult {
	return store.SessionResult{
		SessionKey:      r.SessionKey,
		DriverNumber:    r.DriverNumber,
		MeetingKey:      r.MeetingKey,
		Position:        r.Position,
		Points:          r.Points,
		NumberOfLaps:    r.NumberOfLaps,
		DurationJSON:    jsonField(r.Duration),
		GapToLeaderJSON: jsonField(r.GapToLeader),
		DNF:             r.DNF,
		DNS:             r.DNS,
		DSQ:             r.DSQ,
	}
}

func startingGridToStore(g models.StartingGrid) store.StartingGridEntry {
	return store.StartingGridEntry{
		SessionKey:   g.SessionKey,
		DriverNumber: g.DriverNumber,
		MeetingKey:   g.MeetingKey,
		Position:     g.Position,
		LapDuration:  g.LapDuration,
	}
}

func jsonField(v any) string {
	if v == nil {
		return ""
	}
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

func provenanceJSON(fetch FetchResult) string {
	meta := map[string]string{
		"url": fetch.URL,
	}
	b, err := json.Marshal(meta)
	if err != nil {
		return ""
	}
	return string(b)
}
