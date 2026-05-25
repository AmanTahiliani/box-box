package store

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"
)

// InsertRawPayload stores a raw payload if the source/request/hash tuple is new.
// Returns the row ID and true when inserted, or the existing ID and false on duplicate.
func (s *Store) InsertRawPayload(p RawPayload) (int64, bool, error) {
	if p.PayloadHash == "" {
		p.PayloadHash = hashPayload(p.Payload)
	}
	if p.FetchedAt.IsZero() {
		p.FetchedAt = time.Now()
	}

	result, err := s.db.Exec(`
		INSERT INTO raw_payloads (
			source, endpoint, request_key, meeting_key, session_key,
			payload, payload_hash, fetched_at, provenance_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(source, request_key, payload_hash) DO NOTHING
	`,
		p.Source,
		p.Endpoint,
		p.RequestKey,
		nullableInt(p.MeetingKey),
		nullableInt(p.SessionKey),
		p.Payload,
		p.PayloadHash,
		p.FetchedAt.Unix(),
		nullString(p.ProvenanceJSON),
	)
	if err != nil {
		return 0, false, fmt.Errorf("insert raw payload: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return 0, false, err
	}
	if rows == 0 {
		id, err := s.findRawPayloadID(p.Source, p.RequestKey, p.PayloadHash)
		return id, false, err
	}

	id, err := result.LastInsertId()
	return id, true, err
}

// GetRawPayload returns a raw payload by ID.
func (s *Store) GetRawPayload(id int64) (RawPayload, error) {
	var p RawPayload
	var fetchedAt int64
	var meetingKey, sessionKey sql.NullInt64
	var provenance sql.NullString

	err := s.db.QueryRow(`
		SELECT id, source, endpoint, request_key, meeting_key, session_key,
		       payload, payload_hash, fetched_at, provenance_json
		FROM raw_payloads
		WHERE id = ?
	`, id).Scan(
		&p.ID,
		&p.Source,
		&p.Endpoint,
		&p.RequestKey,
		&meetingKey,
		&sessionKey,
		&p.Payload,
		&p.PayloadHash,
		&fetchedAt,
		&provenance,
	)
	if err != nil {
		return RawPayload{}, err
	}

	p.FetchedAt = time.Unix(fetchedAt, 0)
	p.MeetingKey = nullIntPtr(meetingKey)
	p.SessionKey = nullIntPtr(sessionKey)
	if provenance.Valid {
		p.ProvenanceJSON = provenance.String
	}
	return p, nil
}

// ListRawPayloadsBySession returns raw payloads for a session ordered by fetch time.
func (s *Store) ListRawPayloadsBySession(sessionKey int) ([]RawPayload, error) {
	rows, err := s.db.Query(`
		SELECT id, source, endpoint, request_key, meeting_key, session_key,
		       payload, payload_hash, fetched_at, provenance_json
		FROM raw_payloads
		WHERE session_key = ?
		ORDER BY fetched_at ASC, id ASC
	`, sessionKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanRawPayloads(rows)
}

func (s *Store) findRawPayloadID(source, requestKey, payloadHash string) (int64, error) {
	var id int64
	err := s.db.QueryRow(`
		SELECT id FROM raw_payloads
		WHERE source = ? AND request_key = ? AND payload_hash = ?
	`, source, requestKey, payloadHash).Scan(&id)
	return id, err
}

func scanRawPayloads(rows *sql.Rows) ([]RawPayload, error) {
	var out []RawPayload
	for rows.Next() {
		var p RawPayload
		var fetchedAt int64
		var meetingKey, sessionKey sql.NullInt64
		var provenance sql.NullString

		if err := rows.Scan(
			&p.ID,
			&p.Source,
			&p.Endpoint,
			&p.RequestKey,
			&meetingKey,
			&sessionKey,
			&p.Payload,
			&p.PayloadHash,
			&fetchedAt,
			&provenance,
		); err != nil {
			return nil, err
		}

		p.FetchedAt = time.Unix(fetchedAt, 0)
		p.MeetingKey = nullIntPtr(meetingKey)
		p.SessionKey = nullIntPtr(sessionKey)
		if provenance.Valid {
			p.ProvenanceJSON = provenance.String
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func hashPayload(payload string) string {
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func nullableInt(v *int) any {
	if v == nil {
		return nil
	}
	return *v
}

func nullIntPtr(v sql.NullInt64) *int {
	if !v.Valid {
		return nil
	}
	n := int(v.Int64)
	return &n
}

func nullString(v string) any {
	if v == "" {
		return nil
	}
	return v
}
