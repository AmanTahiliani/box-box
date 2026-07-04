# Lens overlay: Architect

Apply this **on top of** the base grill (`grill.md`). Bias every question toward
technical soundness and fit with the existing box-box architecture.

## box-box context to hold

- **Backend (Go):** `internal/api` (OpenF1 client, cache, 37 endpoints), `internal/web`
  (REST handlers + SSE hub, route table in `server.go`), `internal/store` (domain
  SQLite), `internal/query` (read models over the domain DB), `internal/ingest`,
  `internal/live` (SignalR).
- **Frontend (React+Vite+TS):** TanStack Router/Query, `src/api.ts` (typed fetchers),
  `src/types.ts` (payload mirrors), `src/lib` (client helpers), `src/pages`,
  `src/components` (incl. `components/live`).
- **Patterns to respect** (see CLAUDE.md "How To Extend"): ServeMux longest-prefix
  route ordering in `server.go`, cache TTL tiers, `?source=openf1|local|auto`
  resolution, two-phase standings load, lazy tab loads, stale-data fallback banner.

## Grill especially on

- **Reuse vs new:** does existing code already do this (a TUI equivalent in
  `internal/ui/*.go`, a query model, an `api.ts` fetcher)? Port vs rebuild.
- **Data flow & source:** OpenF1 live vs domain DB vs cache; payload size; rate
  limits; how `?source` is handled.
- **Seams:** which files/modules change; new endpoint (mind registration order!) vs
  extend an existing one; new component vs extend; where shared logic lives
  (`frontend/src/lib/*`).
- **Testability:** how does this land in `go test` / `vitest` / hermetic Playwright?
  What seam makes it testable without live OpenF1?
- **Risk:** domain-DB migrations, perf on large sessions, backward compat, and
  failure / stale-data behavior.

Keep questions concrete and decision-shaped — e.g. *"port the GPS normalization from
`internal/ui/trackmap.go`, or recompute in a shared `frontend/src/lib/trackmap.ts` so
it's unit-testable?"* — each with your recommendation.
