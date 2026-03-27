package api

import (
	"net/http"
	"sync/atomic"
	"time"
)

type OpenF1Client struct {
	url        string
	apiKey     string
	httpClient *http.Client
	cache      *Cache

	// staleFlag is set to 1 atomically whenever a request falls back to stale
	// cached data (e.g. because the API is locked during a live session).
	// The UI reads this via LastResponseWasStale() to decide whether to show
	// a disclaimer banner. The flag is sticky until ClearStaleFlag() is called.
	staleFlag int32
}

func NewOpenF1Client(url string, timeout time.Duration) *OpenF1Client {
	return &OpenF1Client{
		url:        url,
		httpClient: &http.Client{Timeout: timeout},
		cache:      NewCache(),
	}
}

// NewOpenF1ClientWithKey creates a client that authenticates with a Bearer token.
// This allows access during live sessions (paid tier).
func NewOpenF1ClientWithKey(url string, timeout time.Duration, apiKey string) *OpenF1Client {
	return &OpenF1Client{
		url:        url,
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: timeout},
		cache:      NewCache(),
	}
}

// Cache returns the underlying Cache so callers can access track outline
// storage and other persistent data directly.
func (c *OpenF1Client) Cache() *Cache {
	return c.cache
}

// LastResponseWasStale reports whether the most recent API request (or any
// request since the last ClearStaleFlag call) fell back to expired cached
// data because the API was unavailable.  The UI uses this to show a
// disclaimer banner informing the user that data may be stale.
func (c *OpenF1Client) LastResponseWasStale() bool {
	return atomic.LoadInt32(&c.staleFlag) == 1
}

// ClearStaleFlag resets the stale indicator. Call this when navigating away
// from a tab or after the disclaimer has been acknowledged.
func (c *OpenF1Client) ClearStaleFlag() {
	atomic.StoreInt32(&c.staleFlag, 0)
}

// setStale marks the client as having served stale data.
func (c *OpenF1Client) setStale() {
	atomic.StoreInt32(&c.staleFlag, 1)
}

// CacheStats returns the cache hit/miss statistics.
func (c *OpenF1Client) CacheStats() CacheStats {
	return c.cache.Stats()
}

// CacheSize returns the number of cached entries and total size in bytes.
func (c *OpenF1Client) CacheSize() (int, int64) {
	return c.cache.Size()
}

// Close releases resources held by the client (closes the cache database).
func (c *OpenF1Client) Close() error {
	return c.cache.Close()
}
