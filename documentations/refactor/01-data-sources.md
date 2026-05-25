# Data Sources

## Summary

`box-box` should treat data sources as inputs to a local product database, not as
page-level dependencies. The current app fetches too much data on demand from
OpenF1, which breaks down during free-tier lockouts and makes non-live screens
feel empty. The live mode succeeds because it uses the official F1 live timing
feed directly.

## Confirmed Sources

### OpenF1 REST API

Reference: https://openf1.org/docs/

Current usage:

- Meetings and sessions.
- Drivers.
- Championship standings.
- Session results and starting grid.
- Laps, stints, pit stops, positions, intervals.
- Race control, weather, overtakes.
- Car data, location, team radio metadata.

Strengths:

- Good historical/session data source.
- JSON over simple HTTP.
- Broad endpoint coverage.
- Query filtering by fields and time ranges.

Limitations:

- Free-tier access can be locked during live sessions.
- On-demand fetching is unreliable as a product behavior.
- API schema or access rules can change.
- High-volume endpoints can be expensive to fetch repeatedly.

Policy:

- Use OpenF1 primarily for ingestion and backfill.
- Do not make historical Web pages depend on fresh OpenF1 calls.
- Store successful fetches into the local domain database and raw payload log.

### Official F1 SignalR Live Feed

Endpoint: https://livetiming.formula1.com/signalr

Current code connects to the old ASP.NET SignalR protocol, negotiates a
connection token, opens a websocket, and subscribes to the `Streaming` hub.

Current subscribed topics:

- `Heartbeat`
- `TimingData`
- `DriverList`
- `LapCount`
- `ExtrapolatedClock`
- `TrackStatus`
- `RaceControlMessages`
- `WeatherData`
- `SessionInfo`
- `CurrentTyres`
- `TimingAppData`
- `TimingStats`

Strengths:

- Best current source for live timing.
- Provides race-control updates quickly.
- Avoids OpenF1 REST lockout during active sessions.
- Powers the strongest part of the existing app.

Limitations:

- Payloads are less formally documented than OpenF1.
- Topic schemas can drift.
- Testing live behavior is difficult outside active sessions.
- Current parser lives in `internal/ui`, which couples live source handling to
  the TUI layer.

Policy:

- Treat SignalR as the authoritative live source while a session is active.
- Extract parsing and live-state logic into reusable backend/domain code.
- Forward live state to the Web UI through SSE initially.
- Research whether live snapshots/events should be persisted.

### Existing SQLite HTTP Cache

Current location: user cache directory under `box-box/cache.db`.

Current behavior:

- Stores raw HTTP responses by URL.
- Applies TTL rules based on URL patterns.
- Can return stale responses when OpenF1 fails.
- Stores track outlines in a structured table.

Strengths:

- Useful as a fallback.
- Already integrated with the OpenF1 client.
- Reduces repeated network calls.

Limitations:

- Not a queryable domain model.
- URL keys are poor product identifiers.
- Cannot easily power analytics, replay, ingestion status, or data provenance.
- Pruning/TTL behavior is cache-oriented, not history-oriented.

Policy:

- Keep the raw cache as a fallback layer.
- Do not use it as the primary application database.
- Add a separate domain schema for product features.

## Candidate Source

### Official F1 Static Archived Timing Files

Reference:
https://livef1.goktugocal.com/livetimingf1/data_topics.html

Examples in public references include:

- `SessionInfo.json`
- `ArchiveStatus.json`
- `TrackStatus.jsonStream`
- `SessionData.json`
- `TyreStintSeries.json`
- `SessionStatus.json`
- `TimingDataF1.json`

Potential strengths:

- Could provide replay-quality archived live timing.
- May fill gaps between OpenF1 REST data and SignalR live data.
- May support historical race reconstruction.

Known uncertainties:

- Session path mapping must be researched.
- Stability and access guarantees are unclear.
- Topic schemas and file availability may vary by year/session.
- Legal and operational usage expectations need review.

Policy for now:

- Do not make core architecture depend on this source yet.
- Assign a dedicated research track to validate feasibility.
- If adopted, ingest it through the same raw-plus-normalized source pipeline.

## Source Authority Tiers

1. Local SQLite domain database.
   - Primary read source for Web UI historical and completed-session data.
2. Official F1 SignalR live feed.
   - Primary source during active sessions.
3. OpenF1 REST ingestion/backfill.
   - Primary source for populating local historical data.
4. Optional F1 static archive source.
   - Research candidate for richer replay and archived live timing.
5. Raw HTTP cache fallback.
   - Last-resort resilience layer, not a product data model.

## Open Questions

- Should SignalR snapshots/events be persisted during live sessions?
- If persisted, should live data become the authoritative record for that
  session or a supplemental event stream?
- Which OpenF1 endpoints are essential for v1 local-first Race Hub?
- Can static archived timing files be mapped reliably from OpenF1 sessions?
- What data should be refreshed after a session ends, and when should it become
  immutable?

