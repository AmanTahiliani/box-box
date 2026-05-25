# Phase 11 Weekend Ingestion

## Purpose

Phase 10 made local data navigable in the Web UI, but the app still needs a
practical way to populate a complete weekend. Phase 11 should make ingestion
work at the same shape users browse: meeting/weekend first, then sessions.

This is a backend/CLI slice for Cursor.

## Scope

Add or refine CLI ingestion so a user can ingest a whole meeting/weekend into
the domain database without manually running one command per session.

The target workflow is:

- ingest meeting metadata and sessions for a `meeting_key`;
- for each session in that meeting, ingest Race Hub datasets;
- report per-session success, partial failure, and row counts clearly;
- keep raw payload provenance.

## Guardrails

- Do not remove single-session ingestion.
- Do not fetch data from React.
- Do not make failed optional analytics endpoints destroy already-ingested
  meeting/session metadata.
- Keep tests offline with fake sources.
- Be careful with live/current sessions; completed historical sessions are the
  primary target.

## Acceptance Criteria

- A single CLI path can ingest all sessions for a meeting.
- Ingestion summaries make per-session results clear.
- Existing `--ingest-session` behavior still works.
- Store/query/web/frontend tests still pass.
- Add focused ingestion tests for full-weekend orchestration and partial
  failures where practical.
