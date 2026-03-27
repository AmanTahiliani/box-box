package api

import (
	"net/http"
	"time"
)

type OpenF1Client struct {
	url        string
	apiKey     string
	httpClient *http.Client
	cache      *Cache
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
