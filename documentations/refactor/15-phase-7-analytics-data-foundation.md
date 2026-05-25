# Phase 7 Analytics Data Foundation

## Purpose

Phase 7 returns to backend work. Phase 6 added honest frontend placeholders for
strategy and position evolution, but the Race Hub API does not yet expose the
local datasets needed to draw those views.

The goal is to expand the local store, ingestion, and Race Hub read model with
the first analytics datasets.

## Scope

Add local-first support for:

- laps;
- stints;
- pit stops;
- race control;
- weather;
- positions, if volume and schema stay manageable.

Prioritize stints and positions because they unlock the Strategy and Position
Evolution views.

## Backend Work

Expected changes:

- add SQLite tables and migrations for the selected datasets;
- add store upsert/read methods;
- extend `internal/ingest` session ingestion;
- extend `internal/query.RaceHub`;
- extend `/api/v1/race-hub` metadata counts;
- keep raw payload provenance for every fetched endpoint.

## Guardrails

- Keep ingestion idempotent.
- Keep tests offline.
- Do not fetch OpenF1 directly from React.
- Do not persist high-volume car telemetry yet.
- If positions are too large for this phase, document the limit and implement
  stints/pits first.

## Acceptance Criteria

- Store migrations and CRUD tests pass.
- Ingestion writes new datasets and raw payloads.
- Race Hub API exposes new datasets with metadata.
- Existing React placeholders can detect available stints/positions.
- Focused Go tests pass.
