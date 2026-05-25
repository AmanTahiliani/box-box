package query

import (
	"time"

	"github.com/AmanTahiliani/box-box/internal/store"
)

// NewsItem is the frontend-facing cached briefing shape.
type NewsItem struct {
	Source        string     `json:"source"`
	Title         string     `json:"title"`
	URL           string     `json:"url"`
	PublishedAt   *time.Time `json:"published_at,omitempty"`
	Summary       string     `json:"summary,omitempty"`
	Category      string     `json:"category,omitempty"`
	FetchedAt     time.Time  `json:"fetched_at"`
	OGImageURL    string     `json:"og_image_url,omitempty"`
	OGDescription string     `json:"og_description,omitempty"`
	ReadAt        *time.Time `json:"read_at,omitempty"`
}

// ListNews returns cached briefing items.
func (s *Service) ListNews(limit int, source string) ([]NewsItem, error) {
	rows, err := s.store.ListNewsItems(limit, source)
	if err != nil {
		return nil, err
	}
	out := make([]NewsItem, 0, len(rows))
	for _, row := range rows {
		out = append(out, NewsItem{
			Source:        row.Source,
			Title:         row.Title,
			URL:           row.URL,
			PublishedAt:   row.PublishedAt,
			Summary:       row.Summary,
			Category:      row.Category,
			FetchedAt:     row.FetchedAt,
			OGImageURL:    row.OGImageURL,
			OGDescription: row.OGDescription,
			ReadAt:        row.ReadAt,
		})
	}
	return out, nil
}

// MarkNewsRead marks a news item as read by URL.
func (s *Service) MarkNewsRead(url string) error {
	return s.store.MarkNewsItemRead(url)
}

func NewsItemToStore(item NewsItem) store.NewsItem {
	return store.NewsItem{
		URL:           item.URL,
		Source:        item.Source,
		Title:         item.Title,
		PublishedAt:   item.PublishedAt,
		Summary:       item.Summary,
		Category:      item.Category,
		FetchedAt:     item.FetchedAt,
		OGImageURL:    item.OGImageURL,
		OGDescription: item.OGDescription,
	}
}
