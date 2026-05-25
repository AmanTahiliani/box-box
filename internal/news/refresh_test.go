package news

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/store"
)

func TestRefreshStoresSourcesAndItems(t *testing.T) {
	feed := `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Briefing one</title>
      <link>https://example.com/f1/one?utm_source=rss</link>
      <pubDate>Mon, 25 May 2026 10:00:00 GMT</pubDate>
      <description>Morning note</description>
    </item>
    <item>
      <title>Briefing duplicate newer</title>
      <link>https://example.com/f1/one</link>
      <pubDate>Mon, 25 May 2026 11:00:00 GMT</pubDate>
      <description>Updated note</description>
    </item>
  </channel>
</rss>`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("User-Agent"); got != UserAgent {
			t.Fatalf("User-Agent = %q, want %q", got, UserAgent)
		}
		w.Header().Set("Content-Type", "application/rss+xml")
		_, _ = w.Write([]byte(feed))
	}))
	defer server.Close()

	st := openNewsTestStore(t)
	now := time.Unix(1800000000, 0).UTC()
	result, err := Refresh(context.Background(), st, RefreshOptions{
		Sources: []Source{{
			ID:       "example",
			Name:     "Example F1",
			URL:      server.URL + "/feed.xml",
			Category: "news",
		}},
		Client: server.Client(),
		TTL:    time.Hour,
		Now:    func() time.Time { return now },
	})
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	if result.SourcesFetched != 1 || result.ItemsFetched != 1 || result.ItemsUpserted != 1 || result.SourcesFailed != 0 {
		t.Fatalf("result = %+v, want one fetched/upserted item and no failures", result)
	}

	var fetchedAt, expiresAt int64
	if err := st.DB().QueryRow(`
		SELECT fetched_at, expires_at
		FROM news_sources
		WHERE source = 'example'
	`).Scan(&fetchedAt, &expiresAt); err != nil {
		t.Fatalf("query source metadata: %v", err)
	}
	if fetchedAt != now.Unix() || expiresAt != now.Add(time.Hour).Unix() {
		t.Fatalf("source times = %d/%d, want %d/%d", fetchedAt, expiresAt, now.Unix(), now.Add(time.Hour).Unix())
	}

	items, err := st.ListNewsItems(10, "example")
	if err != nil {
		t.Fatalf("ListNewsItems() error = %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("items len = %d, want 1", len(items))
	}
	if items[0].URL != "https://example.com/f1/one" || items[0].Title != "Briefing duplicate newer" {
		t.Fatalf("stored item = %+v, want canonical newer duplicate", items[0])
	}
	if !items[0].FetchedAt.Equal(now) {
		t.Fatalf("item fetched_at = %v, want %v", items[0].FetchedAt, now)
	}
}

func TestRefreshDryRunDoesNotRequireStore(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<?xml version="1.0"?><rss version="2.0"><channel><item><title>Dry</title><link>https://example.com/dry</link></item></channel></rss>`))
	}))
	defer server.Close()

	result, err := Refresh(context.Background(), nil, RefreshOptions{
		Sources: []Source{{ID: "dry", Name: "Dry", URL: server.URL, Category: "news"}},
		Client:  server.Client(),
		DryRun:  true,
	})
	if err != nil {
		t.Fatalf("Refresh() dry run error = %v", err)
	}
	if result.ItemsFetched != 1 || result.ItemsUpserted != 0 {
		t.Fatalf("result = %+v, want fetched item with no upsert", result)
	}
}

func TestRefreshContinuesAfterSourceFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "bad") {
			http.Error(w, "nope", http.StatusBadGateway)
			return
		}
		_, _ = w.Write([]byte(`<?xml version="1.0"?><rss version="2.0"><channel><item><title>Good</title><link>https://example.com/good</link></item></channel></rss>`))
	}))
	defer server.Close()

	st := openNewsTestStore(t)
	result, err := Refresh(context.Background(), st, RefreshOptions{
		Sources: []Source{
			{ID: "bad", Name: "Bad", URL: server.URL + "/bad", Category: "news"},
			{ID: "good", Name: "Good", URL: server.URL + "/good", Category: "news"},
		},
		Client: server.Client(),
	})
	if err == nil {
		t.Fatal("Refresh() error = nil, want source failure")
	}
	if result.SourcesFetched != 1 || result.SourcesFailed != 1 || result.ItemsUpserted != 1 {
		t.Fatalf("result = %+v, want one failure and one stored item", result)
	}
	items, err := st.ListNewsItems(10, "")
	if err != nil {
		t.Fatalf("ListNewsItems() error = %v", err)
	}
	if len(items) != 1 || items[0].Source != "good" {
		t.Fatalf("items = %+v, want good source item stored", items)
	}
}

func openNewsTestStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "news.db"))
	if err != nil {
		t.Fatalf("store.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}
