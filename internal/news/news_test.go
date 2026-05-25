package news

import (
	"strings"
	"testing"
	"time"
)

func TestParseRSSDeduplicatesByURL(t *testing.T) {
	fixture := `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>First story</title>
      <link>https://example.com/f1/story?utm_source=rss</link>
      <pubDate>Mon, 25 May 2026 10:00:00 GMT</pubDate>
      <description>Latest from the paddock</description>
      <category>Formula 1</category>
    </item>
    <item>
      <title>Duplicate story newer</title>
      <link>https://example.com/f1/story</link>
      <pubDate>Mon, 25 May 2026 11:00:00 GMT</pubDate>
      <description>Updated headline</description>
    </item>
  </channel>
</rss>`
	source := Source{ID: "example", Category: "news"}
	items, err := Parse(source, strings.NewReader(fixture), time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("items len = %d, want 1", len(items))
	}
	if items[0].Title != "Duplicate story newer" {
		t.Fatalf("title = %q, want newer duplicate", items[0].Title)
	}
	if items[0].URL != "https://example.com/f1/story" {
		t.Fatalf("url = %q, want canonical URL", items[0].URL)
	}
	if items[0].PublishedAt.IsZero() {
		t.Fatal("PublishedAt was not parsed")
	}
}

func TestParseAtom(t *testing.T) {
	fixture := `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Formula 1 video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
    <published>2026-05-25T12:30:00Z</published>
    <summary>Highlights from the weekend</summary>
    <category term="video"/>
  </entry>
</feed>`
	source := Source{ID: "f1-youtube", Category: "video"}
	items, err := Parse(source, strings.NewReader(fixture), time.Unix(200, 0).UTC())
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("items len = %d, want 1", len(items))
	}
	if items[0].Source != "f1-youtube" || items[0].Category != "video" {
		t.Fatalf("item = %+v, want source/category preserved", items[0])
	}
	if items[0].URL != "https://www.youtube.com/watch?v=abc123" {
		t.Fatalf("url = %q, want alternate link", items[0].URL)
	}
}
