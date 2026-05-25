# Phase 14: Visual Regression and Responsive QA

## Goal

Add Playwright screenshot coverage for the MVP Web UI routes across desktop,
tablet, and mobile viewports before broader product expansion.

## Scope

Routes:

- `/race-hub?session_key=9472`
- `/data-library`
- `/live` (empty state with `BOXBOX_DISABLE_LIVE=1`)

Viewports (deterministic Chromium):

| Project | Size |
|---------|------|
| desktop | 1280×800 |
| tablet  | 768×1024 |
| mobile  | 390×844 |

## Commands

```bash
# Dev proxy (Vite + seeded Go API) — same stack as test:e2e
npm run test:visual
npm run test:visual:update

# Production serving (Go + frontend/dist) — canonical for committed snapshots
npm run test:visual:prod
npm run test:visual:prod:update
```

Snapshots live under `tests/visual/__snapshots__/{desktop,tablet,mobile}/`.

## Constraints

- Reuses `scripts/seed-e2e-db` and `BOXBOX_DISABLE_LIVE=1`; no live F1 session
  or OpenF1 network calls.
- Screenshots are taken only after route-specific ready conditions (classification
  loaded, data library detail visible, live empty state).
- Animations disabled; full-page captures; no loading-state screenshots.

## Out of Scope

- Live timing tower screenshots (requires an active session and live SignalR).
- Cross-browser matrix beyond Chromium.
- Pixel-perfect parity between Vite dev and production builds (use prod update
  when refreshing committed baselines).

## Related

- [21 MVP Completion Checklist](21-mvp-completion-checklist.md)
