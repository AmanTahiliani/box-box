# Phase 10 Navigation UI

## Purpose

Phase 9 added local-first navigation APIs for seasons, weekends, sessions, and
dataset coverage. Phase 10 should use those APIs in the React Web UI so users
can browse ingested data instead of manually typing a `session_key`.

This is a frontend slice. Keep it functional and restrained; full visual polish
can come after the navigation workflow exists.

## Scope

Add React UI for:

- available seasons from `/api/v1/seasons`;
- locally ingested meetings for a selected year;
- one weekend view from `/api/v1/weekend?meeting_key=...`;
- session selection that routes into existing Race Hub views.

The existing Race Hub analytics views should stay intact.

## Product Behavior

- If local data exists, users should be able to reach Race Hub without knowing a
  raw session key.
- Empty local database states should be explicit and calm.
- Weekend/session rows should show dataset coverage so users understand why a
  session may be partial.
- Race Hub should continue accepting `session_key` in the URL for direct links.

## Guardrails

- Do not fetch OpenF1 directly from React.
- Do not redesign every screen.
- Do not remove the manual session key entry yet; keep it as a fallback.
- Do not add a large UI framework or chart dependency.
- Keep mobile and iPad usable.

## Acceptance Criteria

- Users can select a local year, meeting, and session.
- Selecting a session opens Race Hub for that session.
- Empty states are covered.
- Existing Race Hub e2e tests continue passing.
- Add focused frontend tests for navigation behavior where practical.
- Frontend tests and build pass.
