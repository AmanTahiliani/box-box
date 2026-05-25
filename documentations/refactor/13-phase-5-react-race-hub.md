# Phase 5 React Race Hub

## Purpose

Phase 5 begins the production Web UI. The backend now has the foundation needed
for a local-first Race Hub: live timing is shared, a domain store exists,
ingestion can populate it, and `/api/v1/race-hub` can read from local data with
dataset metadata.

This is the point to switch from Cursor to Claude for frontend/UI work.

## Manager Decision

Start with a focused React Race Hub slice, not a full app rewrite. The goal is
to prove the chosen frontend stack, visual language, responsive layout, and API
contract against the new local-first backend.

Keep the old Web UI available until the React route is credible.

## Scope

Add a Vite + React + TypeScript frontend foundation and build a first Race Hub
route around:

- meeting/session header;
- dataset/source status strip;
- classification table;
- starting grid table;
- driver/team color treatment;
- missing dataset states;
- compact Race Hub navigation shell;
- responsive desktop, tablet, and phone layouts.

Use `/api/v1/race-hub?session_key=...` as the primary API.

## Stack Defaults

- Vite
- React
- TypeScript
- TanStack Query
- TanStack Router, unless integration cost argues for React Router
- D3 only for bespoke charts later; do not use it for basic layout tables
- Vitest for component/unit tests
- Playwright for at least one smoke path if practical

## Visual Direction

Follow the existing mockups in `documentations/refactor/screens/`, but treat
them as direction, not rigid specs.

The UI should feel like an F1 operations room:

- dense but readable;
- technical, not generic SaaS;
- restrained use of panels;
- no card sludge;
- no decorative gradient blobs;
- strong timing-table ergonomics;
- team colors used as data, not wallpaper;
- mobile views designed directly, not merely squeezed desktop.

## Integration Policy

Do not rip out the existing static Web UI on day one. Add the React app in a way
that can coexist while the route is built and tested.

Acceptable approaches:

- add a Vite app under a dedicated frontend directory and document the dev flow;
- serve built assets from Go only after the React slice is stable;
- expose a `/react` or equivalent route temporarily if needed.

The implementation should avoid large backend changes except for tiny API
contract fixes discovered while integrating.

## Non-Goals

Do not include these in Phase 5:

- full replacement of every existing Web screen;
- live timing React rewrite;
- ingest UI;
- settings UI;
- full season/calendar rebuild;
- new backend ingestion features;
- persistence of live SignalR events.

## Acceptance Criteria

Phase 5 is complete when:

- the React app can run locally;
- a Race Hub screen loads from `/api/v1/race-hub`;
- available and missing datasets are visibly distinct;
- the layout is usable on desktop and phone widths;
- tests or smoke checks cover the Race Hub happy path;
- the old Web UI still works.

## Next Phase After This

Phase 6 should expand the React app around the Race Hub: strategy chart,
position evolution, lap comparison, and richer Data Library/status workflows.
