# Phase 20 Paddock Briefing Ingestion CLI

## Goal

Turn the Phase 19B RSS backend spike into an explicit local refresh command for
the Paddock Briefing cache. Feed fetching remains a CLI-only operation; web
requests continue to read SQLite only.

## Implemented

- Added `--ingest-news` as a CLI ingestion mode on `cmd/main.go`.
- Reused `--db` path behavior from the existing OpenF1 ingestion flows.
- Reused `--dry-run` to fetch and report feed counts without opening or writing
  the domain database.
- Added `internal/news.Refresh`, which:
  - fetches `internal/news.DefaultSources` unless tests provide a custom list;
  - uses `internal/news.Fetch` with a 10-second HTTP client timeout;
  - upserts `news_sources` with `fetched_at` and `expires_at`;
  - upserts URL-deduped `news_items`;
  - continues after individual source failures and returns a summary error after
    successful sources are stored.

## CLI

```bash
go run ./cmd/main.go --ingest-news
go run ./cmd/main.go --dry-run --ingest-news
go run ./cmd/main.go --ingest-news --db /tmp/boxbox.db
```

`--ingest-news` is mutually exclusive with `--ingest-year`, `--ingest-meeting`,
and `--ingest-session`.

## Verification

Tests use local `httptest.Server` feeds only. No live internet test is required
for the refresh logic.

```bash
go test ./internal/news ./internal/store
```

## Notes

The refresh TTL is currently 30 minutes for all sources. A future phase can add
source-specific TTLs, retention/pruning, or admin UI controls without changing
the read-only `/api/v1/news` contract.
