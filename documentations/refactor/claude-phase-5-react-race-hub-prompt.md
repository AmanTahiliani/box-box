# Claude Prompt: Phase 5 React Race Hub

You are the frontend/UI lead for `box-box`, an F1 local-first command center.

Backend Phases 1-4 are complete:

- `internal/live` owns shared official F1 SignalR live timing.
- `internal/store` owns the local SQLite domain DB.
- `internal/ingest` can ingest OpenF1 data into the local store.
- `internal/query` and Web API expose local-first Race Hub data at:

  ```text
  GET /api/v1/race-hub?session_key=9472
  ```

Your task is Phase 5: begin the production React Web UI with a focused Race Hub
slice.

## Read First

Read these files before editing:

- `CLAUDE.md`
- `documentations/refactor/04-web-ui-product.md`
- `documentations/refactor/05-frontend-stack.md`
- `documentations/refactor/06-visual-design-direction.md`
- `documentations/refactor/12-phase-4-local-first-web-api.md`
- `documentations/refactor/13-phase-5-react-race-hub.md`
- `documentations/refactor/screens/index.html`
- `documentations/refactor/screens/race-hub.html`
- `documentations/refactor/screens/live-timing.html`
- `documentations/refactor/screens/mobile-live.html`
- `internal/web/racehub.go`
- `internal/query/racehub.go`

## Goal

Add the first production React frontend slice for Race Hub. Keep the existing
Go-served static Web UI working while the React route matures.

## Required Work

1. Add a Vite + React + TypeScript frontend foundation.
2. Use TanStack Query for API loading.
3. Use TanStack Router unless there is a clear reason to choose React Router.
4. Build a Race Hub screen backed by:

   ```text
   /api/v1/race-hub?session_key=...
   ```

5. Show:
   - meeting/session header;
   - source/dataset status strip;
   - classification table;
   - starting grid table;
   - driver/team identity treatment;
   - missing/partial dataset states;
   - desktop and phone-responsive layouts.
6. Keep old Web UI routes/assets intact.
7. Add at least basic tests or a smoke check.
8. Document how to run the React dev server and how it connects to the Go API.

## Design Guardrails

- Make it feel F1-native and operational, not like a generic SaaS dashboard.
- Avoid card sludge.
- Avoid decorative gradients, blobs, fake hero sections, and meaningless chrome.
- Prefer dense, scan-friendly timing-wall ergonomics.
- Use team colors as structured data accents.
- Do not put cards inside cards.
- Build mobile intentionally; do not just squeeze desktop.
- Use icons where appropriate, but do not overdecorate.

## Backend Guardrails

- Do not rewrite ingestion.
- Do not persist live SignalR data.
- Do not replace all Web endpoints.
- Make only small API tweaks if integration reveals a real contract problem.
- Preserve the existing static Web UI until the React slice is credible.

## Verification

Run the relevant frontend checks you add, plus:

```bash
go build -o /tmp/box-box ./cmd/main.go
```

If dependencies need to be installed, use the repo's package manager choice and
record the commands in your final response.

## Final Response

Report:

- frontend package/files added;
- dev command and URL;
- API endpoint used;
- tests/smoke checks run;
- screenshots or notes about desktop/mobile behavior if available;
- any backend contract issues discovered.
