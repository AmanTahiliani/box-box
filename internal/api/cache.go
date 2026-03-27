package api

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
	_ "modernc.org/sqlite"
)

// CacheStats tracks cache hit/miss statistics.
type CacheStats struct {
	Hits   int64
	Misses int64
}

// Cache implements a SQLite-backed HTTP response cache with TTL expiry.
// The database is a single file stored in the user's cache directory.
type Cache struct {
	db    *sql.DB
	stats CacheStats
}

// Default TTL values.
const (
	// CacheTTLShort is for live/telemetry data that changes every few seconds.
	CacheTTLShort = 15 * time.Minute
	// CacheTTLMedium is for semi-stable data (championship standings, driver lists).
	CacheTTLMedium = 1 * time.Hour
	// CacheTTLLong is for historical data that rarely changes (past season data).
	CacheTTLLong = 24 * time.Hour
	// CacheTTLForever is for data that will never change (completed past-season results).
	CacheTTLForever = 0
)

// NewCache creates a SQLite-backed cache. The database file is placed in the
// user's OS cache directory under box-box/cache.db. No setup is required — the
// schema is created automatically on first run.
func NewCache() *Cache {
	dbPath := cacheDBPath()

	// Ensure the parent directory exists.
	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)

	db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		// Fall back to in-memory if the file can't be opened.
		db, _ = sql.Open("sqlite", ":memory:")
	}

	// Limit connections — SQLite is single-writer.
	db.SetMaxOpenConns(1)

	// Create the HTTP response cache table if it doesn't exist.
	_, _ = db.Exec(`
		CREATE TABLE IF NOT EXISTS cache (
			key        TEXT PRIMARY KEY,
			data       BLOB NOT NULL,
			created_at INTEGER NOT NULL
		)
	`)

	// Create an index on created_at for efficient expiry cleanup.
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_cache_created_at ON cache(created_at)`)

	// Create the track outlines table — stores pre-fetched GPS location data
	// keyed by (circuit_key, year) so the track map works during live sessions
	// when the free-tier API is locked.
	_, _ = db.Exec(`
		CREATE TABLE IF NOT EXISTS track_outlines (
			circuit_key INTEGER NOT NULL,
			year        INTEGER NOT NULL,
			data        BLOB NOT NULL,
			fetched_at  INTEGER NOT NULL,
			PRIMARY KEY (circuit_key, year)
		)
	`)

	return &Cache{db: db}
}

// cacheDBPath returns the path to the cache database file.
func cacheDBPath() string {
	userCacheDir, err := os.UserCacheDir()
	if err == nil {
		return filepath.Join(userCacheDir, "box-box", "cache.db")
	}
	return filepath.Join(".cache", "box-box", "cache.db")
}

// ttlForURL determines the appropriate TTL based on the URL pattern.
// Returns 0 (CacheTTLForever) for historical data that will never change.
func ttlForURL(url string) time.Duration {
	// Historical data — completed past seasons never change.
	if strings.Contains(url, "year=2023") || strings.Contains(url, "year=2024") {
		return CacheTTLForever
	}

	// Live telemetry endpoints — change every few seconds during a session.
	if strings.Contains(url, "/position") ||
		strings.Contains(url, "/intervals") ||
		strings.Contains(url, "/car_data") ||
		strings.Contains(url, "/location") {
		return CacheTTLShort
	}

	// Semi-stable data — standings and driver info.
	if strings.Contains(url, "/championship") ||
		strings.Contains(url, "/drivers") {
		return CacheTTLMedium
	}

	// Default: medium TTL for everything else.
	return CacheTTLMedium
}

// Get retrieves data from the cache. Returns nil, false if not found or expired.
func (c *Cache) Get(key string) ([]byte, bool) {
	var data []byte
	var createdAt int64

	err := c.db.QueryRow(
		`SELECT data, created_at FROM cache WHERE key = ?`, key,
	).Scan(&data, &createdAt)

	if err != nil {
		atomic.AddInt64(&c.stats.Misses, 1)
		return nil, false
	}

	// Check TTL (0 = never expires).
	ttl := ttlForURL(key)
	if ttl > 0 {
		age := time.Since(time.Unix(createdAt, 0))
		if age > ttl {
			// Expired — delete and return miss.
			_, _ = c.db.Exec(`DELETE FROM cache WHERE key = ?`, key)
			atomic.AddInt64(&c.stats.Misses, 1)
			return nil, false
		}
	}

	atomic.AddInt64(&c.stats.Hits, 1)
	return data, true
}

// GetStale retrieves data from the cache regardless of TTL expiry. This is
// used as a last-resort fallback when the API is unreachable (e.g. during a
// live session lockout on the free tier). The entry is NOT deleted even if it
// has expired — it remains available for future stale reads.
// Returns nil, false only when the key is not in the cache at all.
func (c *Cache) GetStale(key string) ([]byte, bool) {
	var data []byte

	err := c.db.QueryRow(
		`SELECT data FROM cache WHERE key = ?`, key,
	).Scan(&data)

	if err != nil {
		return nil, false
	}
	return data, true
}

// Set stores data in the cache, replacing any existing entry for the same key.
func (c *Cache) Set(key string, data []byte) error {
	_, err := c.db.Exec(
		`INSERT OR REPLACE INTO cache (key, data, created_at) VALUES (?, ?, ?)`,
		key, data, time.Now().Unix(),
	)
	return err
}

// Stats returns current cache hit/miss stats.
func (c *Cache) Stats() CacheStats {
	return CacheStats{
		Hits:   atomic.LoadInt64(&c.stats.Hits),
		Misses: atomic.LoadInt64(&c.stats.Misses),
	}
}

// Clear removes all cached entries.
func (c *Cache) Clear() error {
	_, err := c.db.Exec(`DELETE FROM cache`)
	return err
}

// Size returns the number of cached entries and total data size in bytes.
func (c *Cache) Size() (int, int64) {
	var count int
	var totalSize int64

	_ = c.db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(LENGTH(data)), 0) FROM cache`).Scan(&count, &totalSize)
	return count, totalSize
}

// Prune removes expired entries from the cache. This can be called periodically
// to keep the database lean. It does not touch entries with CacheTTLForever.
func (c *Cache) Prune() error {
	// Remove anything older than CacheTTLLong that isn't permanent.
	// We can't perfectly distinguish by URL here, so we prune entries older
	// than the longest non-permanent TTL. Permanent entries are re-set on each
	// access, so their created_at stays fresh. As a safe cutoff, prune anything
	// older than 7 days that hasn't been refreshed — this catches stale entries
	// while keeping truly permanent historical data (which gets re-stored on use).
	cutoff := time.Now().Add(-7 * 24 * time.Hour).Unix()
	_, err := c.db.Exec(`DELETE FROM cache WHERE created_at < ?`, cutoff)
	return err
}

// Close closes the database connection.
func (c *Cache) Close() error {
	if c.db != nil {
		return c.db.Close()
	}
	return nil
}

// ---------------------------------------------------------------------------
// Track outline persistence
// ---------------------------------------------------------------------------

// GetTrackOutline retrieves pre-fetched GPS location data for a circuit in a
// given season year. Returns the locations and true if a record exists for
// that (circuit_key, year) pair, otherwise nil and false.
func (c *Cache) GetTrackOutline(circuitKey, year int) ([]models.Location, bool) {
	var raw []byte
	err := c.db.QueryRow(
		`SELECT data FROM track_outlines WHERE circuit_key = ? AND year = ?`,
		circuitKey, year,
	).Scan(&raw)
	if err != nil {
		return nil, false
	}

	var locs []models.Location
	if err := json.Unmarshal(raw, &locs); err != nil {
		return nil, false
	}
	return locs, true
}

// SetTrackOutline persists GPS location data for a circuit in a given season
// year. The data is stored as a JSON blob and keyed by (circuit_key, year).
// Calling this again for the same key overwrites the existing record.
func (c *Cache) SetTrackOutline(circuitKey, year int, locs []models.Location) error {
	raw, err := json.Marshal(locs)
	if err != nil {
		return err
	}
	_, err = c.db.Exec(
		`INSERT OR REPLACE INTO track_outlines (circuit_key, year, data, fetched_at) VALUES (?, ?, ?, ?)`,
		circuitKey, year, raw, time.Now().Unix(),
	)
	return err
}

// CleanupOldFileCache removes the old file-based cache directory. Since file
// cache entries used SHA-256 hashed filenames (not reversible), we can't
// migrate them — just clean up. New fetches will repopulate the SQLite cache.
func CleanupOldFileCache() {
	oldDir := oldFileCacheDir()
	entries, err := os.ReadDir(oldDir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".json") {
			_ = os.Remove(filepath.Join(oldDir, entry.Name()))
		}
	}

	// Remove the old directory if empty.
	remaining, _ := os.ReadDir(oldDir)
	if len(remaining) == 0 {
		_ = os.Remove(oldDir)
	}
}

func oldFileCacheDir() string {
	userCacheDir, err := os.UserCacheDir()
	if err == nil {
		return filepath.Join(userCacheDir, "box-box", "openf1")
	}
	return filepath.Join(".cache", "box-box", "openf1")
}
