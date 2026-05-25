package store

import (
	"database/sql"
	"fmt"
)

// UpsertStint inserts or updates a stint row.
func (s *Store) UpsertStint(st Stint) error {
	_, err := s.db.Exec(`
		INSERT INTO stints (
			session_key, driver_number, meeting_key, stint_number,
			compound, lap_start, lap_end, tyre_age_at_start
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_key, driver_number, stint_number) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			compound = excluded.compound,
			lap_start = excluded.lap_start,
			lap_end = excluded.lap_end,
			tyre_age_at_start = excluded.tyre_age_at_start
	`,
		st.SessionKey,
		st.DriverNumber,
		st.MeetingKey,
		st.StintNumber,
		st.Compound,
		st.LapStart,
		st.LapEnd,
		st.TyreAgeAtStart,
	)
	if err != nil {
		return fmt.Errorf("upsert stint: %w", err)
	}
	return nil
}

// ListStints returns stints for a session ordered by driver and stint number.
func (s *Store) ListStints(sessionKey int) ([]Stint, error) {
	rows, err := s.db.Query(`
		SELECT session_key, driver_number, meeting_key, stint_number,
		       compound, lap_start, lap_end, tyre_age_at_start
		FROM stints
		WHERE session_key = ?
		ORDER BY driver_number ASC, stint_number ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Stint
	for rows.Next() {
		var st Stint
		if err := rows.Scan(
			&st.SessionKey,
			&st.DriverNumber,
			&st.MeetingKey,
			&st.StintNumber,
			&st.Compound,
			&st.LapStart,
			&st.LapEnd,
			&st.TyreAgeAtStart,
		); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}

// UpsertPitStop inserts or updates a pit stop row.
func (s *Store) UpsertPitStop(p PitStop) error {
	_, err := s.db.Exec(`
		INSERT INTO pit_stops (
			session_key, driver_number, meeting_key, lap_number, date,
			pit_duration, lane_duration, stop_duration
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_key, driver_number, date) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			lap_number = excluded.lap_number,
			pit_duration = excluded.pit_duration,
			lane_duration = excluded.lane_duration,
			stop_duration = excluded.stop_duration
	`,
		p.SessionKey,
		p.DriverNumber,
		p.MeetingKey,
		p.LapNumber,
		p.Date,
		nullableZeroFloat(p.PitDuration),
		nullableZeroFloat(p.LaneDuration),
		nullableZeroFloat(p.StopDuration),
	)
	if err != nil {
		return fmt.Errorf("upsert pit stop: %w", err)
	}
	return nil
}

// ListPitStops returns pit stops for a session ordered by date.
func (s *Store) ListPitStops(sessionKey int) ([]PitStop, error) {
	rows, err := s.db.Query(`
		SELECT session_key, driver_number, meeting_key, lap_number, date,
		       pit_duration, lane_duration, stop_duration
		FROM pit_stops
		WHERE session_key = ?
		ORDER BY date ASC, driver_number ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []PitStop
	for rows.Next() {
		var p PitStop
		var pitDuration, laneDuration, stopDuration sql.NullFloat64
		if err := rows.Scan(
			&p.SessionKey,
			&p.DriverNumber,
			&p.MeetingKey,
			&p.LapNumber,
			&p.Date,
			&pitDuration,
			&laneDuration,
			&stopDuration,
		); err != nil {
			return nil, err
		}
		if pitDuration.Valid {
			p.PitDuration = pitDuration.Float64
		}
		if laneDuration.Valid {
			p.LaneDuration = laneDuration.Float64
		}
		if stopDuration.Valid {
			p.StopDuration = stopDuration.Float64
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// UpsertPositionSample inserts or updates a position sample row.
func (s *Store) UpsertPositionSample(p PositionSample) error {
	_, err := s.db.Exec(`
		INSERT INTO positions (
			session_key, driver_number, meeting_key, date, position
		) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(session_key, driver_number, date) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			position = excluded.position
	`,
		p.SessionKey,
		p.DriverNumber,
		p.MeetingKey,
		p.Date,
		p.Position,
	)
	if err != nil {
		return fmt.Errorf("upsert position: %w", err)
	}
	return nil
}

// ListPositionSamples returns position samples for a session ordered by date.
func (s *Store) ListPositionSamples(sessionKey int) ([]PositionSample, error) {
	rows, err := s.db.Query(`
		SELECT session_key, driver_number, meeting_key, date, position
		FROM positions
		WHERE session_key = ?
		ORDER BY date ASC, driver_number ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []PositionSample
	for rows.Next() {
		var p PositionSample
		if err := rows.Scan(
			&p.SessionKey,
			&p.DriverNumber,
			&p.MeetingKey,
			&p.Date,
			&p.Position,
		); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// UpsertRaceControlMessage inserts or updates a race control message row.
func (s *Store) UpsertRaceControlMessage(rc RaceControlMessage) error {
	_, err := s.db.Exec(`
		INSERT INTO race_control (
			session_key, meeting_key, date, category, flag, message, scope,
			driver_number, lap_number, sector, qualifying_phase
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_key, date, message) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			category = excluded.category,
			flag = excluded.flag,
			scope = excluded.scope,
			driver_number = excluded.driver_number,
			lap_number = excluded.lap_number,
			sector = excluded.sector,
			qualifying_phase = excluded.qualifying_phase
	`,
		rc.SessionKey,
		rc.MeetingKey,
		rc.Date,
		rc.Category,
		nullString(rc.Flag),
		rc.Message,
		nullString(rc.Scope),
		nullableInt(rc.DriverNumber),
		nullableInt(rc.LapNumber),
		nullableInt(rc.Sector),
		nullableInt(rc.QualifyingPhase),
	)
	if err != nil {
		return fmt.Errorf("upsert race control: %w", err)
	}
	return nil
}

// ListRaceControlMessages returns race control messages for a session.
func (s *Store) ListRaceControlMessages(sessionKey int) ([]RaceControlMessage, error) {
	rows, err := s.db.Query(`
		SELECT session_key, meeting_key, date, category, flag, message, scope,
		       driver_number, lap_number, sector, qualifying_phase
		FROM race_control
		WHERE session_key = ?
		ORDER BY date ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []RaceControlMessage
	for rows.Next() {
		var rc RaceControlMessage
		var flag, scope sql.NullString
		var driverNumber, lapNumber, sector, qualifyingPhase sql.NullInt64
		if err := rows.Scan(
			&rc.SessionKey,
			&rc.MeetingKey,
			&rc.Date,
			&rc.Category,
			&flag,
			&rc.Message,
			&scope,
			&driverNumber,
			&lapNumber,
			&sector,
			&qualifyingPhase,
		); err != nil {
			return nil, err
		}
		rc.Flag = flag.String
		rc.Scope = scope.String
		rc.DriverNumber = nullIntPtr(driverNumber)
		rc.LapNumber = nullIntPtr(lapNumber)
		rc.Sector = nullIntPtr(sector)
		rc.QualifyingPhase = nullIntPtr(qualifyingPhase)
		out = append(out, rc)
	}
	return out, rows.Err()
}

// UpsertWeatherSample inserts or updates a weather sample row.
func (s *Store) UpsertWeatherSample(w WeatherSample) error {
	_, err := s.db.Exec(`
		INSERT INTO weather (
			session_key, meeting_key, date, air_temperature, track_temperature,
			humidity, pressure, rainfall, wind_direction, wind_speed
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_key, date) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			air_temperature = excluded.air_temperature,
			track_temperature = excluded.track_temperature,
			humidity = excluded.humidity,
			pressure = excluded.pressure,
			rainfall = excluded.rainfall,
			wind_direction = excluded.wind_direction,
			wind_speed = excluded.wind_speed
	`,
		w.SessionKey,
		w.MeetingKey,
		w.Date,
		nullableZeroFloat(w.AirTemperature),
		nullableZeroFloat(w.TrackTemperature),
		nullableZeroFloat(w.Humidity),
		nullableZeroFloat(w.Pressure),
		w.Rainfall,
		nullableZeroInt(w.WindDirection),
		nullableZeroFloat(w.WindSpeed),
	)
	if err != nil {
		return fmt.Errorf("upsert weather: %w", err)
	}
	return nil
}

// ListWeatherSamples returns weather samples for a session ordered by date.
func (s *Store) ListWeatherSamples(sessionKey int) ([]WeatherSample, error) {
	rows, err := s.db.Query(`
		SELECT session_key, meeting_key, date, air_temperature, track_temperature,
		       humidity, pressure, rainfall, wind_direction, wind_speed
		FROM weather
		WHERE session_key = ?
		ORDER BY date ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []WeatherSample
	for rows.Next() {
		var w WeatherSample
		var airTemp, trackTemp, humidity, pressure, windSpeed sql.NullFloat64
		var windDirection sql.NullInt64
		if err := rows.Scan(
			&w.SessionKey,
			&w.MeetingKey,
			&w.Date,
			&airTemp,
			&trackTemp,
			&humidity,
			&pressure,
			&w.Rainfall,
			&windDirection,
			&windSpeed,
		); err != nil {
			return nil, err
		}
		if airTemp.Valid {
			w.AirTemperature = airTemp.Float64
		}
		if trackTemp.Valid {
			w.TrackTemperature = trackTemp.Float64
		}
		if humidity.Valid {
			w.Humidity = humidity.Float64
		}
		if pressure.Valid {
			w.Pressure = pressure.Float64
		}
		if windDirection.Valid {
			w.WindDirection = int(windDirection.Int64)
		}
		if windSpeed.Valid {
			w.WindSpeed = windSpeed.Float64
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

// UpsertLap inserts or updates a lap row.
func (s *Store) UpsertLap(l Lap) error {
	_, err := s.db.Exec(`
		INSERT INTO laps (
			session_key, driver_number, meeting_key, lap_number, date_start,
			lap_duration, is_pit_out_lap, duration_sector1, duration_sector2, duration_sector3
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_key, driver_number, lap_number) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			date_start = excluded.date_start,
			lap_duration = excluded.lap_duration,
			is_pit_out_lap = excluded.is_pit_out_lap,
			duration_sector1 = excluded.duration_sector1,
			duration_sector2 = excluded.duration_sector2,
			duration_sector3 = excluded.duration_sector3
	`,
		l.SessionKey,
		l.DriverNumber,
		l.MeetingKey,
		l.LapNumber,
		nullString(l.DateStart),
		nullableZeroFloat(l.LapDuration),
		boolInt(l.IsPitOutLap),
		nullableZeroFloat(l.DurationSector1),
		nullableZeroFloat(l.DurationSector2),
		nullableZeroFloat(l.DurationSector3),
	)
	if err != nil {
		return fmt.Errorf("upsert lap: %w", err)
	}
	return nil
}

// ListLaps returns laps for a session ordered by driver and lap number.
func (s *Store) ListLaps(sessionKey int) ([]Lap, error) {
	rows, err := s.db.Query(`
		SELECT session_key, driver_number, meeting_key, lap_number, date_start,
		       lap_duration, is_pit_out_lap, duration_sector1, duration_sector2, duration_sector3
		FROM laps
		WHERE session_key = ?
		ORDER BY driver_number ASC, lap_number ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Lap
	for rows.Next() {
		var l Lap
		var dateStart sql.NullString
		var lapDuration, s1, s2, s3 sql.NullFloat64
		var isPitOut int
		if err := rows.Scan(
			&l.SessionKey,
			&l.DriverNumber,
			&l.MeetingKey,
			&l.LapNumber,
			&dateStart,
			&lapDuration,
			&isPitOut,
			&s1,
			&s2,
			&s3,
		); err != nil {
			return nil, err
		}
		l.DateStart = dateStart.String
		if lapDuration.Valid {
			l.LapDuration = lapDuration.Float64
		}
		l.IsPitOutLap = isPitOut != 0
		if s1.Valid {
			l.DurationSector1 = s1.Float64
		}
		if s2.Valid {
			l.DurationSector2 = s2.Float64
		}
		if s3.Valid {
			l.DurationSector3 = s3.Float64
		}
		out = append(out, l)
	}
	return out, rows.Err()
}
