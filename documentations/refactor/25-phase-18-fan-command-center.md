# Phase 18: Fan Command Center and Admin Split

## Goal

Shift the Web UI from a local-data console toward an F1 fan race-weekend
command center, while keeping the dark, dense, ops-room aesthetic. Move
local-data and ingestion concerns into a thin Admin / Data Health area so they
no longer dominate the fan-facing first screen.

## Completed Scope

- Reworked `/` (`CommandCenterPage`) around the focus race weekend:
  - GP identity band with country decal, GP name, location, circuit, date
    range, status eyebrow (Live now / Current / Next / Recent), and a
    country-derived left-edge accent strip.
  - Countdown block — LIVE state, current-session label, next-session
    `Xd HHh MMm SSs` countdown, or "Weekend finished" — anchored to the band.
  - Primary actions row: Watch Live, Open Analysis (preselects race → qual →
    first local session), Schedule jump.
  - Session schedule as responsive cards instead of a table, with per-session
    coverage dot, status pill, and direct Race Hub link (keeps the existing
    `cc-session-{key}` testid).
  - Recent local weekends rendered as a chip strip with country decals.
  - Empty state reframed: short eyebrow, single-paragraph instruction, and
    links to Live + Admin (no inline CLI on the fan-facing surface).
- Added `frontend/src/lib/gpIdentity.ts` for country accent, 3-letter decal,
  and short date-range formatting.
- Reframed `DataLibraryPage` as **Admin · Data Health**: page header,
  utility-style stats banner (seasons / full / partial / missing), and a
  back-link to Command Center in the footer.
- Added `/admin` route rendering the same Data Health page. `/data-library`
  remains as a legacy alias so existing links keep working.
- Updated `Nav` so primary fan destinations (Command / Live / Race Hub) sit
  next to the logo, and a small monospace **Admin** chip is anchored to the
  far right as a utility link.

## What Moved Into Admin / Data Health

- Five-stat coverage strip (Seasons / Full / Partial / Missing / Sessions
  Local) — now lives in the admin banner.
- CLI ingest guidance — only shown under Admin and inside meeting detail.
- Per-meeting weekend table, per-session dataset status panel, and ingest
  command blocks — unchanged content, but no longer reachable from the fan
  nav directly.

## What Did Not Change

- Race Hub session-key table flow is unchanged (deeper rework is deferred).
- No new backend endpoints. Command Center still calls the existing local-first
  APIs (`/api/v1/seasons`, `/api/v1/meetings`, `/api/v1/weekend`,
  `/api/v1/live/state`).
- Live SignalR bridge, Live Timing page, and TUI live mode are untouched.

## Tests and Visual Coverage

Updated:

- `frontend/src/test/CommandCenterPage.test.tsx` — covers new band, decal,
  empty-state copy, and analysis action label.
- `tests/command-center.spec.ts` — exercises new actions container and the
  reframed admin route alongside existing routes.
- `tests/data-library.spec.ts` — renamed describe block, exercises both
  `/admin` and the `/data-library` alias, uses the new Admin nav link.
- `tests/production-smoke.spec.ts` — covers `/admin`, the legacy
  `/data-library` route, and the updated nav labels.
- `tests/visual/__snapshots__/{desktop,tablet,mobile}/{command-center,data-library}.png`
  regenerated against the new layout.

## Verification

```bash
npm --prefix frontend test -- --run
npm --prefix frontend run build
npm run test:e2e
npm run test:e2e:prod
npm run test:visual
npm run test:visual:prod
```

All commands above were run in this branch and pass: 94 unit tests, 15 E2E,
6 prod smoke, 12 visual baseline, 12 prod visual baseline.

## Limitations and Follow-ups

- The Schedule action only renders when a next session exists. During a
  live session the row shows two actions instead of three; intentional.
- Country accent palette in `gpIdentity.ts` is a hand-tuned subset of country
  codes; unknown codes fall back to a neutral gray.
- Race Hub remains the next target — its session-selection flow is still the
  most dated part of the fan path, especially on tablet.

## Related

- [21 MVP Completion Checklist](21-mvp-completion-checklist.md)
- [22 Phase 14 Visual Regression](22-phase-14-visual-regression.md)
- [23 Phase 15 Command Center](23-phase-15-command-center.md)
- [24 Phase 16 Live Timing Polish](24-phase-16-live-timing-polish.md)
