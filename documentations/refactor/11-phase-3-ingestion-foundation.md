# Phase 3 Ingestion Foundation

## Purpose

Phase 3 connects OpenF1 REST data to the local domain store introduced in Phase
2. The goal is to ingest a meeting or session intentionally, record provenance,
write raw payloads, normalize the initial Race Hub datasets, and make the work
idempotent and resumable.

This phase should still avoid Web UI replacement work. It creates the backend
path that later Race Hub APIs and React screens can trust.

## Manager Decision

Build ingestion as an explicit backend workflow first, not as an automatic Web
side effect. Normal browsing must not accidentally trigger a full weekend
backfill or burn through API quota.

Phase 3 should add:

- `internal/ingest` orchestration.
- OpenF1 source-to-store mapping for the Phase 2 tables.
- A small CLI command path for manual ingestion.
- Dry-run and progress output.
- conservative retry/rate-limit behavior.

## Package Boundary

Add:

```text
internal/ingest/
  ingest.go        orchestrator, options, result summary
  openf1.go        OpenF1 source adapter and model mapping
  progress.go      progress event/output helpers if useful
  ingest_test.go   fake-source/fake-store or temp-db tests
```

The package should depend on:

- `internal/api` for OpenF1 reads;
- `internal/store` for writes;
- `internal/models` for current OpenF1 response structs.

It should not depend on:

- `internal/ui`;
- `internal/web`;
- React/frontend code.

## Initial Ingestion Scope

Support these commands/workflows first:

- ingest meetings for a year;
- ingest sessions for a meeting;
- ingest a single session's Race Hub v1 datasets.

For a race session, ingest:

- meeting metadata when available;
- session metadata;
- drivers;
- session result;
- starting grid;
- raw payload records for each fetched endpoint.

If Cursor chooses to include laps, stints, pits, race control, or weather, the
store schema must support them first. Otherwise leave those datasets for Phase
4 or a Phase 3 follow-up. Do not jam JSON blobs into unrelated tables just to
claim coverage.

## CLI Shape

Extend `cmd/main.go` conservatively. Keep the default TUI and `--web` behavior
unchanged.

Recommended flags:

```bash
go run cmd/main.go --ingest-year 2025
go run cmd/main.go --ingest-meeting 1229
go run cmd/main.go --ingest-session 9472
go run cmd/main.go --ingest-session 9472 --dry-run
go run cmd/main.go --ingest-session 9472 --db /path/to/boxbox.db
```

This is acceptable as a first CLI slice. A richer subcommand framework can wait.

## Ingestion Behavior

Defaults:

- sequential requests;
- small delay between endpoint calls;
- bounded retry for transient failures;
- stop cleanly on OpenF1 live-session lockout;
- no silent full-season backfills;
- print progress and final summary;
- write raw payload provenance for each endpoint;
- upsert normalized records so reruns are safe.

## Raw Payload Provenance

Each fetched endpoint should record:

- source: `openf1`;
- endpoint name;
- request key;
- meeting key when known;
- session key when known;
- fetched timestamp;
- raw JSON payload;
- HTTP/API provenance when available;
- whether data came from stale cache if that signal is available.

If the current API client does not expose raw JSON easily, prefer a small source
adapter enhancement over duplicating HTTP logic wildly. Keep existing cache
behavior intact.

## Tests

Tests should avoid real network calls.

Minimum tests:

- ingesting a fake session writes drivers, results, grid rows, and raw payloads;
- rerunning the same ingestion does not duplicate normalized rows;
- dry-run does not write domain rows;
- source errors stop the run and record/report failure;
- live-session lockout is surfaced as a controlled failure;
- CLI flag parsing does not break default TUI/Web behavior if covered cheaply.

## Non-Goals

Do not include these in Phase 3:

- React/Vite frontend implementation.
- Web Race Hub API replacement.
- automatic Web-triggered backfill.
- live SignalR persistence.
- full-season default backfill.
- static archive ingestion.
- high-volume car telemetry ingestion.

## Acceptance Criteria

Phase 3 is complete when:

- `internal/ingest` exists and is covered by offline tests.
- A user can manually ingest a year, meeting, or session from the CLI.
- Rerunning ingestion is idempotent.
- Raw payloads and normalized records are both written.
- `go test ./internal/ingest/... ./internal/store/...` passes.
- `go build -o /tmp/box-box ./cmd/main.go` passes.
- `go test ./...` either passes or only fails because existing OpenF1
  integration tests cannot reach the network/API.

## Next Phase After This

Phase 4 should add local-first backend read models and Web API endpoints for
Race Hub v1. It should make the Web API prefer local SQLite data and report
missing datasets honestly.
