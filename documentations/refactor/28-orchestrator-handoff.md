# Orchestrator Handoff

You are taking over as the primary orchestration/coding agent for the box-box refactor.

Repo:

```text
/Users/aman/HomeBase/Programming/Projects/box-box
```

Branch:

```text
box-refactor
```

## Role

You are the engineering manager/orchestrator. Inspect before acting, keep changes scoped, review agent work before committing, prune stale docs after phases, and commit cleanly after each accepted phase. The user prefers Cursor for backend/test/hardening work and Claude for major frontend/product/design work, but you may implement directly when appropriate.

## Operating Rules

- Do not rush into implementation if the user wants to discuss.
- If implementing, keep phases small and commit-ready.
- Commit after each completed/reviewed phase.
- Never revert user/other-agent changes without explicit permission.
- Use `rg` for searches.
- Use `apply_patch` for manual edits.
- For frontend work, run browser or Playwright verification where practical.
- For review requests, lead with findings and file/line references.
- `frontend/dist` is ignored and should not be committed.
- Preserve TUI live mode and official F1 SignalR live behavior carefully.

## Project Direction

box-box started as a Go Bubble Tea F1 TUI backed mostly by OpenF1. The refactor direction is now:

- Web UI is the primary product surface.
- React + TypeScript frontend is the production Web UI stack.
- Go backend remains the API/server.
- Historical/completed-session data should be local-first from SQLite.
- OpenF1 ingestion is explicit via CLI, not fetched live on every page load.
- Official F1 SignalR remains the live source.
- Desired product feel: clean, dense, technical F1 operations room. Avoid card-heavy AI-slop.

## Important Commands

```bash
git status --short
git log --oneline -10

go test ./...
npm --prefix frontend test -- --run
npm --prefix frontend run build
npm run test:e2e
npm run test:e2e:prod
npm run test:visual
npm run test:visual:prod
```

Known test note: do not run Playwright suites that share the same seeded SQLite DB in parallel. Run prod E2E and prod visual sequentially, or they may hit `database is locked`.

## Recent Commits

- `571edb9 Add visual regression coverage`
- `e539abc Add command center screen`
- `9532206 Polish live timing UI`
- `a0f135a Update operator documentation`
- `79b0b9f Rework command center for race weekends`
- `84a8827 Add paddock briefing RSS backend spike`

## Current Uncommitted Work

Two phases are currently uncommitted and need review/integration. Review and
commit Phase 19 first, then Phase 20, or stage hunks carefully if separating the
shared README/refactor README edits.

### Phase 19: Weekend Workspace / Race Hub Flow V1

Claude has completed Phase 19. It is currently uncommitted and needs review.

Claude reported these Phase 19 changes:

- New:
  - `frontend/src/components/OverviewView.tsx`
  - `frontend/src/components/WeekendSwitcher.tsx`
  - `frontend/src/test/RaceHubPage.test.tsx`
  - `documentations/refactor/26-phase-19-weekend-workspace.md`
- Modified:
  - `frontend/src/pages/RaceHubPage.tsx`
  - `frontend/src/components/TabBar.tsx`
  - `frontend/src/components/DatasetStatusView.tsx`
  - `frontend/src/styles/app.css`
  - tests for TabBar, DatasetStatusView, race-hub, command-center, data-library, production-smoke
  - `tests/visual/helpers.ts`
  - race-hub visual snapshots
  - root `README.md`
  - `documentations/refactor/README.md`

Claude reported these UX changes:

- Race Hub is now a Weekend Workspace.
- Compact GP identity band with country decal/accent strip.
- Horizontal session rail replaces “big table then analysis below.”
- Active session context stays visible above tabs.
- Tabs regrouped into Overview, Race Story, Strategy, Lap Data, Conditions, Race Control, Data Status.
- New Overview tab with winner/pole/fastest/podium cards, condition chips, latest race control, and local coverage meter.
- Inline Switch Weekend panel replaces legacy LocalDataNavigator on Race Hub.
- Data Status links to `/admin`; no CLI/admin text on fan surface.
- Mobile/iPad improved with wrapping identity band, horizontal session rail, single-column stats.
- `/race-hub?session_key=9472` still works and loads Bahrain GP 2024 seeded session.
- Bare `/race-hub` now resolves to a focus weekend/session via `pickFocusMeeting` and navigation replace.

Claude reported these tests:

- `npm --prefix frontend test -- --run` passed, 98 tests.
- `npm --prefix frontend run build` passed.
- `npm run test:e2e` passed, 18 tests.
- `npm run test:e2e:prod` passed, 6 tests.
- `npm run test:visual` passed, 12 screenshots after regenerating race-hub baselines.
- `npm run test:visual:prod` passed, 12 screenshots.

### Phase 20: Paddock Briefing Ingestion CLI

A backend subagent implemented Phase 20 after the RSS backend spike. It is also
currently uncommitted and needs review.

Reported Phase 20 changes:

- Modified:
  - `cmd/main.go`
  - `README.md`
  - `documentations/refactor/README.md`
- New:
  - `internal/news/refresh.go`
  - `internal/news/refresh_test.go`
  - `documentations/refactor/29-phase-20-paddock-briefing-ingestion.md`

Implemented behavior:

- Adds `--ingest-news` as a CLI mode.
- Keeps it mutually exclusive with `--ingest-year`, `--ingest-meeting`, and
  `--ingest-session`.
- Reuses `--db` for the domain SQLite path.
- Reuses `--dry-run` to fetch and report feed counts without opening or writing
  the domain database.
- Uses `internal/news.Refresh`, which fetches `DefaultSources`, upserts
  `news_sources`, upserts URL-deduped `news_items`, records `fetched_at` and
  `expires_at`, and continues through individual feed failures before returning
  a summary error.
- Web requests still do not fetch feeds; `/api/v1/news` remains read-only
  against SQLite.

Commands added:

```bash
go run ./cmd/main.go --ingest-news
go run ./cmd/main.go --dry-run --ingest-news
go run ./cmd/main.go --ingest-news --db /tmp/boxbox.db
```

Phase 20 verification already run by Codex:

```bash
go test ./cmd/... ./internal/news ./internal/store
go test ./internal/web ./internal/query
go test ./...
git diff --check
```

## Immediate Task

Start by reviewing and committing Phase 19. Then review and commit Phase 20.
Do not start new implementation until both are accepted and committed.

1. Inspect working tree:

```bash
git status --short
git diff --stat
git diff --name-only
```

2. Review Claude’s Phase 19 work quickly but responsibly:

- Check `RaceHubPage.tsx`, `OverviewView.tsx`, `WeekendSwitcher.tsx`, `TabBar.tsx`, `DatasetStatusView.tsx`, `app.css`, route/test updates, docs.
- Make sure no admin/CLI guidance leaked back into Race Hub.
- Make sure `/race-hub?session_key=9472` compatibility is preserved.
- Make sure `/admin` remains the admin/data-health surface.
- Confirm visual tests and docs match the changed UX.

3. Run a focused verification pass. At minimum:

```bash
npm --prefix frontend test -- --run
npm --prefix frontend run build
npm run test:e2e
npm run test:visual
```

If time allows or if production behavior changed:

```bash
npm run test:e2e:prod
npm run test:visual:prod
```

4. Patch only small issues if found.
5. Stage only Phase 19 files.
6. Commit with a message like:

```bash
git commit -m "Rework Race Hub as weekend workspace"
```

Then review Phase 20:

1. Check `cmd/main.go`, `internal/news/refresh.go`,
   `internal/news/refresh_test.go`,
   `documentations/refactor/29-phase-20-paddock-briefing-ingestion.md`, and the
   README/refactor README hunks.
2. Confirm the CLI mode does not interfere with OpenF1 ingestion modes or web/TUI
   startup.
3. Confirm no live internet tests were added.
4. Re-run targeted backend tests if needed:

```bash
go test ./cmd/... ./internal/news ./internal/store
go test ./...
```

5. Stage Phase 20 files/hunks and commit with a message like:

```bash
git commit -m "Add paddock briefing feed ingestion"
```

## RSS / Paddock Briefing Context

Cursor completed and Codex committed a backend spike as `84a8827 Add paddock briefing RSS backend spike`.

Implemented:

- `internal/news`: RSS/Atom parser and fetch helper.
- SQLite tables:
  - `news_sources`
  - `news_items`
- Store/query methods for cached news.
- Read-only API:
  - `GET /api/v1/news?limit=25&source=racefans-f1`
- No request-time network fetching.
- Unit tests use local XML fixtures.

Recommended feed sources:

- FIA official RSS
- BBC Sport F1
- Autosport F1
- RaceFans F1
- Guardian Formula One

Optional:

- Motorsport.com
- RACER
- Formula 1 YouTube Atom

Avoid:

- Formula1.com scraping/hidden endpoints
- X/Twitter scraping
- Reddit as primary source
- RSS.app/Feedspot as primary source

## Likely Next Phases After Phase 19 And 20

1. Phase 21: Paddock Briefing UI
   - Claude/frontend.
   - Add fan-facing briefing module, likely on Command Center first.
   - Query `/api/v1/news`.
   - Show source, title, age, category, short feed-provided snippet, external link.
   - Keep publisher attribution visible.
   - Avoid full article storage or scraping.

2. Phase 22: Race Story Deepening
   - Claude/frontend or mixed.
   - Collapse legacy classification/grid/position components into a more fluid Race Story canvas.
   - Improve mobile scanning and session narrative.

3. Phase 23: Full Season Backfill / ingest hardening
   - Cursor/backend.
   - Safer season workflows, resumability, rate-limit controls, coverage reporting.
