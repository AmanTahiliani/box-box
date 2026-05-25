# Prompt For Claude: Phase 8 Analytics Visuals

You are working in the `box-box` repository as the frontend/UI engineer for
Phase 8. The backend data foundation is now in place. Your task is to turn the
Race Hub Strategy and Position tabs from placeholders into real, useful
frontend views powered by `/api/v1/race-hub`.

## Context

Read these docs first:

- `documentations/refactor/README.md`
- `documentations/refactor/14-phase-6-react-race-hub-analytics.md`
- `documentations/refactor/15-phase-7-analytics-data-foundation.md`
- `documentations/refactor/16-phase-8-analytics-visuals.md`
- `documentations/refactor/06-visual-design-direction.md`

The current React app lives in `frontend/`. The backend Race Hub payload now
includes:

- `stints`
- `pit_stops`
- `positions`
- `race_control`
- `weather`
- `laps`
- dataset metadata under `datasets`

There is also a deterministic Playwright seed at
`scripts/seed-e2e-db/main.go` and e2e coverage in `tests/race-hub.spec.ts`.

## Objective

Replace the "chart not yet implemented" states in:

- `frontend/src/components/StrategyView.tsx`
- `frontend/src/components/PositionEvolutionView.tsx`

with real views that consume the analytics arrays from the Race Hub response.

## Product Expectations

Strategy should show, at minimum:

- per-driver stint bars;
- compound labels/colors;
- lap ranges;
- pit stop markers or nearby pit stop context;
- a compact fallback table if the viewport is narrow.

Position Evolution should show, at minimum:

- per-driver position progression from position samples;
- grid-to-finish context when results and grid are present;
- clear gain/loss language;
- enough labeling that the view is understandable without a legend-heavy mess.

Use SVG/CSS for the first implementation unless you have a strong reason to add
a charting library. This phase is about a high-quality first native view, not a
large dependency decision.

## Design Direction

Keep it F1-native and operational:

- dense but readable;
- restrained surfaces;
- strong typographic hierarchy;
- team color as identity, compound color as data;
- no decorative gradient blobs;
- no generic SaaS dashboard cards everywhere;
- no fake runtime mock data.

## Implementation Notes

- Update `RaceHubPage.tsx` to pass the new arrays into the components.
- Use the existing `frontend/src/types.ts` contracts.
- Preserve missing-data states for session `9000` in the e2e seed.
- Update component tests or add new tests where the logic deserves coverage.
- Update Playwright tests so they assert real analytics UI for seeded session
  `9472`, not placeholder text.
- If you discover a backend contract issue, document it clearly instead of
  silently working around it in the UI.

## Verification

Run:

```bash
npm test -- --run
npm run build
cd .. && npm run test:e2e
```

The e2e command starts a seeded local database and local web/API servers. It
should not require OpenF1 network access.

## Deliverable

Implement the Phase 8 frontend slice and report:

- files changed;
- key UI behavior added;
- tests run and results;
- any follow-up risks or design refinements you recommend.
