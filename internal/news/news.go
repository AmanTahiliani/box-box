package news

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

const UserAgent = "box-box/phase-19b-rss-spike"

// Source describes a feed that can be fetched and normalized.
type Source struct {
	ID       string
	Name     string
	URL      string
	Category string
}

// Item is the normalized shape consumed by storage and API layers.
type Item struct {
	Source      string
	Title       string
	URL         string
	PublishedAt time.Time
	Summary     string
	Category    string
	FetchedAt   time.Time
}

// DefaultSources are free RSS/Atom feeds worth using for the Paddock Briefing spike.
var DefaultSources = []Source{
	{ID: "fia", Name: "FIA", URL: "https://www.fia.com/rss/news", Category: "official"},
	{ID: "bbc-f1", Name: "BBC Sport F1", URL: "https://feeds.bbci.co.uk/sport/formula1", Category: "news"},
	{ID: "autosport-f1", Name: "Autosport F1", URL: "https://www.autosport.com/rss/f1/news/", Category: "news"},
	{ID: "racefans-f1", Name: "RaceFans F1", URL: "https://www.racefans.net/category/f1-news/feed/", Category: "news"},
	{ID: "guardian-f1", Name: "Guardian Formula One", URL: "https://www.theguardian.com/sport/formulaone/rss", Category: "news"},
	{ID: "racer-f1", Name: "RACER F1", URL: "https://racer.com/f1/feed", Category: "news"},
	{ID: "f1-youtube", Name: "Formula 1 YouTube", URL: "https://www.youtube.com/feeds/videos.xml?channel_id=UCB_qr75-ydFVKSF9Dmo6izg", Category: "video"},
}

// Fetch retrieves and parses one RSS or Atom feed with the provided HTTP client.
func Fetch(ctx context.Context, client *http.Client, source Source) ([]Item, error) {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, source.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", UserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("fetch %s: status %d", source.ID, resp.StatusCode)
	}
	return Parse(source, resp.Body, time.Now().UTC())
}

// Parse normalizes RSS 2.0 or Atom XML into Items.
func Parse(source Source, r io.Reader, fetchedAt time.Time) ([]Item, error) {
	payload, err := io.ReadAll(io.LimitReader(r, 2<<20))
	if err != nil {
		return nil, err
	}

	var rss rssFeed
	if err := xml.Unmarshal(payload, &rss); err == nil && len(rss.Channel.Items) > 0 {
		return normalizeRSS(source, rss.Channel.Items, fetchedAt), nil
	}

	var atom atomFeed
	if err := xml.Unmarshal(payload, &atom); err != nil {
		return nil, err
	}
	if len(atom.Entries) == 0 {
		return nil, fmt.Errorf("parse %s: no RSS items or Atom entries found", source.ID)
	}
	return normalizeAtom(source, atom.Entries, fetchedAt), nil
}

// DeduplicateByURL keeps the newest instance of each canonical URL.
func DeduplicateByURL(items []Item) []Item {
	byURL := make(map[string]Item, len(items))
	for _, item := range items {
		key := canonicalURL(item.URL)
		if key == "" {
			continue
		}
		item.URL = key
		if existing, ok := byURL[key]; !ok || item.PublishedAt.After(existing.PublishedAt) {
			byURL[key] = item
		}
	}

	out := make([]Item, 0, len(byURL))
	for _, item := range byURL {
		out = append(out, item)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].PublishedAt.After(out[j].PublishedAt)
	})
	return out
}

type rssFeed struct {
	Channel struct {
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
}

type rssItem struct {
	Title       string   `xml:"title"`
	Link        string   `xml:"link"`
	GUID        string   `xml:"guid"`
	PubDate     string   `xml:"pubDate"`
	Description string   `xml:"description"`
	Categories  []string `xml:"category"`
}

type atomFeed struct {
	Entries []atomEntry `xml:"entry"`
}

type atomEntry struct {
	Title      string     `xml:"title"`
	ID         string     `xml:"id"`
	Updated    string     `xml:"updated"`
	Published  string     `xml:"published"`
	Summary    string     `xml:"summary"`
	Content    string     `xml:"content"`
	Links      []atomLink `xml:"link"`
	Categories []struct {
		Term  string `xml:"term,attr"`
		Label string `xml:"label,attr"`
	} `xml:"category"`
}

type atomLink struct {
	Href string `xml:"href,attr"`
	Rel  string `xml:"rel,attr"`
}

func normalizeRSS(source Source, raw []rssItem, fetchedAt time.Time) []Item {
	items := make([]Item, 0, len(raw))
	for _, entry := range raw {
		link := strings.TrimSpace(entry.Link)
		if link == "" {
			link = strings.TrimSpace(entry.GUID)
		}
		items = append(items, Item{
			Source:      source.ID,
			Title:       cleanText(entry.Title),
			URL:         link,
			PublishedAt: parseFeedTime(entry.PubDate),
			Summary:     cleanText(entry.Description),
			Category:    firstNonEmpty(entry.Categories, source.Category),
			FetchedAt:   fetchedAt,
		})
	}
	return DeduplicateByURL(items)
}

func normalizeAtom(source Source, raw []atomEntry, fetchedAt time.Time) []Item {
	items := make([]Item, 0, len(raw))
	for _, entry := range raw {
		category := source.Category
		if len(entry.Categories) > 0 {
			category = firstNonEmpty([]string{entry.Categories[0].Label, entry.Categories[0].Term}, source.Category)
		}
		items = append(items, Item{
			Source:      source.ID,
			Title:       cleanText(entry.Title),
			URL:         atomEntryURL(entry),
			PublishedAt: parseFeedTime(firstNonEmpty([]string{entry.Published, entry.Updated}, "")),
			Summary:     cleanText(firstNonEmpty([]string{entry.Summary, entry.Content}, "")),
			Category:    category,
			FetchedAt:   fetchedAt,
		})
	}
	return DeduplicateByURL(items)
}

func atomEntryURL(entry atomEntry) string {
	for _, link := range entry.Links {
		if link.Rel == "" || link.Rel == "alternate" {
			return strings.TrimSpace(link.Href)
		}
	}
	if len(entry.Links) > 0 {
		return strings.TrimSpace(entry.Links[0].Href)
	}
	return strings.TrimSpace(entry.ID)
}

func parseFeedTime(value string) time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}
	}
	layouts := []string{
		time.RFC1123Z,
		time.RFC1123,
		time.RFC3339,
		time.RFC3339Nano,
		"Mon, 02 Jan 2006 15:04:05 -0700",
		"Mon, 2 Jan 2006 15:04:05 -0700",
	}
	for _, layout := range layouts {
		if ts, err := time.Parse(layout, value); err == nil {
			return ts.UTC()
		}
	}
	return time.Time{}
}

func cleanText(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, "\n", " ")
	value = strings.ReplaceAll(value, "\t", " ")
	return strings.Join(strings.Fields(value), " ")
}

func firstNonEmpty(values []string, fallback string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return fallback
}

func canonicalURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return raw
	}
	parsed.Fragment = ""
	q := parsed.Query()
	for key := range q {
		if strings.HasPrefix(strings.ToLower(key), "utm_") {
			q.Del(key)
		}
	}
	parsed.RawQuery = q.Encode()
	return parsed.String()
}
