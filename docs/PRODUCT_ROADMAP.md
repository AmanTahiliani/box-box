# box-box — Product & UX Roadmap

> An F1-geek + product/UX analysis of box-box as an F1 companion, and a
> prioritized plan to make it richer than "data in tables" — for both live race
> weekends and the quiet stretch between rounds.

## Where the app is today (honest read)

box-box has a strong data layer with two front doors (TUI + web) and six web
surfaces:

| Surface | What it does today | Where it's thin |
|---|---|---|
| **Command Center** (`/`) | Hero weekend + countdown, season calendar, championship snapshot, weekend schedule, news | Strong launcher, but tells you *when*, rarely *what to care about*. It's a menu, not a companion |
| **Race Hub** (`/race-hub`) | Per-session tabs: Overview, Race Story (position-evolution scrubber), Strategy (stints), Laps, Conditions, Race Control | `RaceStoryCanvas` is the best "beyond tables" work in the app. Everything else is still tables |
| **Live Timing** (`/live`) | SSE timing tower, battle chips, gap sparklines, pinned drivers, RC feed | Solid tower, but it's "a spreadsheet that updates" — no track map, no telemetry, no "what just happened" |
| **Championship** (`/championship`) | Standings + hub stats (wins/poles/form) + points simulator | Good; the simulator is a genuine differentiator |
| **Briefing** (`/briefing`) | 7 RSS feeds (FIA, BBC, Autosport, RaceFans, Guardian, RACER, F1 YouTube) + readability extraction | Passive reading list, not tied to the season narrative |
| **Data Library** (`/admin`) | Ingestion / coverage admin | Fine as-is |

**Biggest finding:** the app already *pulls* the richest data in F1 — GPS
`Location`, full car telemetry (throttle / brake / DRS / gear / rpm / speed),
team-radio audio, mini-sector `Segments`, speed traps, overtakes — and the web
app visualizes almost none of it. The **track map exists only in the TUI**
(`internal/ui/trackmap.go`); telemetry is fetched and shown to nobody. This is a
large latent asset.

## Core product thesis

An F1 companion serves two different jobs; the app currently treats them the same
(data, in tables, per session):

1. **On a race weekend — the "second screen."** The user is watching the
   broadcast (or can't, and wants to *feel* it). They want: what's happening now,
   why it matters, what to watch next. The broadcast supplies emotion; box-box
   should supply **the data the broadcast doesn't show** — the delta the director
   cut away from, the undercut developing, the tyre cliff approaching.

2. **Between races — "understand the season."** No live action. The user wants to
   make sense of what happened and anticipate what's next: rewatch the story of
   the last race, argue strategy, track the title fight, get smart before the next
   round.

Everything below makes each job *feel* like a companion instead of a database.

---

## Race-weekend experience ("second screen")

### 1. Live Track Map — highest-leverage missing feature
Port the TUI's GPS outline (`trackmap.go`, `GetLocation`) to a web SVG dot-map:
cars as team-colored dots on the circuit outline, DRS zones highlighted, sectors
tinted by status. Turn mini-sectors purple/green live using the `Segments` data
already fetched. Tap a car → mini-telemetry readout. This is what turns "updating
spreadsheet" into "I'm watching the race."

### 2. "What just happened" synthesized event rail — the companion voice
Combine Race Control + overtakes + pit stops + position deltas into plain-English
beats: *"LAP 34 — VER pits (2.4s), rejoins P4 behind NOR — undercut on RUS is
live."* The inputs all exist; this is a synthesis layer, not new data. It's the
difference between *data* and *commentary*.

### 3. Telemetry compare overlay
On the tower / a driver panel, pick two drivers → overlaid speed/throttle/brake
traces + delta-time graph for their last comparable lap. *The* tifosi feature —
"where did Leclerc lose the lap." `/api/v1/laps/comparison` + car data already
exist; this needs a chart, not a table.

### 4. Live strategy / tyre-degradation view
Stints + tyre age + pit-lane times → live pit window and tyre-cliff panel, with
**undercut/overcut threat** indicators from gap-to-car-behind vs. pit-loss time.
The pit-window calculator exists in the TUI (`pitwindow.go`); bring it to the web
and make it live.

### 5. Team radio, surfaced
`GetTeamRadio` returns audio clips. Add a "Radio" ticker on the live page — play
button + driver + timestamp. Peak emotional content, and no rival dashboard has it
inline.

### 6. Session-aware Command Center
When a session is live, the home hero should pull the top battles, leader gap, and
last RC flag onto the front page instead of only saying "LIVE." Make the front
page reactive to the moment.

---

## Between-races experience ("understand the season")

### 7. Race replay as a first-class story
Grow `RaceStoryCanvas` from a scrubber into a narrative replay: auto-generated
"chapters" (start, first pit phase, VSC, decisive overtake, finish) with a
headline each (derived from RC + position swings), and scrub the position graph
and track map together. The "watch the race in 90 seconds" mode that makes people
open the app on a Tuesday.

### 8. Driver pages + rivalry view (a real gap)
No driver profile exists in the web app. Add a **driver page** (season form,
teammate H2H — already computed in the champ hub — quali vs. race pace, tyre
management, track-by-track) and a **rivalry view** (two drivers → cumulative
points, H2H, gap-over-season). Feeds the argument every fan has.

### 9. Next-race preview / "get smart" page
Between races the app goes quiet. Fill it: circuit characteristics, last year's
result (2023/24 is cached), typical strategy (1 vs 2 stop), DRS zones, weather
outlook, and the storylines (title-fight math to watch). Turn dead air into
anticipation.

### 10. Championship scenario narratives
Extend the simulator from "drag points around" to narrative permutations:
*"VER clinches if he outscores NOR by 9 this weekend"* / *"first race McLaren can
seal constructors'."* The stuff fans actually search for.

### 11. Briefing → calendar-aware season digest
Reframe the news reader into a paddock digest tied to the calendar: group by GP,
tag by team/driver, surface a "since last race" summary. Optionally an
LLM-generated weekly briefing (a `claude-haiku` summarization pass over ingested
RSS — cheap and on-brand).

---

## New / better data sources

- **Jolpica (Ergast successor, `api.jolpi.ca`)** — free historical results back to
  1950: qualifying, pit stops, lap times, circuit metadata. Unlocks all-time
  records, "best-ever at this track," and career stats OpenF1 (2023+) can't give.
  High value for driver pages and the "get smart" preview.
- **OpenF1 weather timeseries** — already fetched; plot it as a session-long strip
  (track temp / rain / wind) instead of a table. Weather narrates strategy.
- **Circuit metadata / DRS zones / corner names** — enriches the track map and
  previews. Some is in OpenF1 circuit info; curate the rest once as static data.
- **Static per-race context** — a tiny curated JSON per round (tyre allocation,
  notable stats) goes a long way for previews.

---

## Cross-cutting UX principles

1. **Replace tables with a shape wherever a shape carries the meaning.** Lap times
   → a trace with fastest lap marked. Stints → a horizontal tyre timeline. Gaps →
   the sparkline already shipped. Keep tables only where data is genuinely tabular
   (standings) — but annotate them.
2. **Always answer "so what?"** Every number sits next to its meaning (a gap next
   to "undercut live," a tyre age next to "5 laps from the cliff").
3. **One primary "moment" per screen.** The Command Center should always have a
   single obvious "here's what to watch/do now."
4. **Make between-races feel alive.** The app currently rewards you only on
   Sundays. Previews, digests, replays, and rivalries give a reason to open it
   midweek.

---

## Suggested sequencing (impact × effort)

**Phase 1 — turn live into a companion (highest impact; data already in hand)**
1. Web track map (SVG + GPS + mini-sectors)
2. Telemetry compare overlay (speed/throttle/brake + delta)
3. "What just happened" synthesized event rail
4. Team radio ticker

**Phase 2 — own the between-races window**
5. Narrative race replay (grow `RaceStoryCanvas`)
6. Driver pages + rivalry view
7. Next-race preview page

**Phase 3 — depth & reach**
8. Jolpica/Ergast historical integration + all-time records
9. Championship scenario narratives
10. Calendar-aware briefing digest (optional LLM summaries)

---

## Execution tracking (GitHub)

This roadmap is tracked on GitHub:

- **Project board:** https://github.com/users/AmanTahiliani/projects/2 ("box-box Roadmap")
- **Epics:** issues #2–#8 (label `epic`), one per epic above, on Phase milestones
- **Stories:** issues #9–#31, wired as native **sub-issues** under their epic (progress rolls up automatically)
- **Labels:** `epic`, `enabler`, `research`, `area:{live,viz,between-races,championship,data,ux}`
- **Milestones:** `Phase 1 — Live Companion`, `Phase 2 — Between-Races`, `Phase 3 — Depth & Reach`

**Board fields:** `Stage` (Icebox → Research → Ready → In Progress → In Review → Done),
`Priority` (P0–P2), `Effort` (S/M/L), `Phase` (1–3).

**Working model — active vs. bank:**
- Only **1–2 epics active** at a time (currently **E1 Live Race Companion** + **E2 Viz
  Primitives**); the other five epics are the theme-level idea bank.
- `Stage = Icebox` is the story-level bank. The 10 E1/E2 stories are seeded to
  `Ready`; everything else is `Icebox`. Promote a handful to `Ready`/`In Progress`
  per cycle; use `Research` to scope a vague idea before it's `Ready`.
**Board views** (built):
- **Backlog** — Table, all epics with expandable sub-issues: the full bank.
- **Board** — grouped by `Stage`, filtered `-stage:Icebox`: the active-WIP wall.
- **Roadmap** — Table grouped by `Phase` (Phase 1/2/3). Note: this is a
  phase-grouped table, not a timeline. A true timeline roadmap needs a date or
  iteration field (GitHub won't draw/persist a roadmap layout without one); add a
  `Target date` field and populate it once phases have real target dates, then
  switch this view to the Roadmap layout.
