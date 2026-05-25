# Evolution Roadmap: box-box for F1 Fanatics

This document outlines the strategic evolution of **box-box** to transition from a high-quality dashboard to a "Mission Control" and "Analysis Lab" for hardcore F1 fans.

---

## 1. Live Session: "Mission Control"
*Goal: Enhance the viewing experience with real-time strategist-grade insights.*

### High-Impact Features
*   **Command Center View**: A unified, dense dashboard combining the live timing tower, auto-detected battles, track status, weather, and race control into one glanceable screen.
*   **Quali Hunter Mode**: Specifically for qualifying—tracking "banker" vs "push" laps, purple/green sector watches, traffic density alerts, and live "on the bubble" cutoff lines.
*   **Strategy Watch**: Real-time undercut/overcut threat detection. Visualizing the "pit window" not just as a static number, but as a dynamic "rejoin position" gap on the timing tower.
*   **Focus Mode**: Ability to "pin" 2-3 drivers to the top of the tower to monitor their specific gap trends, tyre age offsets, and lap-time deltas.
*   **Chaos Meter**: A heuristic-driven indicator of "likelihood of a safety car/incident" based on bunching, weather shifts, and recent yellow sector frequency.

---

## 2. Between GPs: "The Analysis Lab"
*Goal: Provide deep-dive tools for "nerding out" on data during the off-week.*

### High-Impact Features
*   **Telemetry Lab**: Side-by-side comparison of two drivers or two laps using `CarData` (Speed, Throttle, Brake, Gear, DRS). Visualized as synchronized traces.
*   **Stint & Tyre Explorer**: Detailed degradation curves. Visualizing pace drop-off over a stint and comparing "Tyre Whisperer" performance between teammates.
*   **Season Storylines**: Progression charts for points, qualifying head-to-heads, and "average finish" trends across the season.
*   **Driver Dossiers**: Historical performance profiles—which tracks a driver excels at, their wet-weather "rating," and comeback statistics (positions gained).
*   **Track DNA**: Corner-speed profiles and overtaking difficulty maps for every circuit on the calendar.

---

## 3. UI/UX & Technical Refinements
*Goal: Professionalize the "Mission Control" aesthetic and improve ergonomics.*

*   **Layout Toggles**: Switch between `Broadcast` (clean, high-level), `Dense` (standard dashboard), and `Analyst` (maximum data density).
*   **Event Rail**: A horizontal timeline of the session showing Pits, Overtakes, Yellow Flags, and Team Radio icons.
*   **Aggressive Pre-fetching**: Use the time *before* the 30-minute API lockout to cache all necessary historical context, track maps, and driver bios to keep the app rich during live sessions.
*   **Narrative Heuristics**: Auto-generated status strings like "Verstappen is in the hunting phase" or "Hamilton tyre cliff imminent" based on lap-time trends.

---

## 4. Senior Engineer's "Top Pick" (Most Benefit)

If we were to prioritize only one major evolution, the **Telemetry Lab (Telemetry + Stint Comparison)** brings the most unique value to a TUI.

**Why?**
1.  **Unique Value**: Most free apps show results; almost none show interactive terminal-based telemetry traces.
2.  **Code Readiness**: The `CarData` and `Lap` models are already in the codebase. The API client already knows how to fetch them.
3.  **Fan Engagement**: It turns the app from a "during the race" tool into a "all week long" tool. Fans love debating *where* a driver lost time (e.g., "He was 5km/h slower through Turn 4"), and a Telemetry Lab proves it.
4.  **Technical Sophistication**: It demonstrates the power of the Go/Bubble Tea stack to handle dense, high-frequency data visualizations in a terminal.
