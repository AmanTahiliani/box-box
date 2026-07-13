package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func expireCacheEntry(t *testing.T, c *OpenF1Client, key string) {
	t.Helper()
	if _, err := c.cache.db.Exec(`UPDATE cache SET created_at = ? WHERE key = ?`, time.Now().Add(-48*time.Hour).Unix(), key); err != nil {
		t.Fatal(err)
	}
}

func TestScopedClientReportsStaleFallbackWithoutMutatingParent(t *testing.T) {
	year := time.Now().Year()
	var fail atomic.Bool
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if fail.Load() {
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `[{
			"meeting_key": 1,
			"meeting_name": "British Grand Prix",
			"year": %d
		}]`, year)
	}))
	defer upstream.Close()

	client := NewOpenF1Client(upstream.URL, time.Second)
	defer client.Close()
	client.pacer.interval = 0
	key := fmt.Sprintf("%s/v1/meetings?year=%d", upstream.URL, year)
	_, _ = client.cache.db.Exec(`DELETE FROM cache WHERE key = ?`, key)
	defer func() { _, _ = client.cache.db.Exec(`DELETE FROM cache WHERE key = ?`, key) }()

	if _, err := client.GetMeetingsForYear(year); err != nil {
		t.Fatalf("prime cache: %v", err)
	}
	expireCacheEntry(t, client, key)
	fail.Store(true)

	scoped := client.Scoped()
	meetings, err := scoped.GetMeetingsForYear(year)
	if err != nil || len(meetings) != 1 {
		t.Fatalf("stale fallback = (%+v, %v)", meetings, err)
	}
	if !scoped.LastResponseWasStale() {
		t.Fatal("scoped request did not report its stale fallback")
	}
	if client.LastResponseWasStale() {
		t.Fatal("request-scoped fallback leaked into the parent client")
	}
}

func TestScopedClientsDoNotLeakFreshnessAcrossConcurrentRequests(t *testing.T) {
	year := time.Now().Year()
	staleStarted := make(chan struct{})
	releaseStale := make(chan struct{})
	var failMeetings atomic.Bool
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/meetings":
			if failMeetings.Load() {
				close(staleStarted)
				<-releaseStale
				http.Error(w, "unavailable", http.StatusServiceUnavailable)
				return
			}
			_, _ = fmt.Fprintf(w, `[{"meeting_key":1,"meeting_name":"British Grand Prix","year":%d}]`, year)
		case "/v1/sessions":
			_, _ = w.Write([]byte(`[{"session_key":11,"meeting_key":2,"session_name":"Race"}]`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	client := NewOpenF1Client(upstream.URL, 2*time.Second)
	defer client.Close()
	client.pacer.interval = 0
	meetingKey := fmt.Sprintf("%s/v1/meetings?year=%d", upstream.URL, year)
	sessionKey := upstream.URL + "/v1/sessions?meeting_key=2"
	_, _ = client.cache.db.Exec(`DELETE FROM cache WHERE key IN (?, ?)`, meetingKey, sessionKey)
	defer func() { _, _ = client.cache.db.Exec(`DELETE FROM cache WHERE key IN (?, ?)`, meetingKey, sessionKey) }()
	if _, err := client.GetMeetingsForYear(year); err != nil {
		t.Fatal(err)
	}
	expireCacheEntry(t, client, meetingKey)
	failMeetings.Store(true)

	staleClient := client.Scoped()
	staleDone := make(chan error, 1)
	go func() {
		_, err := staleClient.GetMeetingsForYear(year)
		staleDone <- err
	}()
	<-staleStarted

	freshClient := client.Scoped()
	if _, err := freshClient.GetSessionsForMeeting(2); err != nil {
		t.Fatalf("fresh concurrent request: %v", err)
	}
	if freshClient.LastResponseWasStale() {
		t.Fatal("fresh request inherited concurrent request's stale state")
	}
	close(releaseStale)
	if err := <-staleDone; err != nil {
		t.Fatalf("stale request: %v", err)
	}
	if !staleClient.LastResponseWasStale() {
		t.Fatal("stale request lost its own freshness state")
	}
	if freshClient.LastResponseWasStale() || client.LastResponseWasStale() {
		t.Fatal("stale state leaked after concurrent requests completed")
	}
}
