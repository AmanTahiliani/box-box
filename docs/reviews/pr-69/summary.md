# PR #69 — Race Story polish review

Result: **NEEDS CHANGES**

- Reviewer harness: Codex, including browser QA against the hermetic seeded preview
- Implementer harness: Cursor
- Scope: issue #68 — Race Story UX polish

## Blocking findings

1. **Existing E2E coverage fails.** `npm run test:e2e` has one failure in `tests/race-hub.spec.ts`: it still expects the existing missing-positions notice, but the PR replaces it with new empty-state copy without updating the E2E assertion. The issue's definition of done requires existing suites to stay green.
2. **Chapter selection is not visibly synchronized for data with partial position coverage.** Browser QA on the seeded `session_key=9472` route showed that clicking either chapter leaves both cards unhighlighted. `chapterStartScrub` clamps a chapter outside the position chart's time window to 0 or 1, while `activeChapterIndex` checks the unclamped timestamps. The scrubber and active card therefore disagree. This is a direct miss on the active-chapter highlight/jump acceptance criterion.

## Gates

- `go test ./...` — pass
- `npm run test` — pass, 393/393 across 51 files
- `npm run build` — pass (`tsc --noEmit` + Vite build)
- `npm run test:e2e` — **fail**, 27/28 (missing-positions assertion)
- `npm run test:visual` — pass, 15/15 including new Race Story snapshots
- `git diff --check origin/main...HEAD` — pass
- Browser QA — desktop and mobile rendered without console warnings/errors; the map control was correctly absent when seeded replay data was unavailable

## Visual artifacts

- `screenshots/race-story-desktop.png`
- `screenshots/race-story-mobile.png`

## Acceptance-criteria assessment

- Chapter-strip styling, scroll affordances, cards, and responsive layout: visually verified
- Segmented playback controls: visually verified
- Map unavailable state: verified; no dead panel or map toggle in seeded data
- Graph full-width fallback and responsive rendering: visually verified
- Chapter band/axis/label polish: present in the rendered chart
- Empty-state card pattern: present
- Active chapter highlight synchronization: **not met in browser QA**
- Existing test suites stay green: **not met** (one E2E failure)

## Non-blocking note

The PR adds shared empty-state styles to `frontend/src/styles/app.css`, although the issue explicitly says not to edit that file. Keep the fix scoped to the Race Story style files if practical.
