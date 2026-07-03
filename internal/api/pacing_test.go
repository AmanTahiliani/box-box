package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// newPacedTestClient builds a client against a test server with an isolated cache
// (HOME is pointed at a temp dir so the SQLite cache never touches the real one).
func newPacedTestClient(t *testing.T, srvURL string, interval time.Duration) *OpenF1Client {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	c := NewOpenF1Client(srvURL, 5*time.Second)
	c.pacer = &requestPacer{interval: interval}
	t.Cleanup(func() { _ = c.Close() })
	return c
}

func TestRequestPacerSpacesConcurrentCallers(t *testing.T) {
	p := &requestPacer{interval: 20 * time.Millisecond}
	const callers = 5

	start := time.Now()
	var wg sync.WaitGroup
	for i := 0; i < callers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			p.wait()
		}()
	}
	wg.Wait()

	// 5 callers at 20ms spacing: the last slot is 80ms after the first.
	if elapsed := time.Since(start); elapsed < 4*20*time.Millisecond {
		t.Fatalf("pacer did not space callers: %d finished in %v", callers, elapsed)
	}
}

func TestRequestPacerNilSafe(t *testing.T) {
	var p *requestPacer
	p.wait() // must not panic
}

func TestGetRetriesOn429(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) <= 2 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_ = json.NewEncoder(w).Encode([]map[string]any{{"meeting_key": 1}})
	}))
	defer srv.Close()

	c := newPacedTestClient(t, srv.URL, time.Millisecond)
	body, err := c.get(srv.URL + "/v1/meetings")
	if err != nil {
		t.Fatalf("get after 429s should succeed, got %v", err)
	}
	data, _ := io.ReadAll(body)
	body.Close()
	if len(data) == 0 {
		t.Fatal("expected response body after retries")
	}
	if got := calls.Load(); got != 3 {
		t.Fatalf("expected 3 attempts (2×429 + 1×200), got %d", got)
	}
}

func TestGetGivesUpAfterMaxRetries(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Retry-After", "0")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer srv.Close()

	c := newPacedTestClient(t, srv.URL, time.Millisecond)
	_, err := c.get(srv.URL + "/v1/meetings")
	if err == nil {
		t.Fatal("expected error when server keeps returning 429")
	}
	if got := calls.Load(); got != int32(max429Retries)+1 {
		t.Fatalf("expected %d attempts, got %d", max429Retries+1, got)
	}
}

func TestRetryAfter429Cap(t *testing.T) {
	resp := &http.Response{Header: http.Header{"Retry-After": []string{"3600"}}}
	if got := retryAfter429(resp); got != 10*time.Second {
		t.Fatalf("expected 10s cap, got %v", got)
	}
	resp = &http.Response{Header: http.Header{}}
	if got := retryAfter429(resp); got != time.Second {
		t.Fatalf("expected 1s default, got %v", got)
	}
}
