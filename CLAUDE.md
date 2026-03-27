# CLAUDE.md

## Commands

```bash
go build -o box-box ./cmd/main.go   # Build binary
go run cmd/main.go                   # Run directly
go test ./...                        # All tests
go test -v ./internal/api            # API integration tests (requires internet, rate-limit aware)
OPENF1_API_KEY=key go run cmd/main.go  # Run with paid tier (enables live session access)
```

## Project Overview

**box-box** is an F1 Terminal UI (TUI) dashboard built in Go with Bubble Tea. It shows live timing, standings, race calendar, driver telemetry, track maps, and race replay — all sourced from the OpenF1 API.

**Status**: Pre-beta, actively developed. All layers (API, models, UI) are fully implemented.

## Tech Stack

- **Bubble Tea** — TUI framework (Elm architecture: Model -> Update -> View)
- **Lipgloss** — Terminal styling
- **Bubbles** — TUI components (spinner, viewport, table)
- **OpenF1 API** — F1 data at `https://api.openf1.org`
- **gorilla/websocket** — Official F1 SignalR live feed
- **modernc.org/sqlite** — HTTP response caching with TTL

## File Map

```
cmd/main.go                  Entry point (package main). Inits client, launches TUI.

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
```

## Architecture

### Bubble Tea Pattern

Each tab is a sub-model with `Init()`, `Update(msg)`, `View()`. The root `AppModel` in `app.go` holds all sub-models and routes messages by type. All state changes are message-driven — no direct mutation.

Async work (API calls, WebSocket) returns `tea.Cmd` that emits typed messages back to Update. Use `tea.Batch()` for parallel fetches.

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

## Testing

Tests in `openf1_test.go` hit the real OpenF1 API. They use `skipOnRateLimit(t, err)` to gracefully skip on HTTP 429. Require internet.

## Environment

- `OPENF1_API_KEY` — Optional Bearer token for paid tier (live session WebSocket access)
- Logs go to `box-box.log` in project root (prevents TUI pollution)
- Cache at `~/.cache/box-box/cache.db` (SQLite WAL mode, auto-created)
