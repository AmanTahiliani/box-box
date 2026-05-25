# Cursor Prompt: Phase 4 Local-First Web API

You are working in the `box-box` repository.

Phases 1-3 are complete:

- `internal/live` owns shared live timing.
- `internal/store` owns the SQLite domain DB.
- `internal/ingest` can ingest initial OpenF1 data into the store.

Your task is Phase 4: add local-first backend read models and Web API support.
This is still a backend phase. Do not start the React/frontend implementation.

## Read First

Read these files before editing:

- `CLAUDE.md`
- `documentations/refactor/08-v1-scope-and-phasing.md`
- `documentations/refactor/12-phase-4-local-first-web-api.md`
- `internal/store/*`
- `internal/ingest/*`
- `internal/web/server.go`
- `internal/web/api.go`
- `cmd/main.go`

## Goal

Expose a store-backed Race Hub API that can return ingested data without making
fresh OpenF1 calls. Missing datasets must be explicit in response metadata.

## Required Work

1. Add a read-model layer, preferably `internal/query`.
2. Implement a Race Hub read model for a single `session_key`.
3. Include:
   - meeting;
   - session;
   - drivers;
   - session results enriched with driver/team fields;
   - starting grid enriched with driver/team fields;
   - dataset availability metadata.
4. Add a Web endpoint:

   ```text
   GET /api/v1/race-hub?session_key=9472
   ```

5. Wire Web mode to optionally open the domain DB:

   ```bash
   go run cmd/main.go --web --db /path/to/boxbox.db
   ```

6. Web mode must still start when the DB is absent or empty.
7. Add offline tests using temp SQLite stores.
8. Preserve existing TUI and live behavior.

## Optional Work

If straightforward, make these existing endpoints support local-first reads:

- `/api/v1/meetings`
- `/api/v1/sessions`
- `/api/v1/drivers`
- `/api/v1/results`
- `/api/v1/grid`

Use query controls such as:

```text
?source=local
?source=auto
```

Do not break the current OpenF1-backed behavior of existing endpoints.

## Guardrails

- Do not add React, Vite, TanStack, or frontend app code.
- Do not trigger ingestion from normal Web browsing.
- Do not persist SignalR live data.
- Do not rewrite every API endpoint.
- Do not add laps/stints/pits/weather/race-control read models unless you also
  add tested store tables for them.
- Keep tests offline.

## Testing

Run:

```bash
go test ./internal/query/... ./internal/web/... ./internal/store/...
go build -o /tmp/box-box ./cmd/main.go
go test ./...
```

If `go test ./...` fails only because existing `internal/api` integration tests
cannot reach OpenF1, report that separately as unrelated.

## Final Response

Report:

- packages/files changed;
- endpoint(s) added;
- response metadata shape;
- tests run and results;
- any known limitations;
- whether Phase 5 can begin frontend work.
