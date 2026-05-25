# box-box Refactor Brief

## Purpose

This directory captures the planning baseline for the next major evolution of
`box-box`. The current project has a strong live timing core, especially through
the official F1 live feed, but the rest of the app still behaves like an
on-demand OpenF1 client. That makes historical and session data unreliable,
especially during live-session API lockouts.

The refactor direction is to make the Web UI the primary product surface, make
historical data local-first, and preserve the TUI live mode that already works
well. These documents are intentionally strategic and research-ready. They are
not implementation tickets yet.

## Strategic Defaults

- Frontend: React + TypeScript, built with Vite.
- Backend: Go remains the application and API server.
- Storage: SQLite becomes a real local domain database, not only an HTTP cache.
- Historical ingestion: OpenF1 REST is the first ingestion/backfill source.
- Live timing: official F1 SignalR remains the live source.
- Ingestion model: explicit CLI backfill plus opportunistic small web fetches.
- TUI: preserve the current live mode; new historical/analytics work focuses on
  the Web UI first.
- Product stance: race-weekend first, local-first, no rushed implementation.
- Live persistence: persist live SignalR events/snapshots as a separate
  append-only stream once the live bridge is extracted; do not merge them into
  post-session OpenF1 records without a reconciliation design.
- Migration: keep the current raw HTTP cache behavior intact while introducing
  the new domain database incrementally.

## Documents

- [01 Data Sources](01-data-sources.md): current and candidate data sources,
  source authority, limitations, and open questions.
- [02 Backend Architecture](02-backend-architecture.md): proposed backend
  packages, local-first reads, ingestion policy, and live bridge boundaries.
- [03 Database Design](03-database-design.md): target SQLite strategy, raw
  payload storage, normalized tables, provenance, and research questions.
- [04 Web UI Product](04-web-ui-product.md): screen architecture, navigation,
  responsive behavior, and product priorities.
- [05 Frontend Stack](05-frontend-stack.md): React stack choice and supporting
  libraries.
- [06 Visual Design Direction](06-visual-design-direction.md): F1-native visual
  principles and anti-patterns to avoid.
- [07 Research Agents Brief](07-research-agents-brief.md): research tracks for
  dedicated agents before ticket planning.
- [08 V1 Scope and Phasing](08-v1-scope-and-phasing.md): first shippable
  milestone, non-goals, phase order, and early implementation sequence.
- [09 Phase 1 Live Extraction](09-phase-1-live-extraction.md): first coding
  slice, package boundaries, tests, acceptance criteria, and non-goals.
- [10 Phase 2 Store Foundation](10-phase-2-store-foundation.md): second coding
  slice for introducing the local SQLite domain store without changing product
  behavior.
- [11 Phase 3 Ingestion Foundation](11-phase-3-ingestion-foundation.md): third
  coding slice for OpenF1-to-store ingestion orchestration.
- [12 Phase 4 Local-First Web API](12-phase-4-local-first-web-api.md): fourth
  coding slice for store-backed Race Hub read models and Web API metadata.
- [13 Phase 5 React Race Hub](13-phase-5-react-race-hub.md): first frontend
  implementation slice for the production Web UI.
- [14 Phase 6 React Race Hub Analytics](14-phase-6-react-race-hub-analytics.md):
  next frontend slice for strategy, position, and richer Race Hub views.
- [15 Phase 7 Analytics Data Foundation](15-phase-7-analytics-data-foundation.md):
  backend slice for laps, stints, pits, race control, weather, and positions.
- [16 Phase 8 Analytics Visuals](16-phase-8-analytics-visuals.md): frontend
  slice for turning the newly available analytics datasets into useful Race Hub
  views.
- [17 Phase 9 Navigation Data API](17-phase-9-navigation-data-api.md): backend
  slice for local-first season/weekend/session navigation so users do not need
  raw session keys.
- [18 Phase 10 Navigation UI](18-phase-10-navigation-ui.md): frontend slice for
  adding local-first season/weekend navigation around Race Hub.
- [19 Phase 11 Weekend Ingestion](19-phase-11-weekend-ingestion.md): backend
  slice for making one command ingest a whole race weekend into the local DB.
- [20 Phase 12 Data Library UI](20-phase-12-data-library-ui.md): frontend slice
  for showing local ingestion coverage and next CLI actions.

## External References

- OpenF1 documentation: https://openf1.org/docs/
- Official F1 SignalR endpoint: https://livetiming.formula1.com/signalr
- LiveF1 timing topic reference:
  https://livef1.goktugocal.com/livetimingf1/data_topics.html
- OpenF1.Data package notes on F1 SignalR:
  https://www.nuget.org/packages/OpenF1.Data/1.0.87

## Current Repo Context

The existing application already has:

- A Go OpenF1 client in `internal/api`.
- A SQLite-backed raw HTTP cache and track outline persistence.
- A Bubble Tea TUI in `internal/ui`.
- A Go-served Web UI in `internal/web`.
- A live SignalR bridge extracted into `internal/live` and reused by both TUI
  and Web mode through server-sent events.

The refactor should build on that progress instead of replacing it blindly.
The goal is to separate source fetching, domain persistence, query/read models,
and frontend experience so each layer can be improved without destabilizing the
others.
