package store

import (
	"database/sql"
	"fmt"
	"time"
)

// UpsertNewsSource inserts or updates RSS/Atom feed metadata.
func (s *Store) UpsertNewsSource(src NewsSource) error {
	updatedAt := src.UpdatedAt
	if updatedAt.IsZero() {
		updatedAt = time.Now().UTC()
	}
	_, err := s.db.Exec(`
		INSERT INTO news_sources (
			source, name, feed_url, category, enabled, fetched_at, expires_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(source) DO UPDATE SET
			name = excluded.name,
			feed_url = excluded.feed_url,
			category = excluded.category,
			enabled = excluded.enabled,
			fetched_at = excluded.fetched_at,
			expires_at = excluded.expires_at,
			updated_at = excluded.updated_at
	`,
		src.Source,
		src.Name,
		src.FeedURL,
		nullString(src.Category),
		boolInt(src.Enabled),
		nullableTime(src.FetchedAt),
		nullableTime(src.ExpiresAt),
		updatedAt.Unix(),
	)
	if err != nil {
		return fmt.Errorf("upsert news source: %w", err)
	}
	return nil
}

// UpsertNewsItem inserts or updates a normalized feed item.
// read_at is never overwritten by a re-fetch.
// og_image_url and og_description preserve an existing value when the new one is empty.
func (s *Store) UpsertNewsItem(item NewsItem) error {
	_, err := s.db.Exec(`
		INSERT INTO news_items (
			url, source, title, published_at, summary, category, fetched_at,
			og_image_url, og_description
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(url) DO UPDATE SET
			source        = excluded.source,
			title         = excluded.title,
			published_at  = excluded.published_at,
			summary       = excluded.summary,
			category      = excluded.category,
			fetched_at    = excluded.fetched_at,
			og_image_url  = COALESCE(excluded.og_image_url, news_items.og_image_url),
			og_description= COALESCE(excluded.og_description, news_items.og_description)
	`,
		item.URL,
		item.Source,
		item.Title,
		nullableTime(item.PublishedAt),
		nullString(item.Summary),
		nullString(item.Category),
		item.FetchedAt.Unix(),
		nullString(item.OGImageURL),
		nullString(item.OGDescription),
	)
	if err != nil {
		return fmt.Errorf("upsert news item: %w", err)
	}
	return nil
}

// MarkNewsItemRead sets read_at to now for the given URL.
func (s *Store) MarkNewsItemRead(url string) error {
	_, err := s.db.Exec(
		`UPDATE news_items SET read_at = ? WHERE url = ?`,
		time.Now().Unix(), url,
	)
	return err
}

// ListNewsItems returns newest cached news items, optionally filtered by source.
func (s *Store) ListNewsItems(limit int, source string) ([]NewsItem, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	query := `
		SELECT url, source, title, published_at, summary, category, fetched_at,
		       og_image_url, og_description, read_at
		FROM news_items
	`
	var args []any
	if source != "" {
		query += ` WHERE source = ?`
		args = append(args, source)
	}
	query += ` ORDER BY COALESCE(published_at, fetched_at) DESC, fetched_at DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []NewsItem
	for rows.Next() {
		var item NewsItem
		var published, readAt sql.NullInt64
		var summary, category, ogImage, ogDesc sql.NullString
		var fetched int64
		if err := rows.Scan(
			&item.URL,
			&item.Source,
			&item.Title,
			&published,
			&summary,
			&category,
			&fetched,
			&ogImage,
			&ogDesc,
			&readAt,
		); err != nil {
			return nil, err
		}
		item.PublishedAt = nullTimePtr(published)
		item.Summary = summary.String
		item.Category = category.String
		item.FetchedAt = time.Unix(fetched, 0).UTC()
		item.OGImageURL = ogImage.String
		item.OGDescription = ogDesc.String
		item.ReadAt = nullTimePtr(readAt)
		out = append(out, item)
	}
	return out, rows.Err()
}

func nullableTime(v *time.Time) any {
	if v == nil || v.IsZero() {
		return nil
	}
	return v.Unix()
}

func nullTimePtr(v sql.NullInt64) *time.Time {
	if !v.Valid {
		return nil
	}
	t := time.Unix(v.Int64, 0).UTC()
	return &t
}
