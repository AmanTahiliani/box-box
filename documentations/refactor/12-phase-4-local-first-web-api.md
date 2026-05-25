# Phase 4 Local-First Web API

## Purpose

Phase 4 makes the Web API start behaving like a local-first product. Phases 2
and 3 created the domain store and explicit ingestion path; this phase adds
read models that prefer local SQLite data and report data availability honestly.

This is still a backend phase. Do not start React yet.

## Manager Decision

Build one credible local-first Race Hub API slice before replacing the frontend.
The current Web UI can keep working from the existing endpoints, but the backend
should expose store-backed responses that a future React Race Hub can trust.

Phase 4 should add:

- store-backed read models for ingested meetings, sessions, drivers, results,
  and grid;
- dataset/status metadata so the UI knows what is local, missing, or stale;
- optional small API fallbacks only when explicitly requested;
- tests for local-first behavior without network.

## Package Boundary

Prefer adding a backend read-model layer instead of embedding SQL inside HTTP
handlers.

Recommended shape:

```text
internal/query/
  racehub.go       Race Hub read model assembly
  metadata.go      dataset availability/source metadata
  query_test.go    temp-db tests
```

Then wire `internal/web` to use that layer.

If the implementation keeps the read layer inside `internal/web` temporarily,
it must still avoid duplicating store SQL across handlers.

## Initial API Scope

Add a new Race Hub endpoint:

```text
GET /api/v1/race-hub?session_key=9472
```

Response should include:

- meeting;
- session;
- drivers;
- session results enriched with driver/team fields;
- starting grid enriched with driver/team fields;
- dataset availability metadata.

Recommended metadata shape:

```json
{
  "source": "local",
  "session_key": 9472,
  "datasets": {
    "meeting": {"status": "available", "source": "local"},
    "session": {"status": "available", "source": "local"},
    "drivers": {"status": "available", "source": "local", "count": 20},
    "results": {"status": "missing", "source": "none", "count": 0},
    "starting_grid": {"status": "available", "source": "local", "count": 20}
  }
}
```

Exact field names can vary, but the response must make missing datasets visible
instead of silently returning empty app states.

## Existing Endpoint Policy

Do not rewrite every existing endpoint yet. It is enough to:

- add the new local-first Race Hub endpoint;
- optionally make `/api/v1/meetings`, `/api/v1/sessions`, `/api/v1/drivers`,
  `/api/v1/results`, and `/api/v1/grid` read from local data when present;
- preserve old OpenF1 behavior when local data is absent unless the request asks
  for local-only behavior.

Recommended query controls:

```text
?source=local       local only; no OpenF1 fallback
?source=auto        local first, existing OpenF1 fallback when missing
```

Default should be conservative for existing endpoints. The new Race Hub endpoint
can default to local-first with honest missing metadata.

## Server Wiring

`web.Server` currently only receives `*api.OpenF1Client`. Add an optional
`*store.Store` or query service so Web mode can read the domain DB.

CLI/server behavior should remain simple:

```bash
go run cmd/main.go --web
go run cmd/main.go --web --db /path/to/boxbox.db
```

If the DB does not exist or has no ingested data, Web mode should still start.

## Non-Goals

Do not include these in Phase 4:

- React/Vite frontend setup.
- replacing the current static Web UI;
- automatic ingestion from Web browsing;
- live SignalR persistence;
- laps/stints/pits/weather/race-control read models unless the store schema is
  expanded and tested first.

## Acceptance Criteria

Phase 4 is complete when:

- a local-first Race Hub endpoint exists;
- it can return ingested session data without OpenF1 calls;
- it reports missing datasets explicitly;
- Web mode can be pointed at a domain DB with `--db`;
- offline tests cover the read model and HTTP handler behavior;
- focused tests and build pass.

## Next Phase After This

Phase 5 is the first frontend implementation phase. That is the point to switch
from Cursor to Claude for React/UI work.
