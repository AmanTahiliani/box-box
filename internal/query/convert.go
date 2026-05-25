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
	broadcastName := sd.BroadcastName
	if broadcastName == "" {
		broadcastName = d.BroadcastName
	}
	firstName := sd.FirstName
	if firstName == "" {
		firstName = d.FirstName
	}
	fullName := sd.FullName
	if fullName == "" {
		fullName = d.FullName
	}
	lastName := sd.LastName
	if lastName == "" {
		lastName = d.LastName
	}
	nameAcronym := sd.NameAcronym
	if nameAcronym == "" {
		nameAcronym = d.NameAcronym
	}
	headshotURL := sd.HeadshotURL
	if headshotURL == "" {
		headshotURL = d.HeadshotURL
	}
	teamName := sd.TeamName
	if teamName == "" {
		teamName = d.TeamName
	}
	teamColour := sd.TeamColour
	if teamColour == "" {
		teamColour = d.TeamColour
	}
	return models.Driver{
		BroadcastName: broadcastName,
		DriverNumber:  sd.DriverNumber,
		FirstName:     firstName,
		FullName:      fullName,
		HeadshotURL:   headshotURL,
		LastName:      lastName,
		MeetingKey:    meetingKey,
		NameAcronym:   nameAcronym,
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

func stintToModel(st store.Stint) models.Stint {
	return models.Stint{
		SessionKey:     st.SessionKey,
		DriverNumber:   st.DriverNumber,
		MeetingKey:     st.MeetingKey,
		StintNumber:    st.StintNumber,
		Compound:       models.TyreCompound(st.Compound),
		LapStart:       st.LapStart,
		LapEnd:         st.LapEnd,
		TyreAgeAtStart: st.TyreAgeAtStart,
	}
}

func pitStopToModel(p store.PitStop) models.Pit {
	stopDuration := p.StopDuration
	if stopDuration == 0 {
		stopDuration = p.PitDuration
	}
	return models.Pit{
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

func positionToModel(p store.PositionSample) models.Position {
	return models.Position{
		SessionKey:   p.SessionKey,
		DriverNumber: p.DriverNumber,
		MeetingKey:   p.MeetingKey,
		Date:         p.Date,
		Position:     p.Position,
	}
}

func raceControlToModel(rc store.RaceControlMessage) models.RaceControl {
	return models.RaceControl{
		SessionKey:      rc.SessionKey,
		MeetingKey:      rc.MeetingKey,
		Date:            rc.Date,
		Category:        models.RaceControlCategory(rc.Category),
		Flag:            models.Flag(rc.Flag),
		Message:         rc.Message,
		Scope:           rc.Scope,
		DriverNumber:    rc.DriverNumber,
		LapNumber:       rc.LapNumber,
		Sector:          rc.Sector,
		QualifyingPhase: rc.QualifyingPhase,
	}
}

func weatherToModel(w store.WeatherSample) models.Weather {
	return models.Weather{
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

func lapToModel(l store.Lap) models.Lap {
	lap := models.Lap{
		SessionKey:   l.SessionKey,
		DriverNumber: l.DriverNumber,
		MeetingKey:   l.MeetingKey,
		LapNumber:    l.LapNumber,
		DateStart:    l.DateStart,
		IsPitOutLap:  l.IsPitOutLap,
	}
	if l.LapDuration != 0 {
		d := l.LapDuration
		lap.LapDuration = &d
	}
	if l.DurationSector1 != 0 {
		d := l.DurationSector1
		lap.DurationSector1 = &d
	}
	if l.DurationSector2 != 0 {
		d := l.DurationSector2
		lap.DurationSector2 = &d
	}
	if l.DurationSector3 != 0 {
		d := l.DurationSector3
		lap.DurationSector3 = &d
	}
	return lap
}
