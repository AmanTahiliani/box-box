# box-box

> "Box, box. Box, box." Every F1 race engineer, ever.

**box-box** is an unofficial F1 race-weekend command center: live timing, Race Hub analytics, championship context, paddock briefing feeds, and local historical data in one Go + React app, with a preserved Bubble Tea TUI.

Live demo: [box-box.amantahiliani.com](https://box-box.amantahiliani.com/)

![box-box Command Center](docs/assets/command-center.jpg)

## What It Does

- **Command Center**: current race-weekend home with GP identity, live status, schedule, championship leaders, and direct analysis links.
- **Race Hub**: session workspace for overview, race story, strategy, laps, weather, race control, and dataset coverage.
- **Live Timing**: official F1 SignalR feed bridged through the Go server to the browser via SSE.
- **Championship View**: standings, form, teammate context, cumulative points, and a simulator.
- **Paddock Briefing**: RSS/Atom news ingestion for a local race-weekend briefing surface.
- **Local-first history**: OpenF1 data ingested into a SQLite domain database for fast historical browsing.
- **Terminal Mode**: Bubble Tea TUI with standings, calendar, driver profiles, live timing, track map, battles, pit window, and replay.

## Quickstart

```bash
git clone https://github.com/AmanTahiliani/box-box.git
cd box-box

npm install
npm install --prefix frontend

npm run build --prefix frontend
go run ./cmd/main.go --web
# http://localhost:8080
```

For a local frontend development loop with seeded data, see [docs/getting-started.md](docs/getting-started.md).

## Project Shape

| Area | What lives there |
| --- | --- |
| `cmd/main.go` | Entry point for TUI, web server, and ingestion CLI |
| `internal/web/` | Go REST API, SSE live bridge, SPA serving |
| `internal/live/` | Official F1 SignalR client shared by Web and TUI |
| `internal/store/`, `internal/ingest/`, `internal/query/` | Local SQLite domain database, ingestion, and read models |
| `internal/ui/` | Bubble Tea TUI |
| `frontend/` | React + Vite + TypeScript web app |
| `tests/` | Playwright e2e and visual coverage |

The Web UI is local-first and should call the Go APIs under `/api/v1/...`; it should not read OpenF1 directly.

## Documentation

- [Getting Started](docs/getting-started.md): install, build, run modes, TUI keybindings, and web routes.
- [Data and Operations](docs/data-and-operations.md): ingestion, environment variables, local files, and live timing notes.
- [Testing](docs/testing.md): Go, frontend, e2e, and visual regression commands.
- [Architecture Notes](documentations/refactor/README.md): deeper design rationale, data-source decisions, and phase history.

## Status

Pre-beta and actively developed. The Web UI is the primary surface; the TUI is preserved and still useful for terminal workflows. Live timing depends on F1 broadcasting timing data, so it is only fully active during live sessions.

## License

MIT © [Aman Tahiliani](https://github.com/AmanTahiliani)

*Unofficial project; not associated with Formula 1 or the FIA.*
