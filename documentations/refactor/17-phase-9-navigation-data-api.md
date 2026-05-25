# Phase 9 Navigation Data API

## Purpose

Race Hub now has useful local-first session views, but it still depends on a
manual `session_key`. Phase 9 should make the backend expose enough local
navigation data for the Web UI to become race-weekend-first: season calendar,
meeting detail, sessions, and ingestion coverage.

This is a backend/read-model slice for Cursor. Keep the React redesign for the
following phase.

## Scope

Add local-first Web API endpoints/read models for:

- seasons or available years in the domain database;
- meetings for a year;
- one meeting/weekend with its sessions;
- per-session dataset coverage using the same dataset vocabulary as Race Hub;
- a sensible "latest available" or "default session" helper if it can be done
  without guessing from remote API data.

## Backend Work

Expected changes:

- add query-layer read models in `internal/query` for calendar/weekend data;
- add store reads if existing methods are insufficient;
- add HTTP handlers in `internal/web`;
- keep responses local-first and deterministic;
- expose empty but well-shaped responses when the database has no ingested
  meetings;
- add offline tests using temporary SQLite databases.

## Guardrails

- Do not fetch OpenF1 from these read endpoints.
- Do not make React depend on OpenF1 directly.
- Do not start frontend navigation implementation in this phase.
- Keep endpoint names stable and boring; this is app infrastructure, not a
  product copywriting exercise.
- Keep the existing Race Hub API working unchanged.

## Acceptance Criteria

- Web API can list ingested years and meetings.
- Web API can return a meeting/weekend with sessions.
- Each session includes dataset coverage needed to guide users into Race Hub.
- Empty database behavior is explicit and tested.
- Focused Go tests pass.
- Existing frontend unit/build/e2e checks still pass.
