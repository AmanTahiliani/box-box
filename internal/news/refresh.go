package news

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/AmanTahiliani/box-box/internal/store"
)

const DefaultTTL = 30 * time.Minute

// Store is the storage surface needed by feed refreshes.
type Store interface {
	UpsertNewsSource(store.NewsSource) error
	UpsertNewsItem(store.NewsItem) error
}

// RefreshOptions configures one local news refresh run.
type RefreshOptions struct {
	Sources    []Source
	Client     *http.Client
	TTL        time.Duration
	DryRun     bool
	Now        func() time.Time
	Progress   io.Writer
	EnrichOG   bool // fetch og:image and og:description for each new item
	OGParallel int  // max concurrent OG fetches (default 5)
}

// RefreshResult summarizes one local news refresh run.
type RefreshResult struct {
	SourcesFetched int
	SourcesFailed  int
	ItemsFetched   int
	ItemsUpserted  int
}

// Refresh fetches RSS/Atom sources and stores normalized, URL-deduped items.
func Refresh(ctx context.Context, st Store, opts RefreshOptions) (RefreshResult, error) {
	if st == nil && !opts.DryRun {
		return RefreshResult{}, errors.New("news refresh: store is required")
	}
	if len(opts.Sources) == 0 {
		opts.Sources = DefaultSources
	}
	if opts.Client == nil {
		opts.Client = &http.Client{Timeout: 10 * time.Second}
	}
	if opts.TTL <= 0 {
		opts.TTL = DefaultTTL
	}
	if opts.OGParallel <= 0 {
		opts.OGParallel = 5
	}
	now := func() time.Time { return time.Now().UTC() }
	if opts.Now != nil {
		now = func() time.Time { return opts.Now().UTC() }
	}

	var result RefreshResult
	var failures []string

	// Collect all items across sources for OG enrichment.
	var allItems []Item

	for _, source := range opts.Sources {
		fetchedAt := now()
		expiresAt := fetchedAt.Add(opts.TTL)
		if !opts.DryRun {
			if err := st.UpsertNewsSource(store.NewsSource{
				Source:    source.ID,
				Name:      source.Name,
				FeedURL:   source.URL,
				Category:  source.Category,
				Enabled:   true,
				UpdatedAt: fetchedAt,
			}); err != nil {
				return result, err
			}
		}
		items, err := Fetch(ctx, opts.Client, source)
		if err != nil {
			result.SourcesFailed++
			failures = append(failures, fmt.Sprintf("%s: %v", source.ID, err))
			progressf(opts.Progress, "news: %s failed: %v\n", source.ID, err)
			continue
		}

		result.SourcesFetched++
		result.ItemsFetched += len(items)
		progressf(opts.Progress, "news: %s fetched %d items\n", source.ID, len(items))
		if opts.DryRun {
			allItems = append(allItems, items...)
			continue
		}

		if err := st.UpsertNewsSource(store.NewsSource{
			Source:    source.ID,
			Name:      source.Name,
			FeedURL:   source.URL,
			Category:  source.Category,
			Enabled:   true,
			FetchedAt: &fetchedAt,
			ExpiresAt: &expiresAt,
			UpdatedAt: fetchedAt,
		}); err != nil {
			return result, err
		}

		for i := range items {
			items[i].FetchedAt = fetchedAt
		}
		allItems = append(allItems, items...)
	}

	// OG enrichment pass: fetch og:image + og:description for each item.
	if opts.EnrichOG && len(allItems) > 0 {
		progressf(opts.Progress, "news: enriching %d items with OG metadata\n", len(allItems))
		enrichOG(ctx, opts.Client, allItems, opts.OGParallel, opts.Progress)
	}

	if opts.DryRun {
		return result, nil
	}

	// Store all items (with OG data already populated).
	for _, item := range allItems {
		publishedAt := timePtr(item.PublishedAt)
		if err := st.UpsertNewsItem(store.NewsItem{
			URL:           item.URL,
			Source:        item.Source,
			Title:         item.Title,
			PublishedAt:   publishedAt,
			Summary:       item.Summary,
			Category:      item.Category,
			FetchedAt:     item.FetchedAt,
			OGImageURL:    item.OGImageURL,
			OGDescription: item.OGDescription,
		}); err != nil {
			return result, err
		}
		result.ItemsUpserted++
	}

	if len(failures) > 0 {
		return result, fmt.Errorf("news refresh completed with %d source failure(s): %s", len(failures), strings.Join(failures, "; "))
	}
	return result, nil
}

// enrichOG fetches og:image and og:description for each item concurrently.
func enrichOG(ctx context.Context, client *http.Client, items []Item, parallel int, progress io.Writer) {
	sem := make(chan struct{}, parallel)
	var mu sync.Mutex
	var wg sync.WaitGroup

	ogClient := &http.Client{Timeout: 8 * time.Second}
	if client != nil {
		ogClient = &http.Client{Timeout: 8 * time.Second, Transport: client.Transport}
	}

	for i := range items {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			imgURL, desc, err := FetchOGMeta(ctx, ogClient, items[idx].URL)
			if err != nil {
				progressf(progress, "news: og fetch failed %s: %v\n", items[idx].URL, err)
				return
			}
			mu.Lock()
			items[idx].OGImageURL = imgURL
			items[idx].OGDescription = desc
			mu.Unlock()
		}(i)
	}
	wg.Wait()
}

func progressf(w io.Writer, format string, args ...any) {
	if w == nil {
		return
	}
	fmt.Fprintf(w, format, args...)
}

func timePtr(v time.Time) *time.Time {
	if v.IsZero() {
		return nil
	}
	t := v.UTC()
	return &t
}
