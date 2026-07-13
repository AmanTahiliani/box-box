package web

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	_ "modernc.org/sqlite"
)

func TestOpenF1HandlerReportsFreshThenStaleSuccess(t *testing.T) {
	year := time.Now().Year()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprintf(w, `[{"meeting_key":1,"meeting_name":"British Grand Prix","year":%d}]`, year)
	}))
	client := api.NewOpenF1Client(upstream.URL, time.Second)
	t.Cleanup(func() { _ = client.Close() })
	server := NewServer(client, 0, nil)
	cacheKey := fmt.Sprintf("%s/v1/meetings?year=%d", upstream.URL, year)
	requestURL := fmt.Sprintf("/api/v1/meetings?year=%d&source=openf1", year)
	defer func() {
		// Keep the shared application cache clean even if this test fails.
		db, err := sql.Open("sqlite", api.DefaultCacheDBPath()+"?_busy_timeout=5000")
		if err == nil {
			_, _ = db.Exec(`DELETE FROM cache WHERE key = ?`, cacheKey)
			_ = db.Close()
		}
	}()

	fresh := httptest.NewRecorder()
	server.handleMeetings(fresh, httptest.NewRequest(http.MethodGet, requestURL, nil))
	if fresh.Code != http.StatusOK || fresh.Header().Get(dataSourceHeader) != "openf1" || fresh.Header().Get(dataFreshnessHeader) != "fresh" {
		t.Fatalf("fresh response status/metadata = %d %q/%q body=%s", fresh.Code, fresh.Header().Get(dataSourceHeader), fresh.Header().Get(dataFreshnessHeader), fresh.Body.String())
	}

	db, err := sql.Open("sqlite", api.DefaultCacheDBPath()+"?_busy_timeout=5000")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE cache SET created_at = ? WHERE key = ?`, time.Now().Add(-48*time.Hour).Unix(), cacheKey); err != nil {
		_ = db.Close()
		t.Fatal(err)
	}
	_ = db.Close()
	upstream.Close()

	stale := httptest.NewRecorder()
	server.handleMeetings(stale, httptest.NewRequest(http.MethodGet, requestURL, nil))
	if stale.Code != http.StatusOK || stale.Header().Get(dataSourceHeader) != "openf1" || stale.Header().Get(dataFreshnessHeader) != "stale" {
		t.Fatalf("stale response status/metadata = %d %q/%q body=%s", stale.Code, stale.Header().Get(dataSourceHeader), stale.Header().Get(dataFreshnessHeader), stale.Body.String())
	}
}

func TestFreshnessHeadersAreExposedToBrowserClients(t *testing.T) {
	handler := withCORS(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		markDataResponse(w, "local", "partial")
		writeJSON(w, map[string]bool{"ok": true})
	}))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/test", nil))

	if got := recorder.Header().Get("Access-Control-Expose-Headers"); got != dataSourceHeader+", "+dataFreshnessHeader {
		t.Fatalf("exposed headers = %q", got)
	}
	if recorder.Header().Get(dataSourceHeader) != "local" || recorder.Header().Get(dataFreshnessHeader) != "partial" {
		t.Fatalf("data metadata = %q/%q", recorder.Header().Get(dataSourceHeader), recorder.Header().Get(dataFreshnessHeader))
	}
}
