package store

import (
	"database/sql"
	"fmt"
)

// CoverageEntry represents the coverage status for a single dataset of a session.
type CoverageEntry struct {
	Status    string
	ErrorMsg  string
	RowCount  int
	UpdatedAt string
}

// SessionCoverageRow represents a joined session coverage record for reporting.
type SessionCoverageRow struct {
	MeetingKey  int
	MeetingName string
	SessionKey  int
	SessionName string
	Dataset     string
	Status      string
	ErrorMsg    string
	RowCount    int
	UpdatedAt   string
}

// UpsertCoverage inserts or updates a session coverage record.
func (s *Store) UpsertCoverage(sessionKey int, dataset string, status string, rowCount int, errMsg string) error {
	_, err := s.db.Exec(`
		INSERT INTO session_coverage (session_key, dataset, status, row_count, error_msg, updated_at)
		VALUES (?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(session_key, dataset) DO UPDATE SET
			status = excluded.status,
			row_count = excluded.row_count,
			error_msg = excluded.error_msg,
			updated_at = excluded.updated_at
	`, sessionKey, dataset, status, rowCount, nullString(errMsg))
	if err != nil {
		return fmt.Errorf("upsert coverage: %w", err)
	}
	return nil
}

// GetSessionCoverage fetches the coverage statuses for all datasets of a given session.
func (s *Store) GetSessionCoverage(sessionKey int) (map[string]CoverageEntry, error) {
	rows, err := s.db.Query(`
		SELECT dataset, status, row_count, error_msg, updated_at
		FROM session_coverage
		WHERE session_key = ?
	`, sessionKey)
	if err != nil {
		return nil, fmt.Errorf("get session coverage: %w", err)
	}
	defer rows.Close()

	coverage := make(map[string]CoverageEntry)
	for rows.Next() {
		var dataset string
		var entry CoverageEntry
		var errMsg sql.NullString
		if err := rows.Scan(&dataset, &entry.Status, &entry.RowCount, &errMsg, &entry.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan session coverage: %w", err)
		}
		entry.ErrorMsg = errMsg.String
		coverage[dataset] = entry
	}
	return coverage, rows.Err()
}

// GetSeasonCoverage returns coverage records for all sessions of a given year.
func (s *Store) GetSeasonCoverage(year int) ([]SessionCoverageRow, error) {
	rows, err := s.db.Query(`
		SELECT
			m.meeting_key,
			m.meeting_name,
			s.session_key,
			s.session_name,
			COALESCE(c.dataset, '') as dataset,
			COALESCE(c.status, 'pending') as status,
			COALESCE(c.error_msg, '') as error_msg,
			COALESCE(c.row_count, 0) as row_count,
			COALESCE(c.updated_at, '') as updated_at
		FROM sessions s
		JOIN meetings m ON s.meeting_key = m.meeting_key
		LEFT JOIN session_coverage c ON s.session_key = c.session_key
		WHERE m.year = ?
		ORDER BY m.date_start ASC, m.meeting_key ASC, s.date_start ASC, s.session_key ASC
	`, year)
	if err != nil {
		return nil, fmt.Errorf("get season coverage query: %w", err)
	}
	defer rows.Close()

	var coverageRows []SessionCoverageRow
	for rows.Next() {
		var r SessionCoverageRow
		var errMsg sql.NullString
		if err := rows.Scan(
			&r.MeetingKey,
			&r.MeetingName,
			&r.SessionKey,
			&r.SessionName,
			&r.Dataset,
			&r.Status,
			&r.ErrorMsg,
			&r.RowCount,
			&r.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan season coverage row: %w", err)
		}
		r.ErrorMsg = errMsg.String
		coverageRows = append(coverageRows, r)
	}
	return coverageRows, rows.Err()
}
