# Phase 16: Live Timing Polish

## Goal

Improve the React Live Timing route as an operations screen while preserving the
existing official F1 SignalR bridge and TUI live behavior.

## Completed Scope

- Added pure helpers for position delta styling and race-control flag classes.
- Improved the timing tower with podium position styling, colored position
  deltas, best-lap/lap-count columns, and compact status badges.
- Reworked the session banner so track status, lap count, clock, live/stale
  state, and weather read as dense operational metadata.
- Improved race-control feed treatment with color-coded flag badges, category
  labels for non-flag messages, and bounded scrolling.
- Reworked the live route layout into a two-column desktop view with timing
  tower priority and race control alongside it.
- Improved empty and disconnected states without requiring a real live F1
  session.

## Constraints

- No backend live bridge or TUI live code was changed.
- No persisted live storage was added.
- Tests continue to use disabled-live/empty-state coverage because an active F1
  session is not guaranteed.

## Verification

```bash
npm --prefix frontend test -- --run
npm --prefix frontend run build
npm run test:e2e
npm run test:e2e:prod
npm run test:visual
npm run test:visual:prod
```

## Related

- [21 MVP Completion Checklist](21-mvp-completion-checklist.md)
- [23 Phase 15 Command Center](23-phase-15-command-center.md)
