# Phase 6 React Race Hub Analytics

## Purpose

Phase 6 expands the React Race Hub from a classification/grid slice into a more
useful race analysis surface. Phase 5 proved the React stack, API contract,
desktop layout, and phone table behavior. This phase should add the first
bespoke F1 analysis views without replacing the whole Web app.

This remains a frontend-led phase for Claude.

## Scope

Add Race Hub tabs or segmented views for:

- Overview / Classification
- Starting Grid
- Strategy
- Position Evolution
- Dataset Status

Strategy and position views should be built from local-first backend data only
when the backend exposes the needed datasets. If laps/stints/positions are not
yet available through `/api/v1/race-hub`, add clear missing states instead of
fake charts.

## Backend Contract

Current Race Hub API:

```text
GET /api/v1/race-hub?session_key=...
```

Current datasets:

- meeting
- session
- drivers
- results
- starting_grid

If analytics require laps, stints, pit stops, or position samples, keep backend
changes small and explicit. Do not reintroduce direct OpenF1 reads from the
React app.

## Design Direction

Improve the information hierarchy without drifting into generic dashboard UI:

- stronger timing-wall readability;
- compact controls;
- minimal panel framing;
- no decorative gradients or card sludge;
- team colors as data accents;
- mobile views that fit the active columns rather than relying on horizontal
  scrolling.

## Non-Goals

Do not include these in Phase 6:

- live timing React rewrite;
- full season calendar rebuild;
- settings UI;
- ingest UI;
- static archive support;
- replacing the old Go-served Web UI entirely.

## Acceptance Criteria

Phase 6 is complete when:

- Race Hub has an ergonomic tab/segmented-view structure;
- classification and grid remain intact;
- analytics views show either real local data or honest missing states;
- desktop and phone layouts have been visually checked;
- frontend tests/build pass;
- Go build still passes.
