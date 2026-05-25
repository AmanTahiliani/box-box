# Phase 12 Data Library UI

## Purpose

The app can now ingest full weekends and browse local seasons, meetings, and
sessions. Phase 12 should make local data health visible in the Web UI so users
can understand what is stored, what is partial, and what command to run next.

This is a frontend slice. Keep it practical and built on the APIs already
available.

## Scope

Add a Data Library style surface that shows:

- local seasons and meetings;
- sessions per meeting;
- dataset coverage per session;
- clear empty states;
- suggested CLI commands for ingestion/backfill.

This can be a new route or a tab/section reachable from the existing Race Hub
shell, depending on the current router structure.

## Guardrails

- Do not fetch OpenF1 from React.
- Do not trigger ingestion from the browser.
- Keep Race Hub direct links working.
- Reuse existing local navigation APIs unless a small backend gap is genuinely
  blocking.
- Keep styling dense, operational, and restrained.

## Acceptance Criteria

- User can inspect local data coverage without opening a specific session.
- Partial weekends/sessions are visibly distinct from complete ones.
- Empty database state explains the relevant CLI command.
- Existing Race Hub navigation continues to work.
- Frontend tests/build/e2e pass.
