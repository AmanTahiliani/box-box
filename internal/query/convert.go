package query

import (
	"encoding/json"

	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/store"
)

func meetingToModel(m store.Meeting) models.Meeting {
	return models.Meeting{
		MeetingKey:          int32(m.MeetingKey),
		MeetingName:         m.MeetingName,
		MeetingOfficialName: m.MeetingOfficialName,
		Location:            m.Location,
		CountryCode:         m.CountryCode,
		CountryName:         m.CountryName,
		Circuit: models.Circuit{
			CircuitKey:       m.CircuitKey,
			CircuitShortName: m.CircuitShortName,
		},
		GMTOffset: m.GMTOffset,
		DateStart: m.DateStart,
		DateEnd:   m.DateEnd,
		Year:      m.Year,
	}
}

func sessionToModel(s store.Session) models.Session {
	return models.Session{
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

func driverToModel(sessionKey, meetingKey int, sd store.SessionDriver, d store.Driver) models.Driver {
	teamName := sd.TeamName
	if teamName == "" {
		teamName = d.TeamName
	}
	teamColour := sd.TeamColour
	if teamColour == "" {
		teamColour = d.TeamColour
	}
	return models.Driver{
		BroadcastName: d.BroadcastName,
		DriverNumber:  sd.DriverNumber,
		FirstName:     d.FirstName,
		FullName:      d.FullName,
		HeadshotURL:   d.HeadshotURL,
		LastName:      d.LastName,
		MeetingKey:    meetingKey,
		NameAcronym:   d.NameAcronym,
		SessionKey:    sessionKey,
		TeamColour:    teamColour,
		TeamName:      teamName,
	}
}

func resultToModel(r store.SessionResult) models.SessionResult {
	return models.SessionResult{
		DNF:          r.DNF,
		DNS:          r.DNS,
		DSQ:          r.DSQ,
		DriverNumber: r.DriverNumber,
		Duration:     parseJSONValue(r.DurationJSON),
		GapToLeader:  parseJSONValue(r.GapToLeaderJSON),
		NumberOfLaps: r.NumberOfLaps,
		MeetingKey:   r.MeetingKey,
		Points:       r.Points,
		Position:     r.Position,
		SessionKey:   r.SessionKey,
	}
}

func gridToModel(g store.StartingGridEntry) models.StartingGrid {
	return models.StartingGrid{
		DriverNumber: g.DriverNumber,
		LapDuration:  g.LapDuration,
		MeetingKey:   g.MeetingKey,
		Position:     g.Position,
		SessionKey:   g.SessionKey,
	}
}

func parseJSONValue(raw string) interface{} {
	if raw == "" {
		return nil
	}
	var v interface{}
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		return raw
	}
	return v
}
