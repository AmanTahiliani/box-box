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
	FetchStintsForSession(sessionKey int) (FetchResult, []models.Stint, error)
	FetchPitStopsForSession(sessionKey int) (FetchResult, []models.Pit, error)
	FetchPositionsForSession(sessionKey int) (FetchResult, []models.Position, error)
	FetchRaceControlForSession(sessionKey int) (FetchResult, []models.RaceControl, error)
	FetchWeatherForSession(sessionKey int) (FetchResult, []models.Weather, error)
	FetchLapsForSession(sessionKey int) (FetchResult, []models.Lap, error)
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

func (s *OpenF1Source) FetchStintsForSession(sessionKey int) (FetchResult, []models.Stint, error) {
	url := fmt.Sprintf("%s/v1/stints?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchStints(url, "stints", fmt.Sprintf("session_key=%d", sessionKey))
}

func (s *OpenF1Source) FetchPitStopsForSession(sessionKey int) (FetchResult, []models.Pit, error) {
	url := fmt.Sprintf("%s/v1/pit?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchPitStops(url, "pit", fmt.Sprintf("session_key=%d", sessionKey))
}

func (s *OpenF1Source) FetchPositionsForSession(sessionKey int) (FetchResult, []models.Position, error) {
	url := fmt.Sprintf("%s/v1/position?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchPositions(url, "position", fmt.Sprintf("session_key=%d", sessionKey))
}

func (s *OpenF1Source) FetchRaceControlForSession(sessionKey int) (FetchResult, []models.RaceControl, error) {
	url := fmt.Sprintf("%s/v1/race_control?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchRaceControl(url, "race_control", fmt.Sprintf("session_key=%d", sessionKey))
}

func (s *OpenF1Source) FetchWeatherForSession(sessionKey int) (FetchResult, []models.Weather, error) {
	url := fmt.Sprintf("%s/v1/weather?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchWeather(url, "weather", fmt.Sprintf("session_key=%d", sessionKey))
}

func (s *OpenF1Source) FetchLapsForSession(sessionKey int) (FetchResult, []models.Lap, error) {
	url := fmt.Sprintf("%s/v1/laps?session_key=%d", s.client.BaseURL(), sessionKey)
	return s.fetchLaps(url, "laps", fmt.Sprintf("session_key=%d", sessionKey))
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

func (s *OpenF1Source) fetchStints(url, endpoint, requestKey string) (FetchResult, []models.Stint, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.Stint
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

func (s *OpenF1Source) fetchPitStops(url, endpoint, requestKey string) (FetchResult, []models.Pit, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.Pit
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

func (s *OpenF1Source) fetchPositions(url, endpoint, requestKey string) (FetchResult, []models.Position, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.Position
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

func (s *OpenF1Source) fetchRaceControl(url, endpoint, requestKey string) (FetchResult, []models.RaceControl, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.RaceControl
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

func (s *OpenF1Source) fetchWeather(url, endpoint, requestKey string) (FetchResult, []models.Weather, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.Weather
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

func (s *OpenF1Source) fetchLaps(url, endpoint, requestKey string) (FetchResult, []models.Lap, error) {
	body, err := s.client.FetchStrict(url)
	if err != nil {
		return FetchResult{}, nil, err
	}
	var result []models.Lap
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

func stintToStore(st models.Stint) store.Stint {
	return store.Stint{
		SessionKey:     st.SessionKey,
		DriverNumber:   st.DriverNumber,
		MeetingKey:     st.MeetingKey,
		StintNumber:    st.StintNumber,
		Compound:       string(st.Compound),
		LapStart:       st.LapStart,
		LapEnd:         st.LapEnd,
		TyreAgeAtStart: st.TyreAgeAtStart,
	}
}

func pitStopToStore(p models.Pit) store.PitStop {
	stopDuration := p.StopDuration
	if stopDuration == 0 {
		stopDuration = p.PitDuration
	}
	return store.PitStop{
		SessionKey:   p.SessionKey,
		DriverNumber: p.DriverNumber,
		MeetingKey:   p.MeetingKey,
		LapNumber:    p.LapNumber,
		Date:         p.Date,
		PitDuration:  p.PitDuration,
		LaneDuration: p.LaneDuration,
		StopDuration: stopDuration,
	}
}

func positionToStore(p models.Position) store.PositionSample {
	return store.PositionSample{
		SessionKey:   p.SessionKey,
		DriverNumber: p.DriverNumber,
		MeetingKey:   p.MeetingKey,
		Date:         p.Date,
		Position:     p.Position,
	}
}

func raceControlToStore(rc models.RaceControl) store.RaceControlMessage {
	return store.RaceControlMessage{
		SessionKey:      rc.SessionKey,
		MeetingKey:      rc.MeetingKey,
		Date:            rc.Date,
		Category:        string(rc.Category),
		Flag:            string(rc.Flag),
		Message:         rc.Message,
		Scope:           rc.Scope,
		DriverNumber:    rc.DriverNumber,
		LapNumber:       rc.LapNumber,
		Sector:          rc.Sector,
		QualifyingPhase: rc.QualifyingPhase,
	}
}

func weatherToStore(w models.Weather) store.WeatherSample {
	return store.WeatherSample{
		SessionKey:       w.SessionKey,
		MeetingKey:       w.MeetingKey,
		Date:             w.Date,
		AirTemperature:   w.AirTemperature,
		TrackTemperature: w.TrackTemperature,
		Humidity:         w.Humidity,
		Pressure:         w.Pressure,
		Rainfall:         w.Rainfall,
		WindDirection:    w.WindDirection,
		WindSpeed:        w.WindSpeed,
	}
}

func lapToStore(l models.Lap) store.Lap {
	lap := store.Lap{
		SessionKey:   l.SessionKey,
		DriverNumber: l.DriverNumber,
		MeetingKey:   l.MeetingKey,
		LapNumber:    l.LapNumber,
		DateStart:    l.DateStart,
		IsPitOutLap:  l.IsPitOutLap,
	}
	if l.LapDuration != nil {
		lap.LapDuration = *l.LapDuration
	}
	if l.DurationSector1 != nil {
		lap.DurationSector1 = *l.DurationSector1
	}
	if l.DurationSector2 != nil {
		lap.DurationSector2 = *l.DurationSector2
	}
	if l.DurationSector3 != nil {
		lap.DurationSector3 = *l.DurationSector3
	}
	return lap
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
