# Phase 15: Command Center V1

## Goal

Make the Web UI default route a useful local-first operations screen instead of
requiring users to know a raw Race Hub session key.

## Completed Scope

- Added `/` as the Command Center route.
- Added a top-level Command nav item while preserving Race Hub, Live, and Data
  Library routes.
- Shows local season coverage, weekend coverage, local session counts, and live
  availability.
- Selects a focus weekend from local data using current, upcoming, then recent
  weekend priority.
- Provides quick actions into Live Timing, Race Hub for the default local
  session, and Data Library.
- Lists recent local sessions with direct Race Hub links.
- Added unit coverage for schedule selection helpers and the Command Center
  page.
- Added Playwright E2E and production smoke coverage for `/`.
- Added visual regression coverage for Command Center at desktop, tablet, and
  mobile viewports.

## Constraints

- React continues to call only local-first Go APIs; no direct OpenF1 reads were
  added.
- Live state remains read-only status from the existing Web live endpoint.
- The page stays dense and operational rather than becoming a marketing landing
  page.

## Verification

```bash
npm --prefix frontend test -- --run
npm --prefix frontend run build
npm run test:e2e
npm run test:e2e:prod
npm run test:visual
npm run test:visual:prod
```

## Related

- [21 MVP Completion Checklist](21-mvp-completion-checklist.md)
- [22 Phase 14 Visual Regression](22-phase-14-visual-regression.md)
