# Phase 8 Analytics Visuals

## Purpose

Phase 7 added the backend data foundation for Race Hub analytics: stints, pit
stops, positions, race control, weather, and laps now flow through the local
SQLite store, ingestion, query layer, and `/api/v1/race-hub`.

Phase 8 returns to frontend work. The goal is to replace the Strategy and
Position placeholder states with useful, production-minded views that consume
the real local-first analytics arrays now present in the Race Hub payload.

## Scope

Build the first real analytics views for:

- race strategy from stints and pit stops;
- position evolution from position samples;
- lightweight supporting context from race control, weather, and laps where it
  improves the view without making the screen noisy.

The work should stay inside the React Race Hub surface. Do not redesign the
whole application shell in this phase.

## Frontend Work

Expected changes:

- pass `stints`, `pit_stops`, `positions`, `race_control`, `weather`, and `laps`
  into the relevant Race Hub components;
- replace "chart not yet implemented" placeholders with real visual treatment;
- preserve honest missing-data states for sessions that only have core datasets;
- keep the design dense, technical, and F1-native;
- add focused component/unit tests for available and missing analytics data;
- update Playwright coverage so seeded analytics views prove the real data path
  works.

## Visual Direction

Prefer timing-wall clarity over dashboard decoration:

- stint bars should be compact and scan-friendly;
- team colors should identify drivers without overpowering compound colors;
- compound colors should be disciplined and legible;
- position evolution should make gain/loss and driver comparison obvious;
- avoid decorative cards, giant empty panels, vague gradients, and generic SaaS
  chart chrome.

## Guardrails

- Do not fetch OpenF1 directly from React.
- Do not add a heavy charting library unless the local interaction genuinely
  needs it; SVG/CSS is enough for this first slice.
- Do not hide missing datasets behind fake mock data in runtime views.
- Keep mobile and iPad layouts usable, not just desktop-polished.
- Keep backend changes out of scope unless a clear API bug is discovered.

## Acceptance Criteria

- Strategy tab renders real stint/pit information when analytics data exists.
- Position tab renders real position information when position samples exist.
- Missing-data sessions still show clear unavailable states.
- Existing Race Hub views keep working.
- Frontend tests and build pass.
- Playwright Race Hub e2e passes against the seeded local database.
