package api

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
)

// CacheStats tracks cache hit/miss statistics.
type CacheStats struct {
	Hits   int64
	Misses int64
}

// FileCache implements a file-backed HTTP response cache with TTL expiry.
type FileCache struct {
	dir   string
	stats CacheStats
}

// Default TTL values.
const (
	// CacheTTLShort is for current-season, frequently changing data (meetings, sessions, results).
	CacheTTLShort = 15 * time.Minute
	// CacheTTLMedium is for semi-stable data (championship standings, driver lists).
	CacheTTLMedium = 1 * time.Hour
	// CacheTTLLong is for historical data that rarely changes (past season data).
	CacheTTLLong = 24 * time.Hour
)

func NewFileCache() *FileCache {
	var cacheDir string
	userCacheDir, err := os.UserCacheDir()
	if err == nil {
		cacheDir = filepath.Join(userCacheDir, "box-box", "openf1")
	} else {
		// Fallback to a local .cache directory
		cacheDir = ".cache/box-box/openf1"
	}

	// Ensure the cache directory exists
	_ = os.MkdirAll(cacheDir, 0755)

	return &FileCache{
		dir: cacheDir,
	}
}

func (c *FileCache) getCachePath(key string) string {
	hash := sha256.Sum256([]byte(key))
	filename := hex.EncodeToString(hash[:]) + ".json"
	return filepath.Join(c.dir, filename)
}

// ttlForURL determines the appropriate TTL based on the URL pattern.
func ttlForURL(url string) time.Duration {
	// Historical data (specific year queries for past years)
	if strings.Contains(url, "year=2023") || strings.Contains(url, "year=2024") {
		return CacheTTLLong
	}

	// Frequently changing endpoints
	if strings.Contains(url, "/position") ||
		strings.Contains(url, "/intervals") ||
		strings.Contains(url, "/car_data") ||
		strings.Contains(url, "/location") {
		return CacheTTLShort
	}

	// Semi-stable data
	if strings.Contains(url, "/championship") ||
		strings.Contains(url, "/drivers") {
		return CacheTTLMedium
	}

	// Default: medium TTL for everything else
	return CacheTTLMedium
}

// Get retrieves data from the cache. Returns nil, false if not found or expired.
func (c *FileCache) Get(key string) ([]byte, bool) {
	path := c.getCachePath(key)
	info, err := os.Stat(path)
	if err != nil {
		atomic.AddInt64(&c.stats.Misses, 1)
		return nil, false
	}

	// Check TTL based on file modification time
	ttl := ttlForURL(key)
	if time.Since(info.ModTime()) > ttl {
		// Expired — remove the stale file
		_ = os.Remove(path)
		atomic.AddInt64(&c.stats.Misses, 1)
		return nil, false
	}

	data, err := os.ReadFile(path)
	if err != nil {
		atomic.AddInt64(&c.stats.Misses, 1)
		return nil, false
	}

	atomic.AddInt64(&c.stats.Hits, 1)
	return data, true
}

// Set saves data to the cache.
func (c *FileCache) Set(key string, data []byte) error {
	path := c.getCachePath(key)
	return os.WriteFile(path, data, 0644)
}

// Stats returns current cache hit/miss stats.
func (c *FileCache) Stats() CacheStats {
	return CacheStats{
		Hits:   atomic.LoadInt64(&c.stats.Hits),
		Misses: atomic.LoadInt64(&c.stats.Misses),
	}
}

// Clear removes all cached files.
func (c *FileCache) Clear() error {
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".json") {
			_ = os.Remove(filepath.Join(c.dir, entry.Name()))
		}
	}
	return nil
}

// Size returns the number of cached files and total size in bytes.
func (c *FileCache) Size() (int, int64) {
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return 0, 0
	}
	count := 0
	var totalSize int64
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".json") {
			count++
			info, err := entry.Info()
			if err == nil {
				totalSize += info.Size()
			}
		}
	}
	return count, totalSize
}
