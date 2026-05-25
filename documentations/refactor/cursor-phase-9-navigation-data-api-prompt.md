# Prompt For Cursor: Phase 9 Navigation Data API

You are working in the `box-box` repository as the backend engineer for Phase
9. Please keep this phase focused: add local-first navigation APIs so the
frontend can later stop requiring users to know raw `session_key` values.

## Read First

Open these files first:

- `documentations/refactor/17-phase-9-navigation-data-api.md`
- `internal/query/racehub.go`
- `internal/web/racehub.go`
- `internal/web/server.go`
- `internal/store/store.go`
- `internal/store/models.go`
- `internal/store/store_test.go`
- `scripts/seed-e2e-db/main.go`

Only open older planning docs if you need context.

## Goal

Implement local-first Web API read models for season/weekend/session
navigation. These endpoints must read from the SQLite domain database only.
They must not fetch OpenF1 on demand.

## Suggested API Shape

Use boring, stable names unless the codebase suggests a better convention:

- `GET /api/v1/seasons`
  - returns years available in the local domain DB.
- `GET /api/v1/meetings?year=2025`
  - returns locally ingested meetings for that year.
- `GET /api/v1/weekend?meeting_key=1229`
  - returns meeting metadata, sessions, and per-session dataset coverage.

Dataset coverage should reuse the Race Hub dataset vocabulary where practical:

- meeting
- session
- drivers
- results
- starting_grid
- stints
- pit_stops
- positions
- race_control
- weather
- laps

## Implementation Notes

- Add query-layer structs/methods in `internal/query`; keep HTTP handlers thin.
- Add store read methods only where needed.
- Empty DB should return valid empty arrays, not 500s.
- Missing meeting should return a clear 404 from the web handler.
- Add tests against temp SQLite databases.
- If you touch the e2e seed, keep session `9472` as full data and `9000` as
  core-only data.

## Do Not Do

- Do not build the React navigation UI yet.
- Do not add remote OpenF1 calls to these endpoints.
- Do not change the existing Race Hub response shape.
- Do not add live timing persistence in this phase.

## Verification

Run:

```bash
go test ./internal/store/... ./internal/query/... ./internal/web/...
go build -o /private/tmp/box-box ./cmd/main.go
cd frontend && npm test -- --run
cd frontend && npm run build
npm run test:e2e
```

## Report Back

Summarize:

- files changed;
- endpoint shapes added;
- tests run and results;
- follow-up risks or frontend handoff notes.
