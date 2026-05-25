# Prompt For Claude: Phase 8 Analytics Visuals

You are the frontend/UI engineer for Phase 8 of `box-box`. Please keep context
usage low: do not read the whole refactor docs folder. Start with the files
listed below and only open more if you are blocked.

## Goal

Turn the Race Hub Strategy and Position tabs from placeholders into real views
powered by the local-first `/api/v1/race-hub` response.

## Read First

Open only these first:

- `frontend/src/pages/RaceHubPage.tsx`
- `frontend/src/components/StrategyView.tsx`
- `frontend/src/components/PositionEvolutionView.tsx`
- `frontend/src/types.ts`
- `tests/race-hub.spec.ts`
- `scripts/seed-e2e-db/main.go`

Optional, only if you need design guidance:

- `documentations/refactor/16-phase-8-analytics-visuals.md`
- `documentations/refactor/06-visual-design-direction.md`

## Current Backend Contract

`RaceHub` already includes these arrays:

- `stints`
- `pit_stops`
- `positions`
- `race_control`
- `weather`
- `laps`

Dataset availability is still reported under `datasets`.

Seeded e2e sessions:

- `9472`: has core data plus analytics data.
- `9000`: has core data only, so missing-data states must still render.

## Work To Do

1. Update `RaceHubPage.tsx` to pass analytics arrays into the Strategy and
   Position components.
2. Replace `"Strategy chart: not yet implemented."` with a real strategy view:
   per-driver stint bars, compound labels/colors, lap ranges, and pit context.
3. Replace `"Position evolution chart: not yet implemented."` with a real
   position view: per-driver progression from `positions`, plus grid/finish
   context when available.
4. Preserve honest missing-data states for sessions without analytics.
5. Update tests so they assert real analytics UI for session `9472`, not
   placeholder text.

## Design Constraints

- Keep it dense, technical, and F1-native.
- Use SVG/CSS for this first slice unless a dependency is truly necessary.
- Team color identifies drivers; compound color identifies tyre data.
- Avoid generic dashboard card sludge, decorative gradients, and fake runtime
  mock data.
- Keep mobile/iPad usable.

## Verification

Run:

```bash
cd frontend && npm test -- --run
cd frontend && npm run build
npm run test:e2e
```

The root e2e command starts a seeded local database and local web/API servers.
It should not need OpenF1 network access.

## Report Back

Summarize:

- files changed;
- UI behavior added;
- tests run and results;
- follow-up risks or refinements.
