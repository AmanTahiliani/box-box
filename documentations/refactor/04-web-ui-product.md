# Web UI Product

## Summary

The Web UI should become the primary way to use `box-box`. The product should
feel like an F1 operations room: fast, dense when needed, precise, and native to
race-weekend workflows. It should work well on phone and iPad, while still
scaling into a richer desktop dashboard.

## Product Priorities

- Race-weekend first.
- Live Timing and Race Hub receive the highest polish.
- Historical pages should be local-first and reliable.
- Data availability should be visible, not mysterious.
- Density should be configurable.
- TUI live mode remains supported but does not require Web feature parity.

## Core Screens

### Command Center

Default landing screen.

Shows:

- Current or upcoming race weekend.
- Next session countdown.
- Live session state.
- Weekend schedule.
- Weather snapshot.
- Championship context.
- Local data availability.
- Shortcuts into Live Timing, Weekend, Race Hub, Standings, and Data Library.

### Season Calendar

Year-based browsing screen.

Shows:

- All meetings for the selected year.
- Round, country, circuit, date range.
- Upcoming/live/completed state.
- Local ingestion status.
- Key outcomes after completion: winner, pole, fastest lap where available.
- Filters for missing data, completed races, sprint weekends, and upcoming
  rounds.

### Weekend Page

One workspace per Grand Prix weekend.

Shows:

- Meeting metadata.
- Circuit and location.
- Session cards.
- Schedule and status.
- Dataset completeness.
- Entry points into each session view.

### Race / Session Hub

Main historical analysis workspace.

For races, prioritize the strategy story:

- Final classification.
- Starting grid and grid delta.
- Stint chart with compounds and pit stops.
- Safety car and VSC overlays.
- Position evolution.
- Lap-time comparison.
- Race-control timeline.
- Weather timeline.
- Driver race execution summaries.
- Replay scrubber with lap-by-lap standings and events.

For practice and qualifying:

- Classification.
- Best laps and sector breakdown.
- Lap progression.
- Driver comparison.
- Session events and weather context.

### Live Timing

Primary active-session screen.

Shows:

- Timing tower.
- Session clock, lap count, and track status.
- Position, gap, interval, tyre, tyre age, pit state.
- Last lap, best lap, sector state, DRS/track status where available.
- Race-control messages.
- Battles.
- Pit window predictions.
- Pinned drivers.
- Visual in-app alerts.

### Live Track View

Initially a mode inside Live Timing.

Shows:

- Circuit outline.
- Live car positions.
- Team/driver coloring.
- Selected/pinned driver focus.
- Mini timing list.
- Track/flag context where available.

### Drivers

Driver explorer.

Shows:

- Current season driver list.
- Driver profile data.
- Team, number, and headshot where available.
- Season points and trend.
- Race-by-race result table.
- Teammate comparison.
- Tyre/stint tendencies.
- Live pinned-driver mode during active sessions.

### Standings

Championship context screen.

Shows:

- Driver standings.
- Constructor standings.
- Points gaps.
- Movement since previous race.
- Race-by-race points accumulation.
- What changed after a selected Grand Prix.

### Data Library

Local data transparency screen.

Shows:

- Seasons available locally.
- Weekend and session dataset completeness.
- Missing datasets.
- Last ingested timestamps.
- Source/staleness state.
- Suggested ingestion commands.
- API lockout and stale cache explanations.

### Settings

Local app preferences.

Shows:

- Density mode.
- Theme accents.
- Preferred season.
- Pinned drivers.
- API key status.
- Data/cache path.
- Live alert preferences.

## Navigation Model

Primary flow:

```text
Season -> Weekend -> Session / Race Hub
```

Live shortcut:

```text
Command Center -> Live Timing -> Track / Battles / Pit Window / Race Control
```

Data/support flow:

```text
Data Library -> ingestion status / missing data
```

Candidate routes:

- `/`
- `/season/:year`
- `/weekend/:meetingKey`
- `/session/:sessionKey`
- `/live`
- `/drivers`
- `/drivers/:driverNumber`
- `/standings/:year`
- `/data`
- `/settings`

## Responsive Expectations

Phone:

- Stacked panels.
- Sticky session/status header.
- Bottom navigation.
- Swipeable live panels.
- Compact timing rows.

iPad:

- Split-pane layout.
- Timing plus side panel.
- Touch-friendly controls.
- Comfortable chart inspection.

Desktop:

- Dense multi-column operations layout.
- Persistent side panels.
- More simultaneous context.

Density modes should influence row height, visible columns, chart spacing, and
panel compactness.

