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
