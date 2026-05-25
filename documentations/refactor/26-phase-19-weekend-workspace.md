# Phase 19: Weekend Workspace / Race Hub Flow V1

## Goal

Rework `/race-hub` from an "admin-style table on top, analysis below" page
into a Weekend Workspace that feels like a modern session companion: a
compact GP identity band, a horizontal session rail, an Overview snapshot,
and fan-oriented analysis tabs. Keep `/race-hub?session_key=…` working,
keep ingestion/admin concerns out of the fan surface, and make mobile/iPad
first-class.

## Completed Scope

- Replaced the legacy Race Hub layout with a Weekend Workspace:
  - **Topbar**: `box-box · race hub · <year>` eyebrow, weekend source badge,
    and a `Switch Weekend` toggle that opens an inline switcher panel.
  - **GP identity band**: country decal, GP name, location · circuit, date
    range, with a left-edge `--gp-accent` strip derived from
    `frontend/src/lib/gpIdentity.ts`.
  - **Session rail**: horizontal segmented strip of session cards (FP1,
    FP2, FP3, Q, Sprint, R …) showing abbreviation, name, time, source dot,
    and coverage hint. Switching is a single click; selected chip pulses
    with the GP accent.
  - **Active session sub-bar**: compact line with session name, scheduled
    time, coverage label, and `key <session_key>` for power users.
- New tab grouping (`frontend/src/components/TabBar.tsx`):
  Overview · Race Story · Strategy · Lap Data · Conditions · Race Control ·
  Data Status. Race Story bundles classification, starting grid, and
  position evolution behind a sub-segmented control so the operational
  feel is preserved without exploding the top-level tab list.
- New **Overview** tab (`components/OverviewView.tsx`): operational stat
  cards (Winner / Pole / Fastest Lap / Podium) plus compact panels for
  Conditions, latest Race Control messages, and a Local Coverage meter
  that links to the relevant Data Status tab.
- Inline **Weekend Switcher** (`components/WeekendSwitcher.tsx`): season
  tabs, meeting cards with country decals, and expandable per-meeting
  session lists that navigate via `useNavigate`. Replaces the old fullscreen
  `LocalDataNavigator` table on the Race Hub surface.
- Auto-resolution when `/race-hub` is opened without `session_key`: the
  page resolves the focus weekend via the same `pickFocusMeeting` helper
  Command Center uses and `navigate(replace: true)` to the focus
  session (race → qualifying → first local session).
- **Data Status** tab now points at `/admin` for missing datasets instead of
  inlining CLI commands. Admin remains the home for ingestion guidance.
- GP accent is plumbed through CSS custom property `--gp-accent`, used by
  session chips, story sub-control underline, overview stat cards, and the
  topbar `Switch Weekend` border.

## Route Behavior

- `/race-hub?session_key=9472` — unchanged contract; loads the workspace
  for that session and opens Overview by default.
- `/race-hub` (no key) — resolves locally via `fetchSeasons` →
  `fetchLocalMeetings` → `pickFocusMeeting` → `fetchWeekend`, then
  `navigate({ replace: true })` to the focus session's race/qualifying.
- `/data-library` and `/admin` remain untouched.

## What Did Not Change

- Backend APIs (`/api/v1/race-hub`, `/api/v1/seasons`, `/api/v1/meetings`,
  `/api/v1/weekend`).
- Live SignalR bridge, `/live` page, TUI live mode.
- Command Center, Admin / Data Health flows.
- Existing chart and table components (`ClassificationTable`,
  `StartingGridTable`, `StrategyView`, `PositionEvolutionView`, `LapsView`,
  `RaceControlView`, `WeatherView`) are reused inside the new shell.
- The legacy `LocalDataNavigator` component is kept (still unit-tested) so
  any future surfaces can reuse it, but it is no longer mounted on
  `/race-hub`.

## Tests and Visual Coverage

Updated:

- `frontend/src/test/TabBar.test.tsx` — new tab list (Overview / Race Story
  / Strategy / Lap Data / Conditions / Race Control / Data Status).
- `frontend/src/test/DatasetStatusView.test.tsx` — rewritten against the
  fan-facing dataset list (11/11), the new `Manage ingestion → /admin`
  link, and the removal of inline CLI hints.
- `frontend/src/test/RaceHubPage.test.tsx` — new test file covering the
  identity band, session rail, Race Story sub-controls, Data Status admin
  link, and the inline weekend switcher.
- `tests/race-hub.spec.ts` — rewritten E2E spec covering Overview default,
  Race Story sub-views, Strategy and Positions missing-data notices,
  weekend switcher toggle, Data Status admin link, and the bare
  `/race-hub` redirect.
- `tests/command-center.spec.ts`, `tests/data-library.spec.ts`,
  `tests/production-smoke.spec.ts` — updated assertions to land on the
  new workspace shell rather than the old "Final Classification" headline.
- `tests/visual/helpers.ts` — `gotoRaceHubReady` now waits for
  `race-hub` + `rh-identity` + `rh-session-<key>` + `rh-overview`.
- `tests/visual/__snapshots__/{desktop,tablet,mobile}/race-hub.png` —
  regenerated. Command Center, Admin, and Live snapshots untouched.

## Verification

```bash
npm --prefix frontend test -- --run        # 98 unit tests pass
npm --prefix frontend run build            # tsc + vite, clean
npm run test:e2e                           # 18 E2E pass
npm run test:e2e:prod                      # 6 prod smoke pass
npm run test:visual                        # 12 baseline pass after regen
npm run test:visual:prod                   # 12 prod baseline pass after regen
```

## Limitations and Follow-ups

- The Race Story tab keeps three legacy datasets behind a sub-segmented
  control. A future pass could merge classification + position evolution
  into a single scrollable "story" canvas.
- Overview's "Fastest Lap" picks the minimum non-pit-out `lap_duration` from
  the ingested laps payload. Sessions that don't ingest laps show "No data
  ingested" — accurate, but a future phase could fall back to OpenF1's
  `fastest_lap` field if/when that lands locally.
- The inline weekend switcher fetches the active meeting's `/weekend`
  payload only when expanded. Switching seasons or browsing many
  meetings does not pre-warm sibling weekend queries; this is intentional
  to avoid the N×weekend fan-out that Command Center already pays.
- Visual baselines are regenerated against the current seeded e2e DB. If
  the seeded session list grows, the desktop snapshot will widen.
- Country accents in `gpIdentity.ts` remain a hand-tuned subset; unknown
  codes fall back to a neutral gray (same behavior as Command Center).

## Related

- [21 MVP Completion Checklist](21-mvp-completion-checklist.md)
- [22 Phase 14 Visual Regression](22-phase-14-visual-regression.md)
- [25 Phase 18 Fan Command Center](25-phase-18-fan-command-center.md)
