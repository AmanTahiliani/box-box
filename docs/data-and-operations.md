# Data and Operations

## Data Flow

| Layer | Role |
| --- | --- |
| OpenF1 REST | Backfill and ingestion source; optional paid tier via `OPENF1_API_KEY`. Also powers the TUI's on-demand reads and HTTP cache. |
| Domain SQLite (`boxbox.db`) | Local store for meetings, sessions, Race Hub datasets, and navigation APIs used by the Web UI. |
| HTTP cache SQLite (`cache.db`) | TTL cache for OpenF1 responses used by the TUI and legacy paths. Separate from the domain DB. |
| Official F1 SignalR | Live timing bridge in `internal/live`, exposed to Web via SSE and to the TUI. |
| Go server | `cmd/main.go`: TUI, `--web` API + static SPA, or CLI ingestion. |
| React frontend | `frontend/`: production build served from `frontend/dist` when present. |

The Web UI should call local-first Go APIs under `/api/v1/...`; do not add direct OpenF1 reads in the frontend.

## Ingest Historical Data and Briefing Feeds

Ingestion is a CLI mode on the same binary. Only one of `--ingest-year`, `--ingest-meeting`, `--ingest-session`, or `--ingest-news` may be set per run.

```bash
# Season: discover and store meeting metadata for 2023+
go run ./cmd/main.go --ingest-year 2025

# Full race weekend: all sessions + Race Hub datasets
go run ./cmd/main.go --ingest-meeting 1229

# Single session only
go run ./cmd/main.go --ingest-session 9472

# Preview without writing
go run ./cmd/main.go --dry-run --ingest-meeting 1229

# Refresh Paddock Briefing RSS/Atom feeds
go run ./cmd/main.go --ingest-news

# Custom DB path
go run ./cmd/main.go --ingest-meeting 1229 --db /tmp/boxbox.db
```

Use `--ingest-meeting` for a complete weekend. `--ingest-year` stores season meetings, not full session datasets. Optional analytics fetches may partially fail without aborting the whole run.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENF1_API_KEY` | Optional Bearer token for paid OpenF1 behavior. |
| `BOXBOX_DISABLE_LIVE=1` | Skip the background SignalR live feed in web mode. Used by CI and local seeded UI work. |
| `BOXBOX_OPENF1_BASE_URL` | Override the OpenF1 API root. Defaults to `https://api.openf1.org`. |
| `BOXBOX_API_PORT` | Go API port used by the Vite dev proxy. Defaults to `8080`. |

Example:

```bash
export OPENF1_API_KEY=your_key_here
go run ./cmd/main.go --web
```

## Local Files

| Path | Purpose |
| --- | --- |
| `~/.local/share/box-box/boxbox.db` | Domain database, default `--db`. |
| `~/.cache/box-box/cache.db` | OpenF1 HTTP response cache for the TUI and client. |
| `box-box.log` | TUI application log in the project root. |
| `frontend/dist/` | Production React build. Generated output, do not commit. |
| `.playwright/*.db` | Seeded databases for automated tests. |

Web mode logs to stderr.

## Known Limitations

- Live timing only works when F1 is broadcasting timing data; there is no guaranteed live session for local development.
- E2E and visual tests use `BOXBOX_DISABLE_LIVE=1` and seeded SQLite, so they do not exercise full SignalR live behavior.
- `frontend/dist` is generated output; build before production web mode or `test:e2e:prod`.
- TUI historical views still use OpenF1 on demand with the HTTP cache; the Web UI's local-first model does not fully replace the TUI yet.
