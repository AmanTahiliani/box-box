# V1 Scope And Phasing

## Summary

The refactor vision is intentionally broad, but the first shippable milestone
must be narrow. V1 should prove the new architecture without attempting to
finish every screen. The goal is a reliable local-first Race Hub and a cleaner
live foundation, with the existing app kept usable throughout the transition.

## V1 Goal

V1 is done when `box-box` can:

- Ingest one completed race weekend into a local domain database.
- Open a Web Race Hub for that weekend without relying on fresh OpenF1 calls.
- Show honest data availability metadata.
- Continue using the existing live timing capability through an extracted live
  package.
- Preserve the current TUI live mode.

This is the first proof that the app has moved from "OpenF1 page client" to
"local-first F1 command center."

## V1 Product Scope

Included screens:

- Command Center, minimal version.
- Season or Weekend entry path, minimal version.
- Race / Session Hub for completed race sessions.
- Data Library, minimal version showing local dataset status.
- Existing Web Live Timing preserved, with backend live extraction started.

Race Hub v1 data:

- Meeting and session metadata.
- Drivers.
- Final classification.
- Starting grid.
- Laps.
- Stints.
- Pit stops.
- Positions.
- Race control.
- Weather.
- Track outline when available.

Race Hub v1 views:

- Classification.
- Grid delta.
- Strategy chart.
- Position evolution.
- Lap comparison.
- Race-control timeline.
- Weather timeline.
- Dataset status.

## V1 Non-Goals

Not required for v1:

- Full React replacement of every current Web screen.
- Full season backfill as a default workflow.
- Team radio audio playback.
- High-volume car telemetry ingestion by default.
- Full live-session replay from persisted SignalR data.
- Static archive ingestion.
- Browser/system notifications.
- TUI feature parity with the new Web Race Hub.

## TUI Scope

The TUI remains a supported live-session surface, especially because its live
mode is currently one of the strongest parts of the app. New historical,
analytics, and richer navigation work should target the Web UI first.

TUI requirements during v1:

- Continue compiling.
- Continue launching by default with `go run cmd/main.go`.
- Continue supporting live mode after SignalR extraction.
- Do not require Race Hub, Data Library, or React-era feature parity.

## Backend Phase Order

### Phase 1: Live Extraction

- Extract SignalR connection, topic parsing, live state, and live event types
  out of `internal/ui` into a reusable package such as `internal/live`.
- Keep TUI and Web mode consuming the same live package.
- Add fixture-based tests for parser behavior where possible.
- Persist live events/snapshots as a separate append-only stream only after the
  extracted package has stable event/state types.
- See [09 Phase 1 Live Extraction](09-phase-1-live-extraction.md) for the
  original implementation brief.

### Phase 2: Store Foundation

- Add `internal/store`.
- Add schema/migration initialization.
- Add raw payload storage.
- Add ingestion metadata tables.
- Add normalized tables required for Race Hub v1.
- Keep existing HTTP cache behavior unchanged.
- See [10 Phase 2 Store Foundation](10-phase-2-store-foundation.md) for the
  original implementation brief.

### Phase 3: Ingestion Foundation

- Add `internal/ingest`.
- Support session-level and meeting-level ingestion first.
- Add dry-run output.
- Add conservative request delay, bounded retry, and 429/live-lockout handling.
- Make ingestion idempotent and resumable.
- See [11 Phase 3 Ingestion Foundation](11-phase-3-ingestion-foundation.md) for
  the original implementation brief.

### Phase 4: Local-First Web API

- Add local-first read services for Race Hub v1.
- Introduce response metadata for source, freshness, and missing datasets.
- Migrate selected Web endpoints from direct OpenF1 calls to local-first reads.
- Allow small opportunistic fetches only for missing screen-level data.
- See [12 Phase 4 Local-First Web API](12-phase-4-local-first-web-api.md) for
  the original implementation brief.

### Phase 5: React Race Hub Slice

- Add Vite + React + TypeScript frontend foundation.
- Build the Race Hub v1 route and components.
- Use TanStack Query for server data.
- Use D3 for strategy, position evolution, and lap comparison visuals.
- Keep the old Web UI available until the replacement route is credible.
- This is the first frontend phase. Use Claude for this phase.
- See [13 Phase 5 React Race Hub](13-phase-5-react-race-hub.md) for the
  original implementation brief.

## Ingestion Rate-Limit Defaults

All bulk ingestion should be polite by default:

- Sequential requests unless a later test proves safe concurrency.
- Configurable delay between requests.
- Bounded exponential backoff with jitter.
- Stop or pause on HTTP 429.
- Stop or pause on live-session lockout.
- Print enough progress to resume intentionally.
- Never silently launch a full-season backfill from normal Web browsing.

## Acceptance Criteria

V1 acceptance:

- A completed race session can be ingested from OpenF1 into SQLite.
- Re-opening that Race Hub uses local data without fresh OpenF1 calls.
- Missing datasets are visible in the API response and UI.
- API lockout or network failure does not blank a locally ingested Race Hub.
- Existing TUI live mode still works through the extracted live package.
- The Data Library can show the ingested weekend/session and dataset state.

## Follow-Up Phases

After v1:

- Expand ingestion to full seasons.
- Add static archive source if research validates it.
- Add richer live persistence and reconciliation.
- Build full Command Center, Standings, Drivers, and Settings.
- Improve mobile/iPad live layouts.
- Add broader Playwright coverage and visual regression checks.

### Phase 6: React Race Hub Analytics

- Add Race Hub tabs or segmented views.
- Keep classification and grid intact.
- Add Dataset Status, Strategy, and Position Evolution views.
- Use real local-first data where available and honest missing states otherwise.
- Continue frontend work with Claude.

### Phase 7: Analytics Data Foundation

- Return to Cursor for backend work.
- Add local-first store, ingestion, and Race Hub API support for stints,
  positions, and related analytics datasets.
- Keep React Strategy/Position views honest until real data is available.
