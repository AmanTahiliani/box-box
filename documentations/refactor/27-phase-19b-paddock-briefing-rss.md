# Phase 19B Paddock Briefing RSS Backend Spike

## Goal

Prototype the backend foundation for a future fan-facing Paddock Briefing module
without scraping article pages or touching Race Hub UI. The spike keeps news as a
local-first cache: feeds can be fetched and normalized by backend code, stored in
SQLite, and read through a small API shape.

## Source Evaluation

Recommended first-party or publisher-owned feeds:

- FIA official RSS, `https://www.fia.com/rss/news`: keep as the official source
  for federation announcements and regulatory context.
- BBC Sport F1, `https://feeds.bbci.co.uk/sport/formula1`: strong free headline
  source for UK-centered coverage.
- Autosport F1, `https://www.autosport.com/rss/f1/news/`: useful motorsport
  specialist feed; retain summaries only when provided by the feed.
- RaceFans F1, `https://www.racefans.net/category/f1-news/feed/`: useful
  independent specialist feed with a clean WordPress RSS surface.
- Guardian Formula One,
  `https://www.theguardian.com/sport/formulaone/rss`: broad editorial coverage
  and stable RSS conventions.

Optional sources to evaluate before shipping:

- RACER F1, `https://racer.com/f1/feed`: reasonable supplemental specialist
  feed.
- Formula 1 YouTube Atom,
  `https://www.youtube.com/feeds/videos.xml?channel_id=UCB_qr75-ydFVKSF9Dmo6izg`:
  video-only briefing cards, separate from article news.
- Motorsport.com F1, `https://www.motorsport.com/rss/f1/news/`: not included in
  the default prototype list until terms and caching expectations are reviewed.

Avoid Formula1.com scraping or hidden endpoints, X/Twitter scraping, Reddit as a
primary news source, and feed aggregator products such as RSS.app or Feedspot.

## Legal And Product Caveats

Only fetch publisher-provided RSS/Atom XML. Do not fetch article bodies, bypass
paywalls, scrape Open Graph metadata, or store full article content. The product
surface should show source, title, canonical URL, publish time, category, and a
short feed-provided summary/snippet when available. Each card should link users
to the publisher site for the article.

Before enabling a source by default, review the publisher feed terms, robots/TOS
language around caching, and whether feed summaries are intended for display.
Keep TTLs conservative and make source attribution visible in the UI.

## Implemented Proof

This spike adds:

- `internal/news`: a standard-library RSS/Atom parser and polite fetch helper
  with a 10-second default timeout and a box-box User-Agent.
- URL-based deduplication with UTM parameter stripping.
- `news_sources` and `news_items` tables in SQLite migration `003_news.sql`.
- Store/query methods for upserting cached feed metadata/items and listing
  newest cached items.
- `GET /api/v1/news`, with optional `limit` and `source` query params.
- Unit tests using local XML fixtures only.

The endpoint is intentionally read-only against the local SQLite cache. It does
not fetch feeds during web requests, avoiding unexpected network work in the
product UI path. A later ingestion command can call `internal/news.Fetch`, upsert
sources/items, and mark `fetched_at`/`expires_at` according to a TTL policy.

## API Shape

`GET /api/v1/news?limit=25&source=racefans-f1`

Response:

```json
[
  {
    "source": "racefans-f1",
    "title": "Example headline",
    "url": "https://publisher.example/story",
    "published_at": "2026-05-25T14:00:00Z",
    "summary": "Feed-provided snippet",
    "category": "news",
    "fetched_at": "2026-05-25T14:10:00Z"
  }
]
```

Default limit is 25; maximum accepted limit is 100.

## Follow-Up Frontend Plan

Add a Paddock Briefing surface outside Race Hub while Race Hub redesign work is
active. Recommended first UI slice:

- Query `/api/v1/news?limit=12`.
- Group by recency with source badges and external-link treatment.
- Show snippets only when present, with clear publisher attribution.
- Add source filters after the cache refresh command exists.
- Treat video feed items as a separate rail or filter, not mixed into hard-news
  headlines by default.

## Open Questions

- Should news refresh live behind an explicit CLI command, opportunistic startup
  refresh, or a manual button in an admin/data-health screen?
- What default TTL should each source use? A 15-30 minute TTL is reasonable for
  race weekends; longer may be enough outside live sessions.
- Should the cache keep historical briefing items indefinitely, or prune after a
  rolling window such as 30-90 days?
