package store

import (
	"database/sql"
	"fmt"
	"time"
)

// UpsertMeeting inserts or updates a meeting by meeting_key.
func (s *Store) UpsertMeeting(m Meeting) error {
	if m.UpdatedAt.IsZero() {
		m.UpdatedAt = time.Now()
	}

	_, err := s.db.Exec(`
		INSERT INTO meetings (
			meeting_key, meeting_name, meeting_official_name, location,
			country_code, country_name, circuit_key, circuit_short_name,
			gmt_offset, date_start, date_end, year, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(meeting_key) DO UPDATE SET
			meeting_name = excluded.meeting_name,
			meeting_official_name = excluded.meeting_official_name,
			location = excluded.location,
			country_code = excluded.country_code,
			country_name = excluded.country_name,
			circuit_key = excluded.circuit_key,
			circuit_short_name = excluded.circuit_short_name,
			gmt_offset = excluded.gmt_offset,
			date_start = excluded.date_start,
			date_end = excluded.date_end,
			year = excluded.year,
			updated_at = excluded.updated_at
	`,
		m.MeetingKey,
		m.MeetingName,
		nullString(m.MeetingOfficialName),
		nullString(m.Location),
		nullString(m.CountryCode),
		nullString(m.CountryName),
		nullableZeroInt(m.CircuitKey),
		nullString(m.CircuitShortName),
		nullString(m.GMTOffset),
		nullString(m.DateStart),
		nullString(m.DateEnd),
		m.Year,
		m.UpdatedAt.Unix(),
	)
	if err != nil {
		return fmt.Errorf("upsert meeting: %w", err)
	}
	return nil
}

// GetMeeting returns a meeting by key.
func (s *Store) GetMeeting(meetingKey int) (Meeting, error) {
	var m Meeting
	var updatedAt int64
	var officialName, location, countryCode, countryName sql.NullString
	var circuitKey sql.NullInt64
	var circuitShortName, gmtOffset, dateStart, dateEnd sql.NullString

	err := s.db.QueryRow(`
		SELECT meeting_key, meeting_name, meeting_official_name, location,
		       country_code, country_name, circuit_key, circuit_short_name,
		       gmt_offset, date_start, date_end, year, updated_at
		FROM meetings
		WHERE meeting_key = ?
	`, meetingKey).Scan(
		&m.MeetingKey,
		&m.MeetingName,
		&officialName,
		&location,
		&countryCode,
		&countryName,
		&circuitKey,
		&circuitShortName,
		&gmtOffset,
		&dateStart,
		&dateEnd,
		&m.Year,
		&updatedAt,
	)
	if err != nil {
		return Meeting{}, err
	}

	m.MeetingOfficialName = officialName.String
	m.Location = location.String
	m.CountryCode = countryCode.String
	m.CountryName = countryName.String
	if circuitKey.Valid {
		m.CircuitKey = int(circuitKey.Int64)
	}
	m.CircuitShortName = circuitShortName.String
	m.GMTOffset = gmtOffset.String
	m.DateStart = dateStart.String
	m.DateEnd = dateEnd.String
	m.UpdatedAt = time.Unix(updatedAt, 0)
	return m, nil
}

// ListYears returns distinct meeting years ordered newest first.
func (s *Store) ListYears() ([]int, error) {
	rows, err := s.db.Query(`
		SELECT DISTINCT year
		FROM meetings
		WHERE year > 0
		ORDER BY year DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var years []int
	for rows.Next() {
		var year int
		if err := rows.Scan(&year); err != nil {
			return nil, err
		}
		years = append(years, year)
	}
	return years, rows.Err()
}

// ListMeetingsByYear returns meetings for a season ordered by start date.
func (s *Store) ListMeetingsByYear(year int) ([]Meeting, error) {
	rows, err := s.db.Query(`
		SELECT meeting_key, meeting_name, meeting_official_name, location,
		       country_code, country_name, circuit_key, circuit_short_name,
		       gmt_offset, date_start, date_end, year, updated_at
		FROM meetings
		WHERE year = ?
		ORDER BY date_start ASC, meeting_key ASC
	`, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMeetings(rows)
}

// UpsertSession inserts or updates a session by session_key.
func (s *Store) UpsertSession(sess Session) error {
	if sess.UpdatedAt.IsZero() {
		sess.UpdatedAt = time.Now()
	}

	_, err := s.db.Exec(`
		INSERT INTO sessions (
			session_key, meeting_key, session_name, session_type,
			circuit_key, date_start, date_end, gmt_offset, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_key) DO UPDATE SET
			meeting_key = excluded.meeting_key,
			session_name = excluded.session_name,
			session_type = excluded.session_type,
			circuit_key = excluded.circuit_key,
			date_start = excluded.date_start,
			date_end = excluded.date_end,
			gmt_offset = excluded.gmt_offset,
			updated_at = excluded.updated_at
	`,
		sess.SessionKey,
		sess.MeetingKey,
		sess.SessionName,
		sess.SessionType,
		nullableZeroInt(sess.CircuitKey),
		nullString(sess.DateStart),
		nullString(sess.DateEnd),
		nullString(sess.GMTOffset),
		sess.UpdatedAt.Unix(),
	)
	if err != nil {
		return fmt.Errorf("upsert session: %w", err)
	}
	return nil
}

// GetSession returns a session by key.
func (s *Store) GetSession(sessionKey int) (Session, error) {
	var sess Session
	var updatedAt int64
	var circuitKey sql.NullInt64
	var dateStart, dateEnd, gmtOffset sql.NullString

	err := s.db.QueryRow(`
		SELECT session_key, meeting_key, session_name, session_type,
		       circuit_key, date_start, date_end, gmt_offset, updated_at
		FROM sessions
		WHERE session_key = ?
	`, sessionKey).Scan(
		&sess.SessionKey,
		&sess.MeetingKey,
		&sess.SessionName,
		&sess.SessionType,
		&circuitKey,
		&dateStart,
		&dateEnd,
		&gmtOffset,
		&updatedAt,
	)
	if err != nil {
		return Session{}, err
	}

	if circuitKey.Valid {
		sess.CircuitKey = int(circuitKey.Int64)
	}
	sess.DateStart = dateStart.String
	sess.DateEnd = dateEnd.String
	sess.GMTOffset = gmtOffset.String
	sess.UpdatedAt = time.Unix(updatedAt, 0)
	return sess, nil
}

// ListSessionsByMeeting returns sessions for a meeting ordered by start time.
func (s *Store) ListSessionsByMeeting(meetingKey int) ([]Session, error) {
	rows, err := s.db.Query(`
		SELECT session_key, meeting_key, session_name, session_type,
		       circuit_key, date_start, date_end, gmt_offset, updated_at
		FROM sessions
		WHERE meeting_key = ?
		ORDER BY date_start ASC, session_key ASC
	`, meetingKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanSessions(rows)
}

func scanMeetings(rows *sql.Rows) ([]Meeting, error) {
	var out []Meeting
	for rows.Next() {
		var m Meeting
		var updatedAt int64
		var officialName, location, countryCode, countryName sql.NullString
		var circuitKey sql.NullInt64
		var circuitShortName, gmtOffset, dateStart, dateEnd sql.NullString

		if err := rows.Scan(
			&m.MeetingKey,
			&m.MeetingName,
			&officialName,
			&location,
			&countryCode,
			&countryName,
			&circuitKey,
			&circuitShortName,
			&gmtOffset,
			&dateStart,
			&dateEnd,
			&m.Year,
			&updatedAt,
		); err != nil {
			return nil, err
		}

		m.MeetingOfficialName = officialName.String
		m.Location = location.String
		m.CountryCode = countryCode.String
		m.CountryName = countryName.String
		if circuitKey.Valid {
			m.CircuitKey = int(circuitKey.Int64)
		}
		m.CircuitShortName = circuitShortName.String
		m.GMTOffset = gmtOffset.String
		m.DateStart = dateStart.String
		m.DateEnd = dateEnd.String
		m.UpdatedAt = time.Unix(updatedAt, 0)
		out = append(out, m)
	}
	return out, rows.Err()
}

func scanSessions(rows *sql.Rows) ([]Session, error) {
	var out []Session
	for rows.Next() {
		var sess Session
		var updatedAt int64
		var circuitKey sql.NullInt64
		var dateStart, dateEnd, gmtOffset sql.NullString

		if err := rows.Scan(
			&sess.SessionKey,
			&sess.MeetingKey,
			&sess.SessionName,
			&sess.SessionType,
			&circuitKey,
			&dateStart,
			&dateEnd,
			&gmtOffset,
			&updatedAt,
		); err != nil {
			return nil, err
		}

		if circuitKey.Valid {
			sess.CircuitKey = int(circuitKey.Int64)
		}
		sess.DateStart = dateStart.String
		sess.DateEnd = dateEnd.String
		sess.GMTOffset = gmtOffset.String
		sess.UpdatedAt = time.Unix(updatedAt, 0)
		out = append(out, sess)
	}
	return out, rows.Err()
}

func nullableZeroInt(v int) any {
	if v == 0 {
		return nil
	}
	return v
}
