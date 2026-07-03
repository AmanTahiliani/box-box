# Getting Started

## Prerequisites

- [Go](https://go.dev/doc/install), using the module version in `go.mod`.
- [Node.js](https://nodejs.org/) 18+ and npm.
- Internet access for ingestion and TUI OpenF1 calls.
- For e2e and visual tests: `npx playwright install` after `npm install` at the repo root.

## Install

```bash
git clone https://github.com/AmanTahiliani/box-box.git
cd box-box

npm install                    # Playwright and repo-level test scripts
npm install --prefix frontend  # Vite + React app
```

## Build

```bash
go build -o box-box ./cmd/main.go
npm run build --prefix frontend   # writes frontend/dist
```

## Run: Web

Build the frontend first, then start web mode. Go walks up from the current directory to find `frontend/dist/index.html`; if missing, it serves embedded legacy assets.

```bash
npm run build --prefix frontend
go run ./cmd/main.go --web
# http://localhost:8080
```

Use a specific domain database or port:

```bash
go run ./cmd/main.go --web --db ~/.local/share/box-box/boxbox.db --port 8080
```

## Run: Web Dev

Vite proxies `/api` to the Go server. Set `BOXBOX_API_PORT` to match the Go `--port`.

Terminal 1: API with a seeded database:

```bash
go run ./scripts/seed-e2e-db/main.go --db /tmp/boxbox-dev.db
BOXBOX_DISABLE_LIVE=1 go run ./cmd/main.go --web --db /tmp/boxbox-dev.db --port 18080
```

Terminal 2: frontend:

```bash
BOXBOX_API_PORT=18080 npm run dev --prefix frontend
# http://localhost:5173
```

`BOXBOX_DISABLE_LIVE=1` skips starting the SignalR bridge, which is useful for CI and local UI work.

## Run: TUI

```bash
go run ./cmd/main.go
# or: ./box-box
```

Logs go to `box-box.log` in the project directory so the terminal stays clean.

## TUI Keybindings

| Key | Action |
| --- | --- |
| `1`-`7` | Home, Standings, Calendar, Race Detail, Drivers, Live, Track Map |
| `tab` / `shift+tab` | Next / previous tab |
| `j`/`k`, `enter`, `b`/`esc` | Navigate, select, back |
| `s`, `b`, `p` | Live: sectors, battles, pit window |
| `r` | Race replay in Race Detail race sessions |
| `y` | Cycle season year |
| `q` / `ctrl+c` | Quit |

## Web Routes

| Route | Purpose |
| --- | --- |
| `/` | Command Center: race-weekend home with GP identity, live status, schedule, and analysis links |
| `/race-hub?session_key=<key>` | Race Hub: session workspace with Overview, Race Story, Strategy, Lap Data, Conditions, Race Control, and Data Status tabs |
| `/admin` | Admin / Data Health: ingestion coverage, local data status, and suggested CLI commands |
| `/data-library` | Legacy alias for Admin / Data Health |
| `/live` | Live Timing: timing tower and race control via SSE when a session is live |

Example after seeding: `http://localhost:5173/race-hub?session_key=9472`.
