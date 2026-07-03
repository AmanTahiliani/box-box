# Local Review Packet: Issue #9 / PR #32

Reviewer harness: Codex
Implementer harness: Codex
Result: PASS WITH CAVEATS
Generated: 2026-07-03

## Scope Reviewed

PR #32 implements issue #9: web live track map on `/live`, with SignalR Position/CarData ingestion, a throttled `positions` SSE event, cached track outline bounds, SVG car dots, and tap telemetry.

## Local Gates

- PASS: `go test ./internal/live ./internal/web`
- PASS: `npm run test` in `frontend/` (22 files, 182 tests)
- PASS: `npm run build` in `frontend/` (`tsc --noEmit && vite build`)
- PASS: `npm run test:e2e` (26/26)
- CAVEAT: `npm run test:visual` passed 11/12; failed existing mobile Data Library snapshot due page-height/image diff. Not specific to the live track-map surface.

## Acceptance Criteria Review

- PASS: `/live` renders a track map with outline and team-colored car dots in a mocked live session.
- CAVEAT: real live-session overlay alignment remains unverifiable offline; this still needs first-session verification against actual Position.z data.
- PASS: selecting a car shows telemetry: speed, throttle, brake, DRS, gear.
- PASS: off-track/stopped cars are visually distinguished in the mocked track-map screenshot.
- PASS: graceful no-live-session state captured on desktop and mobile.
- PASS: source check shows `/api/v1/track-outline` uses cached/local outline data; live path does not add direct OpenF1 calls during active session.

## Visual Artifacts

Open the local gallery:

```bash
open /Users/aman/HomeBase/Projects/Personal/box-box/.review/issue-9-pr-32/index.html
```

Screenshots:

- `/Users/aman/HomeBase/Projects/Personal/box-box/.review/issue-9-pr-32/screenshots/live-track-map-desktop.png`
- `/Users/aman/HomeBase/Projects/Personal/box-box/.review/issue-9-pr-32/screenshots/live-track-map-mobile.png`
- `/Users/aman/HomeBase/Projects/Personal/box-box/.review/issue-9-pr-32/screenshots/live-empty-desktop.png`
- `/Users/aman/HomeBase/Projects/Personal/box-box/.review/issue-9-pr-32/screenshots/live-empty-mobile.png`

Visual diff artifact:

- `/Users/aman/HomeBase/Projects/Personal/box-box/.review/issue-9-pr-32/artifacts/visual-diff/data-library-diff.png`

## Notes

The ticket-specific visual capture used mocked `/api/v1/live/state`, `/api/v1/live/stream`, and `/api/v1/track-outline` responses. The screenshot verifies the frontend behavior and shape contract, but not actual F1 coordinate alignment.
