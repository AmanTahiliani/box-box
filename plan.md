# box-box Roadmap

A living document tracking the evolution of box-box from a solid F1 terminal dashboard into the ultimate pit wall companion.

---

## Phase 1 — "Pit Wall Mode" (Enhance What Exists)

Enrich existing tabs with data that's already available from the API but not yet rendered. Zero or minimal new API calls — prioritizes computed insights from data we already fetch.

- [x] **Starting Grid View** — Show qualifying lap times and grid order in Race Detail tab (secondary data tier, Race sessions only)
- [x] **Tyre Degradation Analysis** — Compute deg rate per stint from existing laps + stints data in Driver Detail. Show pace drop-off, stint consistency, and degradation sparklines
- [x] **Sector & Speed Analysis** — Sector time sparklines (S1/S2/S3) and speed trap trends from existing lap data in Driver Detail
- [x] **Gap Trend Sparklines in Live Feed** — Track gap-to-leader history per driver over WebSocket updates. Show mini trend indicator in the timing tower during races

---

## Phase 2 — "Race Director" (Killer Features)

New views that reconstruct the race narrative and make box-box indispensable during a live session.

- [x] **ASCII Track Map** — Render track outline from Location data with live car positions colored by team
- [x] **Race Replay / Lap Scrubber** — Step through a completed race lap-by-lap with full context (positions, pits, RC messages, weather). Arrow keys scrub, showing the field evolve over time
- [x] **Battle Tracker** — Auto-detect duels (drivers within DRS range) and show head-to-head gap analysis, pace comparison, and pit strategy divergence
- [x] **Pit Window Calculator** — Predict rejoin position if a driver pits now, based on current gaps + avg pit loss + estimated tyre deg rate

---

## Phase 3 — "Engineering Room" (Companion Web View)

A lightweight local web UI for visualizations that need a proper canvas.

- [x] **`box-box --web` server** — Spawn a localhost SPA from Go embedded assets, sharing the same SQLite cache
- [x] **SVG Track Map** — Animated car positions on a real circuit layout with team colors
- [x] **Telemetry Overlay** — Interactive throttle/brake/speed graph through a lap (D3.js or Canvas)
- [x] **Strategy Timeline** — Visual pit stop and stint timeline for the full field

---

## Phase 4 — "Always On" (Background Intelligence)

Passive monitoring and historical analysis features.

- [ ] **Daemon / Notification Mode** — `box-box --watch` sends OS notifications for key race events (flags, overtakes, pit stops)
- [ ] **Championship Simulator** — "What if" scenarios: set finishing positions per driver and project championship standings forward
- [ ] **Multi-Year Driver Comparison** — Career arc and season-over-season stats with win/pole rates
- [ ] **tmux / Status Bar Integration** — Compact race status output for shell prompts and status bars
