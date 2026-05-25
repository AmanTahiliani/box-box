# Prompt For Cursor: Phase 11 Weekend Ingestion

You are working in the `box-box` repository on Phase 11. The Web UI can now
browse local years, meetings, and sessions. Your task is to make the CLI able
to populate a whole race weekend/meeting in one backend ingestion flow.

## Read First

Open these files first:

- `documentations/refactor/19-phase-11-weekend-ingestion.md`
- `cmd/main.go`
- `internal/ingest/ingest.go`
- `internal/ingest/ingest_test.go`
- `internal/ingest/openf1.go`
- `internal/store/meetings.go`
- `internal/query/navigation.go`

Only open older docs if you are blocked.

## Goal

Make meeting/weekend ingestion useful for the local-first Web UI. A user should
be able to ingest a meeting and have all sessions for that meeting populated
with Race Hub datasets where available.

## Current Shape

The project already has:

- `--ingest-year`
- `--ingest-meeting`
- `--ingest-session`
- session-level Race Hub ingestion datasets;
- local navigation APIs and UI that depend on ingested meeting/session data.

Confirm the exact current behavior before editing. If `--ingest-meeting`
currently only stores meeting/session metadata, extend it or add a clearly named
flag. Prefer the least surprising CLI behavior.

## Work To Do

1. Add meeting/weekend orchestration that fetches sessions for a meeting and
   ingests Race Hub datasets for each session.
2. Preserve single-session ingestion behavior.
3. Return/report per-session summaries clearly.
4. Keep raw payload provenance for all fetched endpoints.
5. Make partial failures visible without erasing successful session data.
6. Add focused offline tests with fake sources.

## Guardrails

- Do not fetch OpenF1 from React.
- Do not introduce background ingestion from normal page views.
- Do not persist high-volume car telemetry in this phase.
- Do not break existing e2e seed behavior.
- Keep completed historical sessions as the default mental model.

## Verification

Run:

```bash
go test ./internal/ingest/... ./internal/store/... ./internal/query/... ./internal/web/...
go build -o /private/tmp/box-box ./cmd/main.go
cd frontend && npm test -- --run
cd frontend && npm run build
npm run test:e2e
```

## Report Back

Summarize:

- files changed;
- CLI behavior added or changed;
- tests run and results;
- follow-up risks, especially around OpenF1 rate limits or partial sessions.
