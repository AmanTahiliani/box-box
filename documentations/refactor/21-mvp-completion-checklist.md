# MVP Completion Checklist

## Status

The local-first Web UI MVP is now functionally assembled. The app can ingest
OpenF1 data into the SQLite domain store, serve local-first Race Hub and
navigation APIs, render the React Race Hub/Data Library/Live Timing routes, and
serve the built React app from Go web mode when `frontend/dist` is present.

This document replaces the temporary agent handoff prompts as the main
checkpoint for what has been completed and what remains.

## Completed

- Live SignalR code extracted into `internal/live` and reused by TUI and Web
  mode.
- SQLite domain store added for local historical data.
- Session, meeting, and weekend ingestion paths added with dry-run support.
- Optional analytics ingestion failures are partial, not hard blockers.
- Local-first Race Hub API added with dataset availability metadata.
- Local-first season, meeting, and weekend navigation APIs added.
- React + TypeScript frontend added with TanStack Query and Router.
- Race Hub route added for classification, grid, strategy, positions, laps,
  race control, weather, and dataset status.
- Admin / Data Health route added for local season/weekend coverage and CLI
  guidance; `/data-library` remains a legacy alias.
- Live Timing route added for current backend live snapshot/SSE state.
- Go web mode serves the built React app from `frontend/dist` and falls back to
  embedded legacy assets when no build is present.

## Verification Commands

Run these before cutting an MVP tag or handing the repo to another agent:

```bash
go test ./internal/live ./internal/models ./internal/store ./internal/ingest ./internal/query ./internal/web
npm --prefix frontend test -- --run
npm --prefix frontend run build
npm run test:e2e
npm run test:e2e:prod
npm run test:visual
npm run test:visual:prod
```

### Dev proxy smoke (Vite + Go API)

For a local manual smoke test with the Vite dev server proxying API calls:

```bash
go run ./scripts/seed-e2e-db/main.go --db /tmp/boxbox-mvp.db
BOXBOX_DISABLE_LIVE=1 go run ./cmd/main.go --web --db /tmp/boxbox-mvp.db --port 18080
BOXBOX_API_PORT=18080 npm run dev --prefix frontend -- --host 127.0.0.1 --port 15173 --strictPort
```

Then open:

- `http://127.0.0.1:15173/race-hub?session_key=9472`
- `http://127.0.0.1:15173/admin`
- `http://127.0.0.1:15173/data-library` (legacy alias)
- `http://127.0.0.1:15173/live`

### Production web smoke (Go serves built React)

Verify the same routes when Go serves `frontend/dist` directly (no Vite):

```bash
npm --prefix frontend run build
go run ./scripts/seed-e2e-db/main.go --db /tmp/boxbox-mvp.db
BOXBOX_DISABLE_LIVE=1 go run ./cmd/main.go --web --db /tmp/boxbox-mvp.db --port 18080
```

Then open:

- `http://127.0.0.1:18080/race-hub?session_key=9472`
- `http://127.0.0.1:18080/admin`
- `http://127.0.0.1:18080/data-library` (legacy alias)
- `http://127.0.0.1:18080/live`

Automated production-serving coverage:

```bash
npm run test:e2e:prod
```

This runs `playwright.prod.config.ts`, which builds the frontend, seeds
`.playwright/boxbox-prod-e2e.db`, starts Go web mode on port 18080, and
exercises Race Hub, Data Library, Live empty state, and nav links against the
built SPA.

### Visual regression (Playwright screenshots)

Screenshot baselines for Race Hub, Data Library, and Live (disabled-live empty
state) at desktop, tablet, and mobile viewports:

```bash
npm run test:visual
npm run test:visual:prod
```

Refresh baselines after intentional UI changes:

```bash
npm run test:visual:update
npm run test:visual:prod:update
```

Snapshots are stored under `tests/visual/__snapshots__/`. See
[22 Phase 14 Visual Regression](22-phase-14-visual-regression.md).

## Remaining Post-MVP Work
- Improve high-density mobile/iPad behavior for Live Timing and Race Hub tables.
- Add persisted live-event capture and reconciliation only after defining the
  live storage model.
- Add track outline ingestion/read models to the React app if the local data
  source is reliable enough.
- Expand from weekend/session ingestion toward safe full-season backfill.
- Add Drivers, Standings, and Settings as separate product phases.
- Revisit static archive feasibility after source mapping is proven.

## Notes

- `--ingest-year` currently discovers season meetings and sessions. Use
  `--ingest-meeting <meeting_key>` for full weekend ingestion.
- The React app should continue avoiding direct OpenF1 reads. New Web UI routes
  should call local-first Go APIs.
- The TUI live mode remains intentionally preserved. Historical Web UI parity
  with the TUI is not required for this MVP.
