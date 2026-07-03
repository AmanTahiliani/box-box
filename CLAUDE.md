# CLAUDE.md

## Commands

```bash
go build -o box-box ./cmd/main.go    # Build binary
go run cmd/main.go                   # Run TUI
go run cmd/main.go --web --port 8080 # Run web server (default port 8080)
go run cmd/main.go --ingest-year 2025  # Ingest a season into the domain DB (also: --ingest-meeting, --ingest-session, --ingest-news, --coverage)
go test ./...                        # All Go tests
go test -v ./internal/api            # API integration tests (requires internet, rate-limit aware)
OPENF1_API_KEY=key go run cmd/main.go  # Run with paid tier (enables live session access)

# Frontend (run inside frontend/)
npm run dev                          # Vite dev server on :5173, proxies /api to :8080 (override with BOXBOX_API_PORT)
npm run build                        # tsc --noEmit && vite build -> frontend/dist
npm run test                         # Vitest unit tests (frontend/src/test/); npm run test:watch for watch mode

# E2E / visual (run at repo root; Playwright auto-starts a seeded Go server + Vite dev server)
npm run test:e2e                     # Playwright e2e (tests/*.spec.ts, playwright.config.ts)
npm run test:visual                  # Visual snapshots (tests/visual/, playwright.visual.config.ts)
npm run test:visual:update           # Regenerate visual snapshots
# :prod variants (test:e2e:prod, test:visual:prod) run against the *.prod.config.ts configs
```

## Project Overview

**box-box** is an F1 dashboard in Go with two frontends sharing the same data layer: a Bubble Tea TUI and a web app (`--web` flag) — a Go HTTP server in `internal/web/` serving a React SPA plus a REST/SSE API. It shows live timing, standings, race calendar, driver telemetry, track maps, and race replay — sourced from the OpenF1 API and a local domain SQLite DB filled by the ingestion CLI.

**Status**: Pre-beta, actively developed.

## Tech Stack

- **Bubble Tea** — TUI framework (Elm architecture: Model -> Update -> View)
- **Lipgloss** — Terminal styling
- **Bubbles** — TUI components (spinner, viewport, table)
- **OpenF1 API** — F1 data at `https://api.openf1.org`
- **gorilla/websocket** — Official F1 SignalR live feed
- **modernc.org/sqlite** — HTTP response cache + domain DB
- **React 18 + Vite + TypeScript** — Web frontend (`frontend/`), TanStack Router + TanStack Query
- **Vitest + Testing Library** — Frontend unit tests; **Playwright** — e2e and visual tests (repo root)

## File Map

```
cmd/main.go                  Entry point. Flags: --web/--port (web server), --ingest-* /
                             --backfill-season/--coverage (ingestion CLI), --db. Default: TUI.

internal/api/
  client.go                  OpenF1Client: HTTP client, 15s timeout, optional Bearer auth
  cache.go                   SQLite cache (~/.cache/box-box/cache.db), TTL-based, stale fallback
  openf1.go                  37 API endpoint methods
  openf1_test.go             Integration tests (real API, rate-limit skip)

internal/models/
  types.go                   All data structs (Meeting, Session, Driver, Lap, Stint, etc.)

internal/ui/
  app.go                     Root AppModel. 7 tabs, message routing, splash screen
  messages.go                All tea.Msg types for async data loading
  styles.go                  Lipgloss styles, F1 color palette, team colors
  keys.go                    key.Binding definitions for all keybindings
  util.go                    Helpers: formatSeconds, sparkline, matchKey, country flags
  dashboard.go               Tab 0: Next race countdown + session schedule
  standings.go               Tab 1: Driver/constructor championship tables
  calendar.go                Tab 2: Season meeting list, select -> race detail
  racedetail.go              Tab 3: Session results, grid, sectors, RC, weather, overtakes
  driver.go                  Tab 4: Driver list + per-driver telemetry (stints, laps, pits)
  official_live.go           Tab 5: Real-time timing via F1 SignalR WebSocket
  live.go                    Legacy/alternate live timing implementation
  trackmap.go                Tab 6: ASCII track outline with live car positions
  battles.go                 Sub-view: Auto-detected on-track battles with gap sparkline
  pitwindow.go               Sub-view: Pit stop rejoin position calculator
  replay.go                  Sub-view: Lap-by-lap race replay scrubber

internal/store/              Domain SQLite DB (~/.local/share/box-box/boxbox.db), season/session data
internal/ingest/             OpenF1 -> domain DB ingestion (driven by cmd/main.go --ingest-* flags)
internal/query/              Read models over the domain DB, used by web handlers
internal/news/               RSS/Atom paddock briefing feed ingestion (--ingest-news)
internal/live/               Shared F1 SignalR live feed client + LiveStreamData types

internal/web/
  server.go                  HTTP server: route table, CORS/logging middleware, SPA file server.
                             Serves frontend/dist if found (walks up from cwd), else embedded assets/
  api.go                     REST handlers under /api/v1/ (results, laps, telemetry, championship
                             hub aggregation, news + readability article extraction, ...)
  live.go                    SSEHub + SignalR bridge: relays official F1 feed to SSE subscribers
  racehub.go                 /api/v1/race-hub: per-session payload assembled from the domain DB
  navigation.go              Local-first navigation: /api/v1/seasons, meetings, sessions, weekend
  source.go                  ?source=openf1|local|auto data-source resolution
  assets/                    Embedded fallback SPA (legacy vanilla JS; used when no frontend/dist)

frontend/                    React + Vite + TypeScript SPA
  src/main.tsx               Entry: QueryClientProvider + RouterProvider
  src/router.tsx             TanStack Router: / (command center), /race-hub, /live, /championship,
                             /briefing, /data-library (also /admin alias)
  src/api.ts                 Typed fetch wrappers for /api/v1/ endpoints
  src/types.ts               TypeScript mirrors of API payloads
  src/pages/                 CommandCenterPage, RaceHubPage, LiveTimingPage, ChampionshipPage,
                             BriefingPage, DataLibraryPage
  src/components/            Shared components (Nav, TabBar, race hub views, live/ timing tower)
  src/lib/                   Client helpers: live SSE parsing, schedule, coverage, GP identity
  src/test/                  Vitest + Testing Library unit tests

tests/                       Playwright e2e specs; tests/visual/ visual snapshot specs
playwright*.config.ts        Dev/prod e2e + visual configs (webServer blocks seed a temp domain DB
                             and start Go API + Vite automatically)
scripts/seed-e2e-db/         Seeds the throwaway domain DB used by Playwright runs
```

## Architecture

### Bubble Tea Pattern

Each tab is a sub-model with `Init()`, `Update(msg)`, `View()`. The root `AppModel` in `app.go` holds all sub-models and routes messages by type. All state changes are message-driven — no direct mutation.

Async work (API calls, WebSocket) returns `tea.Cmd` that emits typed messages back to Update. Use `tea.Batch()` for parallel fetches.

### Web Layer

`box-box --web` starts an HTTP server (default `:8080`) with three surfaces:

- **REST API at `/api/v1/...`** — Handlers in `internal/web/api.go` wrap `OpenF1Client`; navigation/race-hub endpoints read the domain DB via `internal/query` (empty responses if the DB is missing). `?source=openf1|local|auto` picks the data source where supported. Register routes in `routes()` in `server.go` — Go ServeMux longest-prefix matching means more specific paths (e.g. `/api/v1/laps/comparison`) must be registered before their prefixes.
- **SSE live stream** — `internal/web/live.go` runs a background SignalR connection to the official F1 feed (exponential-backoff reconnect; disabled with `BOXBOX_DISABLE_LIVE=1`). An `SSEHub` broadcasts snapshots to browsers on `/api/v1/live/stream`, with `/api/v1/live/state` for the initial snapshot and a 20s heartbeat. `LiveTimingPage.tsx` consumes it; parsing helpers live in `frontend/src/lib/live.ts`.
- **Embedded SPA** — Static file server with SPA fallback to `index.html`. Prefers a `frontend/dist` directory found by walking up from cwd (so `npm run build` output is served without rebuilding Go); otherwise serves the legacy assets embedded via `//go:embed assets`.
- **Championship hub** — `/api/v1/championship/hub` aggregates official standings with derived stats (wins, podiums, poles, last-5 form, teammate head-to-head) and per-round cumulative points, computed from all season race results.

Frontend dev loop: run `go run cmd/main.go --web` and `npm run dev` in `frontend/` — Vite proxies `/api` to the Go server.

### Key Patterns

- **Two-phase standings load**: `GetLatestDriverChampionship()` -> extract SessionKey -> `GetDriversForSession(sessionKey)` -> join by DriverNumber for names/colors
- **Driver tab lazy load**: Drivers loaded on first Tab 4 focus via `TriggerLoad()`
- **Stale data fallback**: When API errors, client returns expired cache data + sets atomic flag for UI disclaimer banner
- **Cache TTL tiers**: 15min (live telemetry), 1hr (standings), 24hr (recent), forever (historical 2023/2024)
- **Track outline pre-fetch**: Background fetch of circuit GPS data during app init
- **`matchKey` helper**: Renamed from `key` to avoid collision with `bubbles/key` package import

### Keybindings

Global: `1-7` tabs, `tab`/`shift+tab` cycle, `j/k` navigate, `enter` select, `b`/`esc` back, `y` cycle year, `g`/`G` top/bottom, `ctrl+u`/`ctrl+d` half-page, `q` quit

Standings: `d` driver view, `c` constructor view

Race Detail: `[`/`]` prev/next session, `r` replay mode, `K`/`J` scroll RC

Live: `s` sectors, `r` race control, `b` battles, `p` pit window, `K`/`J` scroll RC

Replay: `h`/`l` or arrows scrub laps

### API Endpoint Groups

- **Season**: `GetMeetingsForYear`, `GetSessionsForMeeting`
- **Championship**: `GetDriverChampionshipForYear`, `GetTeamChampionshipForYear`, `GetLatest*`
- **Results**: `GetSessionResult`, `GetStartingGrid`, `GetStintsForSession`
- **Telemetry**: `GetLapsForDriver`, `GetPitStopsForSession`, `GetPositions`, `GetIntervals`
- **Live**: `GetCarData`, `GetLocation` (GPS), `GetTeamRadio`
- **Events**: `GetRaceControl`, `GetOvertakes`, `GetWeather`
- **Track**: `PrefetchTrackOutlines`

## How To Extend

- **New tab**: Create model in `internal/ui/`, add to `AppModel` struct in `app.go`, add tab constant, implement `Init/Update/View`, handle message routing in `app.go Update()`
- **New API endpoint**: Add method to `openf1.go`, add response struct to `types.go`, set cache TTL in the method
- **New message type**: Define in `messages.go`, handle in relevant model's `Update()`
- **New keybinding**: Define in `keys.go`, handle in relevant model's `Update()`
- **New styles**: Add to `styles.go`, reference F1 palette constants
- **New web page/route**: Create page in `frontend/src/pages/`, register route in `frontend/src/router.tsx`, add nav link in `frontend/src/components/Nav.tsx`, add fetchers to `src/api.ts` and payload types to `src/types.ts`, add a test in `frontend/src/test/`
- **New web API endpoint**: Add handler in `internal/web/api.go` (or a new file in `internal/web/`), register it in `routes()` in `server.go` (mind prefix ordering), add a handler test alongside (see `championship_hub_test.go`)

## Testing

- Go: tests in `openf1_test.go` hit the real OpenF1 API and use `skipOnRateLimit(t, err)` to skip on HTTP 429 (require internet). `internal/web` handler tests run offline.
- Frontend: Vitest + Testing Library in `frontend/src/test/` (`npm run test` inside `frontend/`).
- E2E/visual: Playwright at repo root (`npm run test:e2e`, `npm run test:visual`). Configs seed a temp domain DB and start the Go server with `BOXBOX_DISABLE_LIVE=1` plus a Vite dev server — no manual setup needed.

## Environment

- `OPENF1_API_KEY` — Optional Bearer token for paid tier (live session WebSocket access)
- `BOXBOX_DISABLE_LIVE=1` — Skip the background SignalR live feed in web mode (used by e2e)
- `BOXBOX_API_PORT` — Go API port that the Vite dev proxy targets (default 8080)
- Logs: TUI writes `box-box.log` in project root; web/ingest modes log to stderr
- HTTP cache at `~/.cache/box-box/cache.db`; domain DB at `~/.local/share/box-box/boxbox.db` (override with `--db`)
