package store

import (
	"database/sql"
	"fmt"
	"time"
)

// UpsertDriver inserts or updates a driver by driver_number.
func (s *Store) UpsertDriver(d Driver) error {
	if d.UpdatedAt.IsZero() {
		d.UpdatedAt = time.Now()
	}

	_, err := s.db.Exec(`
		INSERT INTO drivers (
			driver_number, broadcast_name, first_name, full_name, last_name,
			name_acronym, headshot_url, team_name, team_colour, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(driver_number) DO UPDATE SET
			broadcast_name = excluded.broadcast_name,
			first_name = excluded.first_name,
			full_name = excluded.full_name,
			last_name = excluded.last_name,
			name_acronym = excluded.name_acronym,
			headshot_url = excluded.headshot_url,
			team_name = excluded.team_name,
			team_colour = excluded.team_colour,
			updated_at = excluded.updated_at
	`,
		d.DriverNumber,
		nullString(d.BroadcastName),
		nullString(d.FirstName),
		d.FullName,
		nullString(d.LastName),
		nullString(d.NameAcronym),
		nullString(d.HeadshotURL),
		nullString(d.TeamName),
		nullString(d.TeamColour),
		d.UpdatedAt.Unix(),
	)
	if err != nil {
		return fmt.Errorf("upsert driver: %w", err)
	}
	return nil
}

// GetDriver returns a driver by number.
func (s *Store) GetDriver(driverNumber int) (Driver, error) {
	var d Driver
	var updatedAt int64
	var broadcastName, firstName, lastName, nameAcronym sql.NullString
	var headshotURL, teamName, teamColour sql.NullString

	err := s.db.QueryRow(`
		SELECT driver_number, broadcast_name, first_name, full_name, last_name,
		       name_acronym, headshot_url, team_name, team_colour, updated_at
		FROM drivers
		WHERE driver_number = ?
	`, driverNumber).Scan(
		&d.DriverNumber,
		&broadcastName,
		&firstName,
		&d.FullName,
		&lastName,
		&nameAcronym,
		&headshotURL,
		&teamName,
		&teamColour,
		&updatedAt,
	)
	if err != nil {
		return Driver{}, err
	}

	d.BroadcastName = broadcastName.String
	d.FirstName = firstName.String
	d.LastName = lastName.String
	d.NameAcronym = nameAcronym.String
	d.HeadshotURL = headshotURL.String
	d.TeamName = teamName.String
	d.TeamColour = teamColour.String
	d.UpdatedAt = time.Unix(updatedAt, 0)
	return d, nil
}

// UpsertSessionDriver links a driver to a session.
func (s *Store) UpsertSessionDriver(sd SessionDriver) error {
	_, err := s.db.Exec(`
		INSERT INTO session_drivers (
			session_key, driver_number, meeting_key, broadcast_name, first_name,
			full_name, last_name, name_acronym, headshot_url, team_name, team_colour
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_key, driver_number) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			broadcast_name = excluded.broadcast_name,
			first_name = excluded.first_name,
			full_name = excluded.full_name,
			last_name = excluded.last_name,
			name_acronym = excluded.name_acronym,
			headshot_url = excluded.headshot_url,
			team_name = excluded.team_name,
			team_colour = excluded.team_colour
	`,
		sd.SessionKey,
		sd.DriverNumber,
		sd.MeetingKey,
		nullString(sd.BroadcastName),
		nullString(sd.FirstName),
		nullString(sd.FullName),
		nullString(sd.LastName),
		nullString(sd.NameAcronym),
		nullString(sd.HeadshotURL),
		nullString(sd.TeamName),
		nullString(sd.TeamColour),
	)
	if err != nil {
		return fmt.Errorf("upsert session driver: %w", err)
	}
	return nil
}

// ListSessionDrivers returns drivers entered for a session ordered by number.
func (s *Store) ListSessionDrivers(sessionKey int) ([]SessionDriver, error) {
	rows, err := s.db.Query(`
		SELECT session_key, driver_number, meeting_key, broadcast_name, first_name,
		       full_name, last_name, name_acronym, headshot_url, team_name, team_colour
		FROM session_drivers
		WHERE session_key = ?
		ORDER BY driver_number ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SessionDriver
	for rows.Next() {
		var sd SessionDriver
		var broadcastName, firstName, fullName, lastName, nameAcronym, headshotURL sql.NullString
		var teamName, teamColour sql.NullString
		if err := rows.Scan(
			&sd.SessionKey,
			&sd.DriverNumber,
			&sd.MeetingKey,
			&broadcastName,
			&firstName,
			&fullName,
			&lastName,
			&nameAcronym,
			&headshotURL,
			&teamName,
			&teamColour,
		); err != nil {
			return nil, err
		}
		sd.BroadcastName = broadcastName.String
		sd.FirstName = firstName.String
		sd.FullName = fullName.String
		sd.LastName = lastName.String
		sd.NameAcronym = nameAcronym.String
		sd.HeadshotURL = headshotURL.String
		sd.TeamName = teamName.String
		sd.TeamColour = teamColour.String
		out = append(out, sd)
	}
	return out, rows.Err()
}

// UpsertSessionResult inserts or updates a session classification row.
func (s *Store) UpsertSessionResult(r SessionResult) error {
	_, err := s.db.Exec(`
		INSERT INTO session_results (
			session_key, driver_number, meeting_key, position, points,
			number_of_laps, duration_json, gap_to_leader_json, dnf, dns, dsq
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_key, driver_number) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			position = excluded.position,
			points = excluded.points,
			number_of_laps = excluded.number_of_laps,
			duration_json = excluded.duration_json,
			gap_to_leader_json = excluded.gap_to_leader_json,
			dnf = excluded.dnf,
			dns = excluded.dns,
			dsq = excluded.dsq
	`,
		r.SessionKey,
		r.DriverNumber,
		r.MeetingKey,
		r.Position,
		r.Points,
		nullableZeroInt(r.NumberOfLaps),
		nullString(r.DurationJSON),
		nullString(r.GapToLeaderJSON),
		boolInt(r.DNF),
		boolInt(r.DNS),
		boolInt(r.DSQ),
	)
	if err != nil {
		return fmt.Errorf("upsert session result: %w", err)
	}
	return nil
}

// ListSessionResults returns classification rows ordered by finishing position.
func (s *Store) ListSessionResults(sessionKey int) ([]SessionResult, error) {
	rows, err := s.db.Query(`
		SELECT session_key, driver_number, meeting_key, position, points,
		       number_of_laps, duration_json, gap_to_leader_json, dnf, dns, dsq
		FROM session_results
		WHERE session_key = ?
		ORDER BY CASE WHEN position > 0 THEN position ELSE 9999 END ASC, driver_number ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanSessionResults(rows)
}

// UpsertStartingGridEntry inserts or updates a starting grid row.
func (s *Store) UpsertStartingGridEntry(g StartingGridEntry) error {
	_, err := s.db.Exec(`
		INSERT INTO starting_grid (
			session_key, driver_number, meeting_key, position, lap_duration
		) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(session_key, driver_number) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			position = excluded.position,
			lap_duration = excluded.lap_duration
	`,
		g.SessionKey,
		g.DriverNumber,
		g.MeetingKey,
		g.Position,
		nullableZeroFloat(g.LapDuration),
	)
	if err != nil {
		return fmt.Errorf("upsert starting grid: %w", err)
	}
	return nil
}

// ListStartingGrid returns grid rows ordered by position.
func (s *Store) ListStartingGrid(sessionKey int) ([]StartingGridEntry, error) {
	rows, err := s.db.Query(`
		SELECT session_key, driver_number, meeting_key, position, lap_duration
		FROM starting_grid
		WHERE session_key = ?
		ORDER BY position ASC, driver_number ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []StartingGridEntry
	for rows.Next() {
		var g StartingGridEntry
		var lapDuration sql.NullFloat64
		if err := rows.Scan(
			&g.SessionKey,
			&g.DriverNumber,
			&g.MeetingKey,
			&g.Position,
			&lapDuration,
		); err != nil {
			return nil, err
		}
		if lapDuration.Valid {
			g.LapDuration = lapDuration.Float64
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func scanSessionResults(rows *sql.Rows) ([]SessionResult, error) {
	var out []SessionResult
	for rows.Next() {
		var r SessionResult
		var numberOfLaps sql.NullInt64
		var durationJSON, gapJSON sql.NullString
		var dnf, dns, dsq int

		if err := rows.Scan(
			&r.SessionKey,
			&r.DriverNumber,
			&r.MeetingKey,
			&r.Position,
			&r.Points,
			&numberOfLaps,
			&durationJSON,
			&gapJSON,
			&dnf,
			&dns,
			&dsq,
		); err != nil {
			return nil, err
		}

		if numberOfLaps.Valid {
			r.NumberOfLaps = int(numberOfLaps.Int64)
		}
		r.DurationJSON = durationJSON.String
		r.GapToLeaderJSON = gapJSON.String
		r.DNF = dnf != 0
		r.DNS = dns != 0
		r.DSQ = dsq != 0
		out = append(out, r)
	}
	return out, rows.Err()
}

func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func nullableZeroFloat(v float64) any {
	if v == 0 {
		return nil
	}
	return v
}
