# Backend Architecture

## Summary

The backend should move from direct page handlers calling OpenF1 into a layered
local-first architecture. Source clients fetch data, ingestion persists it,
store/query packages expose domain reads, and Web handlers return read models
with source and freshness metadata.

## Proposed Package Boundaries

### `internal/store`

Owns SQLite as the local domain database.

Responsibilities:

- Schema creation and migrations.
- Typed upsert methods for domain records.
- Typed read methods for screens and backend services.
- Raw payload storage.
- Ingestion metadata and provenance.
- Transactions and batch writes.

Non-goals:

- Calling OpenF1 directly.
- Knowing Web UI route behavior.
- Rendering derived frontend-specific structures unless they are shared read
  models.

### `internal/ingest`

Coordinates backfill, refresh, and opportunistic fetches.

Responsibilities:

- Ingest year, meeting, or session.
- Fetch required endpoints through source clients.
- Persist raw payloads and normalized rows.
- Track partial successes and failures.
- Support resumable, idempotent runs.
- Respect rate limits and free-tier constraints.

Default ingestion modes:

- CLI bulk ingestion for years, meetings, and sessions.
- Opportunistic small fetches in Web mode when a user opens missing data.
- Explicit refresh mode for completed data when needed.

Rate-limit defaults:

- Bulk ingestion must be resumable and idempotent.
- Bulk ingestion should default to conservative sequential fetching with a
  delay between OpenF1 requests.
- Failed requests should use bounded exponential backoff with jitter.
- HTTP 429 and live-session lockout should pause or stop the current run rather
  than tight-loop retries.
- `--dry-run` should show planned datasets and estimated request count before a
  large ingest.

### OpenF1 Source Client Layer

The current `internal/api` client can remain, but it should become one source
adapter rather than the main application data layer.

Responsibilities:

- Build OpenF1 URLs.
- Apply auth headers when `OPENF1_API_KEY` exists.
- Decode source payloads into source/domain structs.
- Preserve stale fallback behavior where useful.

Future direction:

- Make source fetches observable by ingestion metadata.
- Avoid direct UI route dependency on source calls.

### Live Timing Bridge

The current live parser should be extracted out of `internal/ui` into reusable
backend/domain logic.

Responsibilities:

- Connect to official F1 SignalR.
- Parse topic payloads into typed live events/state.
- Maintain current live snapshot.
- Broadcast snapshots to Web clients through SSE.
- Feed TUI live mode without coupling parser code to Bubble Tea.
- Persist live events/snapshots as an append-only stream once the bridge is
  extracted.

Persistence policy:

- Live SignalR data should be stored separately from normalized post-session
  OpenF1 records.
- Live data represents what was broadcast at the time, not necessarily the
  corrected final historical record.
- A later reconciliation step can compare live stream data with OpenF1
  post-session records.

### Web API Read Models

Web handlers should become thin adapters from query services to JSON.

Responsibilities:

- Validate route/query parameters.
- Call local-first query/read services.
- Return consistent response envelopes.
- Include source/freshness metadata.

Suggested response metadata:

- `source`: `local`, `api`, `cache`, `live`, or `missing`.
- `last_ingested_at`.
- `is_stale`.
- `missing_datasets`.
- `errors` where partial data is returned.

### CLI Ingestion Commands

CLI commands should make bulk ingestion explicit and user-controlled.

Candidate commands/flags:

- `--ingest-year 2024`
- `--ingest-meeting <meeting_key>`
- `--ingest-session <session_key>`
- `--refresh`
- `--dry-run`

CLI output should include:

- What will be fetched.
- What is already local.
- What succeeded.
- What failed.
- Whether the run is resumable.

## Local-First Read Behavior

Default rule:

1. Read from local domain DB.
2. If missing and request scope is small, optionally fetch from OpenF1.
3. Persist successful fetches.
4. Return local/read-model data with metadata.
5. If OpenF1 is unavailable, return partial local data and clear missing/stale
   metadata rather than an empty page.

Examples:

- Opening a completed race with all local data should perform no OpenF1 calls.
- Opening a completed race with missing weather may opportunistically fetch only
  weather.
- Opening a whole season should not silently trigger a large backfill.
- During live-session lockout, historical pages should still render from local
  data.

## Opportunistic Fetch Policy

Allowed by default:

- Single meeting sessions.
- Single session results/grid/weather/race control.
- Small metadata gaps needed to render a screen.

Not allowed by default:

- Full season backfills.
- High-volume telemetry/location/car data.
- Repeated refresh loops during API lockout.
- Silent destructive refresh of completed local data.

## Migration Strategy

The existing SQLite HTTP cache should remain operational during the refactor.
The new domain database should be introduced without requiring users to delete
their current cache.

Default migration stance:

- Keep the current cache tables and stale fallback behavior intact.
- Introduce domain tables through `internal/store`.
- Prefer a separate domain database file at first if it materially reduces
  migration risk; using the same SQLite file remains acceptable if table names
  and migrations are carefully isolated.
- Do not attempt to transform arbitrary URL-keyed cache entries into domain rows
  automatically.
- New ingestion runs should populate domain tables from fresh source fetches or
  explicitly supported raw payloads.
- Web routes can migrate endpoint by endpoint from source-first to local-first.

## Failure Modes

The backend should explicitly represent:

- Local data available.
- Local data partial.
- Local data missing.
- OpenF1 locked/unavailable.
- Stale cache fallback used.
- Live feed connected/disconnected.
- Ingestion partial failure.

The Web UI should be able to show these states without guesswork.

## Open Questions

- Should API response envelopes be introduced globally or per endpoint during
  migration?
- How should source schema drift be detected and surfaced?
- What is the minimum dataset required for a Race Hub to be considered
  complete?
