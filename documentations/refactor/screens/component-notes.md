# Component Notes

Implementation reference for translating the static mockups into React components.
Each entry covers purpose, screens, data shape, and responsive behaviour.

---

## App Navigation — `<AppNav>`

**Purpose**: Persistent sticky top bar across all screens. Shows logo, route links, live status badge, and density toggle.

**Appears in**: All screens (always mounted).

**Props / data needed**:
```ts
interface AppNavProps {
  activePage: 'home' | 'live' | 'race-hub' | 'data-library' | 'standings' | 'drivers'
  isLive: boolean              // shows animated red dot + RACE/QUALI badge
  sessionLabel?: string        // e.g. "Monaco GP — Race"
  densityMode: 'default' | 'compact'
  onDensityChange: (mode) => void
}
```

**Responsive**: On phone (<768px), collapse nav links to icon-only or a hamburger. Live badge and density toggle remain visible. Session label moves to the session banner.

---

## Density Toggle — `<DensityToggle>`

**Purpose**: Switches between default and compact row heights. Effect is applied as a CSS class on `<html>`, not via React state cascade.

**Appears in**: `<AppNav>`.

**Implementation note**: Call `document.documentElement.classList.toggle('compact', ...)` directly. Store preference in `localStorage`. React state only tracks the value for rendering the active button — does not gate CSS.

**Responsive**: Always visible. Two-button [D][C] works at any width.

---

## Session Status Banner — `<SessionBanner>`

**Purpose**: Real-time session state strip: session name, current lap, session clock, track status, DRS state, fastest lap. Fed by SSE.

**Appears in**: `/live` (always visible at top, sticky). On phone, replaces AppNav as the primary context header.

**Props / data needed**:
```ts
interface SessionBannerProps {
  sessionName: string          // "Monaco GP — Race"
  lapCurrent: number
  lapTotal: number
  sessionClock: string         // "1:02:34"
  trackStatus: 'green' | 'yellow' | 'red' | 'sc' | 'vsc' | 'unknown'
  drsEnabled: boolean
  fastestLap?: { driverCode: string; lapTime: number; lap: number }
  airTemp: number
  trackTemp: number
  isConnected: boolean         // SSE connection state
}
```

**Critical state**: `isConnected: false` must show a visible DISCONNECTED indicator. Do not silently go stale.

**Responsive**: Horizontal scroll on narrow viewports. On phone, show session + lap + track status as minimum; other fields scroll off-screen.

---

## Timing Tower — `<TimingTower>`

**Purpose**: Dense real-time table. One row per driver. Driven by SSE. This is the primary surface of the live screen.

**Appears in**: `/live`.

**Props / data needed**:
```ts
interface TimingEntry {
  position: number
  driverCode: string
  driverNumber: number
  teamColor: string
  gap: string                  // "LEADER" | "+3.456" | "+1 LAP"
  interval: string             // "+3.456" | "—"
  tyre: 'S' | 'M' | 'H' | 'I' | 'W'
  tyreAge: number              // laps on current tyre
  lastLap: number              // seconds
  bestLap: number              // seconds
  s1State: 'pb' | 'ob' | 'slow' | 'none'
  s2State: 'pb' | 'ob' | 'slow' | 'none'
  s3State: 'pb' | 'ob' | 'slow' | 'none'
  isPitIn: boolean
  isPitOut: boolean
  hasFastestLap: boolean
  isDNF: boolean
}

interface TimingTowerProps {
  entries: TimingEntry[]
  pinnedDrivers: string[]      // driver codes
  fastestLapDriver: string
}
```

**Performance critical**: SSE ticks every 1–2 seconds. Memoize `<TimingRow>` by driver number. Diff at the entry level, not the full array. Use `React.memo` + stable references. Avoid full re-renders.

**Columns on phone**: P · Driver · Gap · Tyre · Last (hide Int, Age, Best, Sectors).
**Columns on iPad**: P · Driver · Gap · Int · Tyre · Age · Last (hide Best, Sectors).
**Columns on desktop**: All columns.

---

## Race Control Feed — `<RaceControlFeed>`

**Purpose**: Scrolling list of race control messages. Auto-scrolls to newest. Color-coded by message type (SC, VSC, DRS, penalty, fastest lap, flag).

**Appears in**: `/live` sidebar, `/race-hub` Race Control tab (static version).

**Props / data needed**:
```ts
interface RCMessage {
  id: string
  lap: number
  type: 'sc' | 'vsc' | 'drs' | 'penalty' | 'fl' | 'flag' | 'info'
  text: string
  timestamp: string
}

interface RaceControlFeedProps {
  messages: RCMessage[]
  autoScroll: boolean
}
```

**Responsive**: In `/live` sidebar on desktop. On phone, a full-screen panel accessed via bottom tab. In race-hub, inline full-width list.

---

## Battle Row / Battles Panel — `<BattlesList>`

**Purpose**: Shows detected on-track pairs with gap value and closing/stable/opening trend.

**Appears in**: `/live` sidebar.

**Props / data needed**:
```ts
interface Battle {
  aheadCode: string
  aheadTeamColor: string
  behindCode: string
  behindTeamColor: string
  gapSeconds: number
  trend: 'closing' | 'stable' | 'opening'
}

interface BattlesListProps {
  battles: Battle[]
}
```

**Responsive**: On phone, shown in the Battles bottom-tab panel alongside Pit Window.

---

## Pinned Driver Strip — `<PinnedStrip>`

**Purpose**: Compact horizontal cards for drivers the user has pinned. Shows position, gap, last lap, tyre state at a glance without scrolling the timing tower.

**Appears in**: `/live` (below session banner, above timing tower). Hidden on phone to preserve space.

**Props / data needed**:
```ts
interface PinnedCardData {
  driverCode: string
  teamColor: string
  position: number
  gap: string
  lastLap: string
  tyre: string
  specialState?: 'pit-out' | 'fastest-lap' | 'dnf'
}

interface PinnedStripProps {
  cards: PinnedCardData[]
  onUnpin: (driverCode: string) => void
}
```

**Responsive**: Desktop + iPad only. Hide on phone (<768px) — tower already shows all data.

---

## Pit Window Panel — `<PitWindowPanel>`

**Purpose**: For each driver with a notable stint age, shows current tyre, age, and pit window status (OPEN / SOON / OVERDUE / DONE). Computed from stint age and expected compound life.

**Appears in**: `/live` sidebar (third section after RC and Battles).

**Props / data needed**:
```ts
interface PitWindowEntry {
  driverCode: string
  teamColor: string
  tyre: 'S' | 'M' | 'H' | 'I' | 'W'
  tyreAge: number
  windowStatus: 'open' | 'soon' | 'overdue' | 'done'
}
```

**Note**: Window status logic lives in the backend or a pure TS utility — not component logic.

**Responsive**: Desktop sidebar. On phone, shown in Battles tab panel below battle list.

---

## Strategy Chart — `<StrategyChart>`

**Purpose**: D3-owned horizontal stint chart. One row per driver (top 10), colored blocks = tyre compound, width = laps. SC/VSC period shading. Lap counter axis.

**Appears in**: `/race-hub` Strategy tab.

**Props / data needed**:
```ts
interface Stint {
  compound: 'S' | 'M' | 'H' | 'I' | 'W'
  startLap: number
  endLap: number
}

interface StrategyDriver {
  code: string
  teamColor: string
  stints: Stint[]
}

interface StrategyChartProps {
  drivers: StrategyDriver[]
  totalLaps: number
  scPeriods: Array<{ start: number; end: number }>
  vscPeriods: Array<{ start: number; end: number }>
}
```

**D3 contract**: Component owns its SVG DOM node. Mount/update via `useEffect` with D3. Resize via `ResizeObserver`. No React inside the SVG.

**Responsive**: Full-width SVG with `viewBox`, scales with container. Label column width fixed. On narrow screens (< 480px), driver labels may need abbreviating.

---

## Position Evolution Chart — `<PositionEvolution>`

**Purpose**: D3-owned line chart. X = lap, Y = position (1 at top). One line per driver (top 6). SC/VSC period bands. End labels per driver.

**Appears in**: `/race-hub` Positions tab.

**Props / data needed**:
```ts
interface PositionPoint { lap: number; position: number }

interface PositionDriver {
  code: string
  color: string
  dashed: boolean        // true for teammate (same team color)
  points: PositionPoint[]
}

interface PositionEvolutionProps {
  drivers: PositionDriver[]
  totalLaps: number
  scPeriods: Array<{ start: number; end: number }>
  vscPeriods: Array<{ start: number; end: number }>
}
```

**D3 contract**: Same as StrategyChart — D3 owns the SVG, React manages data and container sizing.

**Responsive**: Full-width `viewBox` SVG. Right-side labels need right-padding.

---

## Dataset Status Indicator — `<DatasetStatus>`

**Purpose**: Shows completeness of local data for a session. Used in two modes: full grid (Race Hub Dataset tab, Data Library detail) and mini (Race Hub aside, API response metadata strip).

**Appears in**: `/race-hub` Dataset tab, `/race-hub` aside, `/data-library` detail panel. API response metadata.

**Props / data needed**:
```ts
type DatasetState = 'local' | 'partial' | 'missing' | 'stale' | 'live'

interface DatasetEntry {
  name: string           // e.g. "laps", "car_data_samples"
  state: DatasetState
  lastIngestedAt?: string
  error?: string
}

interface DatasetStatusProps {
  datasets: DatasetEntry[]
  variant: 'grid' | 'mini' | 'strip'
}
```

**Responsive**: Grid variant reflows to 1-column on phone. Mini variant stays compact at all widths. Strip variant is a horizontal overflow row (source strip in the sub-header).

---

## Ingest Command Block — `<IngestCommandBlock>`

**Purpose**: Displays one or more CLI ingest commands with syntax highlighting (comment lines, command lines). Not interactive — display only.

**Appears in**: `/race-hub` Dataset tab, `/data-library` detail panel.

**Props / data needed**:
```ts
interface IngestLine {
  type: 'comment' | 'command'
  text: string
}

interface IngestCommandBlockProps {
  lines: IngestLine[]
}
```

**Responsive**: Horizontal scroll on overflow. Monospace font required.

---

## Responsive Panel Shell — `<PanelShell>`

**Purpose**: Layout wrapper that switches between sidebar-on-right (desktop), stacked (tablet), and tab-driven (phone) based on viewport. Used in Live Timing and Race Hub.

**Appears in**: Used internally by `/live` and `/race-hub`.

**Props / data needed**:
```ts
interface PanelShellProps {
  main: React.ReactNode       // always visible
  aside: React.ReactNode      // sidebar on desktop, bottom on tablet
  phoneTabs?: Array<{         // only on phone — replaces aside with tabs
    id: string
    label: string
    icon: string
    content: React.ReactNode
  }>
  asideWidth?: number         // default 300
}
```

**Responsive**:
- Desktop (>1024px): `main | aside` grid
- iPad (769–1024px): `main | aside` with narrower aside
- Phone (<768px): `main` full-width + bottom tab nav switching aside panels

**Implementation note**: Density mode class on `<html>` flows through without prop drilling. `PanelShell` does not need to know about density — CSS handles it.

---

## Source/Freshness Strip — `<SourceStrip>`

**Purpose**: Inline metadata bar attached to API responses. Shows data source, last ingest time, staleness state, and list of missing datasets.

**Appears in**: Sub-headers of `/race-hub`, `/command-center` (data status for weekend), any screen that reads from the local DB.

**Props / data needed**:
```ts
interface SourceStripProps {
  source: 'local' | 'api' | 'cache' | 'live' | 'missing'
  lastIngestedAt?: string
  isStale?: boolean
  missingDatasets?: string[]
}
```

**Responsive**: Wraps on narrow viewports. Badges remain readable at any width.
