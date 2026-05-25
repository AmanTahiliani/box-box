# Frontend Stack

## Summary

The next Web UI should move from embedded Alpine/static assets to a real React
application. The target is a local-first, data-heavy, live-updating race
dashboard served by the Go backend.

## Current Web UI

Current stack:

- Go `net/http` server.
- Go `embed.FS` static assets.
- Plain HTML/CSS/JavaScript.
- Alpine.js from CDN.
- D3.js from CDN.
- Hash routing.
- Raw `fetch`.
- `EventSource` for live SSE.
- No frontend build system.
- No TypeScript.
- No package-managed frontend dependencies.

This is a good prototype shape but not a good long-term foundation for the
planned Web UI.

## Recommended Stack

### Vite

Purpose:

- Frontend dev server.
- Fast TypeScript build.
- Production asset bundling.
- Clean integration with Go embedded static assets.

### React

Purpose:

- Component model for complex screens.
- Good fit for live timing, charts, tables, filters, replay controls, and
  persistent interaction state.

### TypeScript

Purpose:

- Stronger contracts for OpenF1, local API, and live timing payloads.
- Safer refactors.
- Better developer experience across data-heavy UI.

### TanStack Query

Purpose:

- Server-state fetching and caching.
- Loading/error/stale states.
- Background refresh.
- Clear handling of local DB data, API fallback, and partial data.

### Router

Preferred candidates:

- TanStack Router for stronger type safety.
- React Router if simplicity and familiarity matter more.

Routes should model product workflows rather than mimic current hash routing.

### D3

Purpose:

- Bespoke F1 visuals:
  - Strategy charts.
  - Track maps.
  - Position evolution.
  - Lap-time comparison.
  - Gap history.
  - Telemetry traces.

D3 should be used where the visual is genuinely custom. Simpler chart libraries
can be considered later for generic charts.

### Zustand

Optional.

Purpose:

- Local UI preferences and cross-screen client state:
  - Pinned drivers.
  - Density mode.
  - Selected comparison drivers.
  - Visible live panels.
  - Replay speed.

Avoid adding it until React state and URL state become awkward.

### Testing

Vitest:

- Formatting helpers.
- Data transforms.
- Race calculations.
- Chart input shaping.

Playwright:

- Page routing.
- Race Hub rendering.
- Live SSE behavior with mocked events.
- Responsive layouts.
- Data Library states.

## Why Not Astro As The App Shell

Astro is excellent when pages are mostly static and only specific islands need
JavaScript. `box-box` is primarily an interactive application:

- Live timing updates.
- SSE streams.
- Dense tables.
- Replay scrubbers.
- Driver pinning.
- Interactive charts.
- Local-first data states.

Astro could wrap React islands, but most important screens would become React
islands anyway. That adds split architecture without much benefit for this app.

Astro may still be useful for:

- Public docs.
- A marketing/project site.
- Static release notes.

For the product UI, Vite + React + TypeScript is the cleaner fit.

## Build Integration

Target behavior:

- During frontend development, Vite serves the React app.
- During normal `go run cmd/main.go --web`, Go serves compiled frontend assets.
- The backend remains responsible for SQLite, ingestion, OpenF1, SignalR, REST,
  and SSE.

