# Claude Prompt: Phase 6 React Race Hub Analytics

You are continuing the React frontend work for `box-box`.

Phase 5 added the Vite + React + TypeScript app under `frontend/` and built the
first Race Hub route using:

```text
GET /api/v1/race-hub?session_key=...
```

Your task is Phase 6: expand Race Hub into a richer analysis surface while
keeping the design F1-native and operational.

## Read First

Read:

- `frontend/README.md`
- `frontend/src/pages/RaceHubPage.tsx`
- `frontend/src/styles/app.css`
- `frontend/src/types.ts`
- `documentations/refactor/06-visual-design-direction.md`
- `documentations/refactor/13-phase-5-react-race-hub.md`
- `documentations/refactor/14-phase-6-react-race-hub-analytics.md`
- `internal/query/racehub.go`

## Goal

Add a more useful Race Hub interaction model: tabs or segmented views for
classification, grid, strategy, position evolution, and dataset status.

## Required Work

1. Add a compact Race Hub tab/segmented control.
2. Preserve the existing classification and grid views.
3. Add a Dataset Status view that makes available/missing datasets very clear.
4. Add Strategy and Position Evolution views with honest missing states if the
   backend does not yet expose enough data.
5. Improve the desktop information hierarchy so the timing table feels more
   legible and intentional.
6. Preserve the mobile table fix: active phone columns must fit the viewport.
7. Add or update frontend tests.

## Guardrails

- Do not fake analytics data.
- Do not fetch OpenF1 directly from React.
- Do not start live timing React work.
- Avoid card sludge and generic SaaS dashboard patterns.
- Keep old Web UI behavior intact.
- Make backend changes only if they are tiny API contract fixes.

## Verification

Run:

```bash
cd frontend
npm test -- --run
npm run build
cd ..
go build -o /tmp/box-box ./cmd/main.go
```

Visually check desktop and phone widths.

## Final Response

Report:

- views/components added;
- API datasets used;
- tests/build results;
- desktop/mobile visual notes;
- any backend data needed for real strategy/position charts.
