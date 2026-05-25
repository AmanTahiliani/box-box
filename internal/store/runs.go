package store

import (
	"fmt"
	"time"
)

// CreateIngestionRun records the start of an ingestion attempt.
func (s *Store) CreateIngestionRun(scopeType, scopeKey string, refresh bool) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO ingestion_runs (scope_type, scope_key, started_at, status, refresh)
		VALUES (?, ?, ?, 'running', ?)
	`, scopeType, scopeKey, time.Now().Unix(), boolInt(refresh))
	if err != nil {
		return 0, fmt.Errorf("create ingestion run: %w", err)
	}
	return result.LastInsertId()
}

// FinishIngestionRun marks an ingestion run complete with status and summary JSON.
func (s *Store) FinishIngestionRun(id int64, status, summaryJSON string) error {
	_, err := s.db.Exec(`
		UPDATE ingestion_runs
		SET finished_at = ?, status = ?, summary_json = ?
		WHERE id = ?
	`, time.Now().Unix(), status, nullString(summaryJSON), id)
	if err != nil {
		return fmt.Errorf("finish ingestion run: %w", err)
	}
	return nil
}
