package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Store owns the local domain SQLite database.
type Store struct {
	db *sql.DB
}

// Open opens or creates a domain database at path and applies pending migrations.
func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}

	dsn := path + "?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=ON"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	db.SetMaxOpenConns(1)

	s := &Store{db: db}
	if err := s.applyMigrations(); err != nil {
		_ = db.Close()
		return nil, err
	}

	return s, nil
}

// OpenDefault opens the default user domain database path.
func OpenDefault() (*Store, error) {
	return Open(DefaultDBPath())
}

// DefaultDBPath returns the default domain database file path.
func DefaultDBPath() string {
	home, err := os.UserHomeDir()
	if err == nil {
		return filepath.Join(home, ".local", "share", "box-box", "boxbox.db")
	}
	return filepath.Join(".local", "share", "box-box", "boxbox.db")
}

// DB exposes the underlying connection for advanced callers and tests.
func (s *Store) DB() *sql.DB {
	return s.db
}

// Close closes the database connection.
func (s *Store) Close() error {
	if s.db == nil {
		return nil
	}
	return s.db.Close()
}

// WithTx runs fn inside a transaction, rolling back on error.
func (s *Store) WithTx(fn func(tx *sql.Tx) error) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}

	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// SchemaVersion returns the highest applied migration version.
func (s *Store) SchemaVersion() (int, error) {
	var version sql.NullInt64
	err := s.db.QueryRow(`SELECT MAX(version) FROM schema_migrations`).Scan(&version)
	if err != nil {
		return 0, err
	}
	if !version.Valid {
		return 0, nil
	}
	return int(version.Int64), nil
}
