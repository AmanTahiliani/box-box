# Prompt For Cursor: Phase 12 Data Library UI

You are working in the `box-box` repository on Phase 12. Build a practical Web
UI surface for inspecting local data coverage and ingestion status.

## Read First

Open these files first:

- `documentations/refactor/20-phase-12-data-library-ui.md`
- `frontend/src/components/LocalDataNavigator.tsx`
- `frontend/src/pages/RaceHubPage.tsx`
- `frontend/src/api.ts`
- `frontend/src/types.ts`
- `frontend/src/main.tsx`
- `frontend/src/styles/app.css`
- `tests/race-hub.spec.ts`

Only open older docs if you are blocked.

## Goal

Let a user inspect what is in the local database and understand what is missing
without needing to open every Race Hub session manually.

## APIs Available

- `GET /api/v1/seasons`
- `GET /api/v1/meetings?year=<year>&source=local`
- `GET /api/v1/weekend?meeting_key=<key>`
- `GET /api/v1/race-hub?session_key=<key>`

Do not fetch OpenF1 from React.

## Work To Do

1. Add a Data Library route or reachable section in the React app.
2. Show local years/meetings/sessions and dataset coverage.
3. Make partial vs complete sessions visually clear.
4. Include copyable/reference CLI commands, such as:
   - `box-box --ingest-year 2025`
   - `box-box --ingest-meeting <meeting_key>`
   - `box-box --ingest-session <session_key>`
5. Preserve direct Race Hub navigation.
6. Add focused frontend tests and update e2e if stable.

## Design Notes

- Keep it operational and table-like.
- Avoid decorative cards and generic dashboard clutter.
- Use the existing dataset/status visual language where possible.
- Mobile should remain usable.

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
- Data Library behavior added;
- tests run and results;
- follow-up API or design gaps.
