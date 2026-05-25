# Phase 2 Store Foundation

## Purpose

Phase 2 introduces the local domain database foundation. The current SQLite
database is an HTTP response cache. That should remain intact, but it is not the
same thing as an app-owned F1 domain store.

The goal of this phase is to add `internal/store` with schema initialization,
migrations, provenance-aware raw payload storage, and a small set of typed
domain tables needed by Race Hub v1. This phase should not build ingestion
commands or change the Web UI yet.

## Manager Decision

Keep this phase boring and structural. Do not try to ingest a full weekend yet.
The deliverable is a tested store package that later phases can call.

Phase 2 should prove:

- the app can create/open a domain SQLite database;
- migrations are repeatable and idempotent;
- raw source payloads can be stored with provenance;
- basic meeting/session/driver/session result records can be upserted and read;
- existing HTTP cache behavior is untouched.

## Package Boundary

Add:

```text
internal/store/
  db.go            open/close database, pragmas, transaction helper
  migrations.go    embedded SQL migrations and schema versioning
  models.go        store-layer structs for v1 domain records
  raw.go           raw payload/provenance writes and reads
  meetings.go      typed meeting/session upserts and reads
  results.go       typed driver/result/grid-style records as initial slice
  store_test.go    temp-db migration and CRUD tests
```

The exact file split can change, but `internal/store` should not import
`internal/ui` or `internal/web`.

## Database Location

Use a conservative default path separate from the existing HTTP cache:

```text
~/.local/share/box-box/boxbox.db
```

Tests must use temporary databases, not the user's real home directory.

## Initial Schema Scope

Create tables for:

- `schema_migrations`
- `raw_payloads`
- `ingestion_runs`
- `meetings`
- `sessions`
- `drivers`
- `session_drivers`
- `session_results`
- `starting_grid`

It is acceptable to include additional Race Hub v1 tables if doing so is
straightforward, but do not overbuild high-volume telemetry yet.

## Raw Payload Strategy

`raw_payloads` should preserve source truth before normalization.

Recommended columns:

- source name, such as `openf1`
- endpoint or topic
- request key or URL
- meeting key when known
- session key when known
- payload JSON text/blob
- payload hash
- fetched timestamp
- provenance metadata JSON

Raw payload storage should be idempotent by source/request/hash or another
clear uniqueness rule.

## Domain Table Strategy

Use stable OpenF1 identifiers where available:

- `meeting_key`
- `session_key`
- `driver_number`

Prefer explicit upserts over blind inserts. Completed historical data should be
safe to re-run without duplicating rows.

## Tests

Minimum tests:

- opening a temp database applies migrations;
- migrations can be run twice;
- schema version is recorded;
- raw payload insert/read works and preserves provenance;
- duplicate raw payload writes do not create accidental duplicates;
- meeting/session/driver/result upserts are idempotent;
- basic Race Hub read helpers can retrieve inserted meeting/session/result data.

## Non-Goals

Do not include these in Phase 2:

- OpenF1 backfill orchestration.
- CLI ingestion commands.
- Web UI changes.
- React setup.
- Replacing existing `internal/api/cache.go`.
- High-volume telemetry tables for car data/location.
- Live SignalR persistence.

## Acceptance Criteria

Phase 2 is complete when:

- `internal/store` exists with tested migration and CRUD behavior.
- The package can create a fresh SQLite domain database.
- Running migrations repeatedly is safe.
- Store tests pass without internet access.
- `go test ./internal/store/...` passes.
- `go test ./...` either passes or only fails because existing OpenF1
  integration tests cannot reach the network/API.
