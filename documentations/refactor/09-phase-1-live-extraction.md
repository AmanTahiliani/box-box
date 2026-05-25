# Phase 1 Live Extraction

## Purpose

Phase 1 creates a stable live timing foundation without changing the product
surface. The current live mode is the strongest part of `box-box`, but the core
SignalR connection and parsing code lives inside `internal/ui`. That creates a
bad dependency direction: the Web server imports TUI code only to access live
data types and `ConnectToF1LiveTiming`.

The goal is to extract the reusable live timing core into `internal/live`, keep
the TUI and Web UI working, and add fixture-based tests around the parsing
surface. This is a foundation phase, not a frontend redesign phase.

## Manager Decision

I agree with Claude that Race Hub is the safest first React product slice.
However, before React work starts, the live timing backend should be separated
from the TUI. The current Web UI already depends on live data through SSE, and
future React live screens will need that source without importing terminal UI
code.

Therefore Phase 1 is:

- Extract the live SignalR bridge into `internal/live`.
- Update TUI live mode to consume `internal/live`.
- Update Web SSE live mode to consume `internal/live`.
- Add tests for live message parsing/state updates.
- Do not add persistence, React, or new UI behavior yet.

## Current Coupling To Remove

Current state:

- `internal/ui/official_live.go` owns SignalR protocol types, live data types,
  topic parsing, connection setup, and TUI rendering.
- `internal/web/live.go` imports `internal/ui` for `ui.LiveStreamData` and
  `ui.ConnectToF1LiveTiming`.

Target state:

- `internal/live` owns reusable live data structures, SignalR protocol parsing,
  connection setup, and state update logic.
- `internal/ui` owns Bubble Tea model state, keyboard behavior, and terminal
  rendering.
- `internal/web` owns SSE clients, HTTP handlers, reconnect/backoff policy, and
  JSON responses.

## Proposed Package Boundary

Add:

```text
internal/live/
  types.go        LiveStreamData, LiveDriverData, weather, race control, tyres
  signalr.go      negotiate/connect/subscribe to official F1 SignalR
  parser.go       raw message parsing and topic dispatch
  state.go        mutable live state accumulator and snapshot copying
  parser_test.go  fixture-driven tests
  testdata/       small captured/synthetic SignalR messages
```

The exact file split can change during implementation, but the boundary should
stay clear: `internal/live` must not import `internal/ui` or Bubble Tea.

## API Shape

Keep a small API compatible with current callers:

```go
package live

type StreamData = LiveStreamData // or a normal exported type if clearer

func ConnectToF1LiveTiming(dataChan chan LiveStreamData) error
```

Optional improvements are allowed only if they stay small and do not force broad
behavior changes:

```go
type Client struct {
    // future room for custom http client, logger, topic list, clock, etc.
}

func (c *Client) Connect(dataChan chan LiveStreamData) error
```

If a `Client` is introduced, preserve the top-level
`ConnectToF1LiveTiming(dataChan)` as a convenience wrapper so TUI and Web changes
remain boring.

## What Moves From `internal/ui/official_live.go`

Move or duplicate-then-delete these reusable concerns into `internal/live`:

- `F1SignalRMessage`
- `F1TimingLine`
- `F1DriverListEntry`
- `LiveTyreData`
- `LiveRCMessage`
- `LiveWeatherData`
- `LiveSessionMeta`
- `LiveSectorData`
- `LiveDriverData`
- `LiveStintData`
- `LiveStreamData`
- `ConnectToF1LiveTiming`
- topic parsing and state accumulation helpers currently embedded in the
  connection goroutine
- snapshot-copying logic used before sending updates

Keep these TUI-specific concerns in `internal/ui/official_live.go`:

- `OfficialLiveModel`
- Bubble Tea messages and commands
- viewport handling
- keybindings
- terminal render functions
- battle/pit-window display logic unless it is already pure and clearly useful
  to share

## Tests

Live sessions are not always available, so Phase 1 tests must not depend on a
current race weekend. Add fixture-based tests in `internal/live`.

Minimum test coverage:

- Parse a SignalR `R` full-state message.
- Parse a SignalR `M` incremental update message.
- Handle known topics without panicking:
  - `TimingData`
  - `DriverList`
  - `LapCount`
  - `ExtrapolatedClock`
  - `TrackStatus`
  - `RaceControlMessages`
  - `WeatherData`
  - `SessionInfo`
  - `CurrentTyres`
  - `TimingAppData`
  - `TimingStats`
- Preserve existing string/float/nested-value handling in timing fields.
- Ignore unknown topics without failing.
- Verify snapshots copy maps/slices so downstream consumers cannot mutate
  internal accumulator state accidentally.

Fixtures can be small synthetic messages shaped like the official feed. They do
not need to be full captured race payloads.

## Acceptance Criteria

Phase 1 is complete when:

- `internal/web/live.go` no longer imports `internal/ui`.
- `internal/ui/official_live.go` compiles while consuming `internal/live`.
- The existing TUI live mode still uses the official F1 SignalR feed.
- The existing Web live SSE path still uses the official F1 SignalR feed.
- `go test ./...` passes.
- Parser tests run without internet access.
- No local database, React, or visual redesign work has been started as part of
  this phase.

## Non-Goals

Do not include these in Phase 1:

- React/Vite frontend setup.
- SQLite domain database or migrations.
- OpenF1 ingestion refactor.
- Live event persistence.
- Race Hub implementation.
- Static archive research.
- Browser notification work.
- Major rewrite of TUI live rendering.

## Risks And Guardrails

- The live parser currently works in practice; avoid clever rewrites that change
  behavior without tests.
- Official F1 SignalR topic schemas can drift. Keep parsing tolerant of missing,
  empty, string, numeric, and nested values.
- Do not make Web reconnect/backoff policy part of `internal/live` yet. The Web
  server can keep owning that operational behavior.
- Do not make the TUI import Web code. Shared logic should flow through
  `internal/live`.
- Preserve existing logs and user-facing behavior unless a small compile-time
  adjustment requires otherwise.

## Next Phase After This

After Phase 1, Phase 2 should start `internal/store` and the local SQLite domain
database. Live persistence should still wait until the live data/event types have
settled and the database provenance design is ready.
