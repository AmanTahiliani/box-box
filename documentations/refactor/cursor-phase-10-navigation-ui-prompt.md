# Prompt For Cursor: Phase 10 Navigation UI

You are working in the `box-box` repository on Phase 10. This is a frontend
phase, but keep it pragmatic and low-context: build functional local-first
navigation around the existing Race Hub without redesigning the whole app.

## Read First

Open these files first:

- `documentations/refactor/18-phase-10-navigation-ui.md`
- `frontend/src/pages/RaceHubPage.tsx`
- `frontend/src/api.ts`
- `frontend/src/types.ts`
- `frontend/src/main.tsx`
- `frontend/src/styles.css`
- `tests/race-hub.spec.ts`

Only open older docs if you are blocked.

## Backend APIs Available

- `GET /api/v1/seasons`
  - returns local years, newest first, e.g. `[2025]`.
- `GET /api/v1/meetings?year=2025&source=local`
  - returns locally ingested meetings for the year.
- `GET /api/v1/weekend?meeting_key=1229`
  - returns meeting metadata, sessions, `default_session_key`, and per-session
    dataset coverage.

Use `source=local` for meetings so React does not fall back to OpenF1.

## Goal

Let users browse local data into Race Hub without knowing a raw `session_key`.

## Work To Do

1. Add TypeScript types and API functions for seasons, local meetings, and
   weekend details.
2. Add a simple local data navigator in the React app:
   - year selector/list;
   - meetings for selected year;
   - sessions for selected weekend;
   - dataset coverage hints.
3. Selecting a session should navigate to `/race-hub?session_key=<key>`.
4. Keep the current manual session key entry as a fallback.
5. Preserve the existing Race Hub tabs and analytics views.
6. Add focused tests where practical.
7. Update Playwright coverage if a stable seeded navigation path is easy.

## Design Notes

- Keep it dense and operational, not a marketing page.
- Avoid card-heavy dashboard sludge.
- Reuse existing type, spacing, tab, and table conventions where possible.
- Mobile should remain usable.

## Do Not Do

- Do not fetch OpenF1 from React.
- Do not remove direct `session_key` routing.
- Do not introduce a new UI framework.
- Do not touch backend unless you find a blocking API bug.

## Verification

Run:

```bash
cd frontend && npm test -- --run
cd frontend && npm run build
npm run test:e2e
```

## Report Back

Summarize:

- files changed;
- navigation behavior added;
- tests run and results;
- follow-up polish or data needs.
