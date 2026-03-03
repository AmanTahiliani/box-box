package api

import (
	"net/http"
	"time"
)

type OpenF1Client struct {
	url        string
	httpClient *http.Client
	cache      *FileCache
}

func NewOpenF1Client(url string, timeout time.Duration) *OpenF1Client {
	return &OpenF1Client{
		url:        url,
		httpClient: &http.Client{Timeout: timeout},
		cache:      NewFileCache(),
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
