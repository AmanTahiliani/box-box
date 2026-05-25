# Database Design

## Summary

SQLite should become the local source of truth for historical and completed
session data. The design should store both raw source payloads and normalized
domain rows. Raw payloads preserve source fidelity and make reprocessing
possible. Normalized rows power fast product queries, analytics, and stable Web
screens.

## Storage Strategy

Use two layers:

1. Raw source storage.
   - Preserve fetched payloads exactly enough to reprocess later.
   - Track source, endpoint/topic, parameters, fetch time, status, and errors.
2. Normalized domain tables.
   - Queryable application data keyed by F1 identifiers.
   - Built from successful source payloads.
   - Safe to upsert idempotently.

## Raw Payload Tables

Candidate tables:

- `source_payloads`
  - `id`
  - `source`
  - `resource`
  - `request_key`
  - `url_or_topic`
  - `params_json`
  - `payload_json`
  - `fetched_at`
  - `status`
  - `error`
  - `schema_version`

- `ingestion_runs`
  - `id`
  - `scope_type`
  - `scope_key`
  - `started_at`
  - `finished_at`
  - `status`
  - `refresh`
  - `summary_json`

- `ingestion_items`
  - `id`
  - `run_id`
  - `dataset`
  - `meeting_key`
  - `session_key`
  - `status`
  - `source`
  - `started_at`
  - `finished_at`
  - `error`

## Normalized Domain Tables

Core calendar/session tables:

- `meetings`
- `sessions`
- `circuits`

Participant tables:

- `drivers`
- `session_drivers`
- `teams` or team snapshots by season/session.

Classification and standings:

- `session_results`
- `starting_grids`
- `driver_championship_standings`
- `constructor_championship_standings`

Race/session analysis:

- `laps`
- `stints`
- `pit_stops`
- `positions`
- `intervals`
- `race_control_messages`
- `weather_samples`
- `overtakes`

Telemetry and spatial data:

- `car_data_samples`
- `location_samples`
- `track_outlines`

Media metadata:

- `team_radio_messages`

Derived/read-model candidates:

- `session_dataset_status`
- `race_key_moments`
- `driver_session_summaries`
- `race_lap_snapshots`

Derived tables should be added only when query cost or UI complexity justifies
them. Start with normalized source tables and build read models in Go unless
performance argues otherwise.

## Provenance and Freshness

Each normalized dataset should be traceable to source ingestion metadata.

Track:

- Source: OpenF1, SignalR, static archive, manual, cache.
- First ingested time.
- Last ingested time.
- Last successful refresh.
- Last error.
- Completion status.
- Whether stale fallback was used.

This metadata supports the Data Library screen and makes partial data honest.

## Immutability Policy

Completed historical sessions:

- Treat as immutable after successful ingestion.
- Do not refetch unless `--refresh` is explicitly requested.
- Allow reprocessing from raw payloads if schema or read models change.

Current/future sessions:

- Treat as refreshable.
- Allow opportunistic metadata fetches.
- Avoid high-volume refreshes without explicit action.

Live sessions:

- SignalR is authoritative for live state.
- Persist live data as an append-only event/snapshot stream after the live
  bridge is extracted.
- Keep live data separate from normalized post-session OpenF1 records until
  reconciliation is designed.
- Treat live data as the record of what was seen during the session, not as the
  corrected final historical truth.

## Migration And File Layout

The current project already creates a SQLite cache database for raw HTTP
responses. The domain database should be introduced without breaking that cache.

Default stance:

- Existing cache tables are infrastructure, not product domain state.
- New domain tables should be owned by `internal/store`.
- A separate domain DB file is the lower-risk first implementation unless a
  schema design pass shows strong reasons to reuse the same file.
- If the same file is reused, domain tables must be namespaced clearly and
  migrations must avoid touching the current `cache` table except through
  deliberate cache work.
- Do not auto-migrate URL-keyed cache entries into domain rows.
- Use explicit ingestion to populate the new domain tables.

## High-Volume Data

High-volume tables need careful indexing and retention decisions:

- `car_data_samples`
- `location_samples`
- `positions`
- `intervals`
- `laps` for full-season analysis

Initial policy:

- Ingest high-volume telemetry only when explicitly requested.
- Keep Race Hub v1 focused on results, strategy, laps, race control, weather,
  positions, and track outlines.

## Research Questions

- Exact indexes for Race Hub, Live Replay, Driver Explorer, and Standings.
- Whether `positions` and `intervals` should be downsampled or stored in full.
- Whether `car_data_samples` and `location_samples` should be optional datasets.
- How to map official F1 static archive sessions to OpenF1 `session_key`.
- Whether to use SQLite FTS for race-control/team-radio search.
- How to version schema migrations without adding unnecessary framework weight.
