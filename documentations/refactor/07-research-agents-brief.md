# Research Agents Brief

## Summary

Before implementation tickets are written, dedicated research agents should
investigate the uncertain parts of the refactor. Their outputs should feed a
product/architecture planning pass that turns findings into phased work.

Each research track should separate confirmed facts, assumptions, risks, and
recommendations.

## 1. OpenF1 Contract Research

Objective:

- Document the exact OpenF1 endpoint contract needed by `box-box`.

Inputs:

- Existing `internal/api` client.
- OpenF1 docs: https://openf1.org/docs/
- Current app screens and planned Race Hub requirements.

Outputs:

- Endpoint inventory.
- Field/schema notes.
- Update cadence by endpoint.
- Auth/free-tier behavior.
- Rate-limit and lockout notes.
- Essential vs optional datasets for v1.

Key questions:

- Which endpoints are immutable after session completion?
- Which endpoints are high-volume enough to require explicit ingestion?
- What errors are returned during live-session lockout?
- Which endpoints can be filtered to reduce ingestion cost?

## 2. Official F1 Live Timing Research

Objective:

- Document the SignalR live feed contract and parser risks.

Inputs:

- Current `internal/ui/official_live.go`.
- SignalR endpoint: https://livetiming.formula1.com/signalr
- OpenF1.Data package notes:
  https://www.nuget.org/packages/OpenF1.Data/1.0.87

Outputs:

- Topic inventory.
- Payload examples where available.
- Parser fragility notes.
- Recommended domain event/state model.
- Testing strategy for non-live periods.

Key questions:

- Are current subscribed topics sufficient for the planned Web live mode?
- Which topics should be parsed as events vs current state?
- How should disconnections and reconnections be represented?
- Should live snapshots/events be persisted?

## 3. Static Archive Feasibility Research

Objective:

- Determine whether official F1 static archived timing files should become a
  supported source.

Inputs:

- LiveF1 data topic reference:
  https://livef1.goktugocal.com/livetimingf1/data_topics.html
- Public static archive URL patterns.
- OpenF1 meeting/session metadata.

Outputs:

- Feasibility assessment.
- Session path mapping strategy.
- Available years/session types.
- Topic/file inventory.
- Risks and legal/operational considerations.

Key questions:

- Can OpenF1 sessions be mapped reliably to static archive paths?
- Are static archive files available consistently?
- Which files provide replay-quality timing?
- Is this source stable enough for v1 or later only?

## 4. SQLite Schema And Indexing Design

Objective:

- Turn the domain database design into a concrete schema proposal.

Inputs:

- `03-database-design.md`.
- Existing `internal/models/types.go`.
- Race Hub and Live Replay query requirements.

Outputs:

- Table definitions.
- Primary keys and foreign keys.
- Index proposal.
- Raw payload strategy.
- Migration strategy.
- High-volume data retention recommendations.

Design questions:

- Which tables need composite primary keys?
- Which read paths need covering indexes?
- Should telemetry/location be optional datasets?
- Should derived read-model tables exist in v1?

## 5. Backend API And Read-Model Design

Objective:

- Design the Web API shape that React will consume.

Inputs:

- Existing `internal/web/api.go`.
- Planned Web screens.
- Store/query requirements.

Outputs:

- Endpoint proposal.
- Response envelope proposal.
- Source/staleness metadata shape.
- Error/partial-data behavior.
- Migration strategy from existing endpoints.

Design questions:

- Should existing `/api/v1` routes be preserved and expanded?
- What metadata should every response include?
- How should partial data be represented?
- Which read models should be backend-computed vs frontend-computed?

## 6. F1-Native Visual System Research

Objective:

- Produce visual principles and examples for the React UI before components are
  built.

Inputs:

- `06-visual-design-direction.md`.
- F1 broadcast timing graphics.
- FIA timing/result sheets.
- Motorsport telemetry and timing tools.

Outputs:

- Moodboard or written reference guide.
- Layout principles.
- Typography and density guidance.
- Color usage rules.
- Anti-pattern list.

Key questions:

- How should the app look F1-native without copying official branding?
- What visual hierarchy makes live timing fastest to scan?
- How should phone/iPad layouts differ from desktop?
- How can the UI avoid generic card-heavy dashboard design?

## 7. Testing Strategy Research

Objective:

- Define a test strategy for backend, ingestion, frontend, and live behavior.

Inputs:

- Existing tests.
- Planned store/ingestion architecture.
- Live feed limitations outside active sessions.

Outputs:

- Backend unit/integration test plan.
- Ingestion fixture strategy.
- Frontend Vitest and Playwright strategy.
- Mock SSE/live fixture plan.
- Manual acceptance checklist.

Key questions:

- How should live SignalR behavior be tested without an active session?
- What source payload fixtures are needed?
- Which scenarios require real OpenF1 integration tests?
- How should local DB migrations be tested?
