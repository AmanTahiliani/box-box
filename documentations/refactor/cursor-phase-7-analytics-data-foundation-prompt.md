# Cursor Prompt: Phase 7 Analytics Data Foundation

You are working in the `box-box` repository.

Phase 6 added React Race Hub analytics tabs, but Strategy and Position Evolution
still show honest missing states because the backend does not expose stints or
position samples in `/api/v1/race-hub`.

Your task is Phase 7: expand the local-first backend data foundation for Race
Hub analytics.

## Read First

- `CLAUDE.md`
- `documentations/refactor/15-phase-7-analytics-data-foundation.md`
- `internal/store/*`
- `internal/ingest/*`
- `internal/query/racehub.go`
- `internal/api/openf1.go`
- `internal/models/types.go`
- `frontend/src/components/StrategyView.tsx`
- `frontend/src/components/PositionEvolutionView.tsx`

## Goal

Add backend support for the datasets needed by strategy and position views,
prioritizing stints and positions.

## Required Work

1. Add a new SQLite migration for selected analytics tables.
2. Add store structs, upserts, and reads.
3. Extend session ingestion to fetch and store:
   - stints;
   - pit stops if straightforward;
   - positions if volume is acceptable;
   - race control and weather if scoped cleanly.
4. Store raw payloads for every fetched endpoint.
5. Extend `internal/query.RaceHub` with available analytics datasets.
6. Update dataset metadata counts.
7. Add offline tests with fake OpenF1 source data.

## Guardrails

- Do not fake frontend data.
- Do not fetch OpenF1 from React.
- Do not add high-volume car telemetry.
- Keep migrations idempotent.
- Keep existing Phase 5/6 React behavior working.

## Verification

Run:

```bash
go test ./internal/store/... ./internal/ingest/... ./internal/query/... ./internal/web/...
go build -o /tmp/box-box ./cmd/main.go
cd frontend && npm test -- --run && npm run build
```

If `go test ./...` fails only on OpenF1 network integration tests, report it as
unrelated.

## Final Response

Report:

- tables added;
- datasets ingested;
- Race Hub API fields added;
- tests/builds run;
- whether frontend Strategy/Position tabs now have real data available.
