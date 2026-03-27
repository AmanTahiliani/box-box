# 🏎️ box-box

![Status-Pre-Beta](https://img.shields.io/badge/Status-Pre--Beta-yellow?style=for-the-badge)

> "Box, box. Box, box." — Every F1 Race Engineer, ever.

**⚠️ Disclaimer: This project is currently in a pre-beta state.** Features may be incomplete, and you might encounter bugs as we fine-tune the engine.

**box-box** is a high-performance Formula 1 Terminal User Interface (TUI) built for fans who live in the command line. Get real-time standings, race calendars, and deep-dive driver stats without ever leaving your terminal.

![box-box TUI Preview](https://img.shields.io/badge/UI-Bubble%20Tea-00ADD8?style=for-the-badge&logo=go)
![Data-OpenF1](https://img.shields.io/badge/Data-OpenF1-FF1801?style=for-the-badge)

## ✨ Features

- 🏆 **Live Standings**: Keep track of the Driver and Constructor Championships.
- 📅 **Race Calendar**: The full 2025 schedule at your fingertips.
- 🏎️ **Race Details**: Deep dive into session results, starting grids, and lap data.
- 👤 **Driver Profiles**: Detailed stats for every driver on the grid.
- 🔴 **Official Live Timing**: Real-time F1 timing tower via the official SignalR feed — gaps, intervals, tyre age, sector times, DRS, and track status.
- ⚔️ **Battle Tracker**: Auto-detects on-track duels within DRS range with gap sparklines and tyre strategy comparison.
- 🔧 **Pit Window Calculator**: Predicts rejoin position if a driver pits now, using per-circuit pit loss times.
- ⏪ **Race Replay**: Lap-by-lap scrubber for completed races — relive the whole field's evolution with pit annotations and race control messages.
- 🗺️ **ASCII Track Map**: Live car positions on a terminal-rendered track outline, team-coloured.
- 🔌 **Offline-ish**: Fast, lightweight, and powered by the wonderful [OpenF1 API](https://openf1.org).

## 🚀 Quick Start

### Prerequisites

- [Go](https://go.dev/doc/install) 1.21 or higher.

### Installation

```bash
# Clone the repository
git clone https://github.com/AmanTahiliani/box-box.git
cd box-box

# Build and run
go run cmd/main.go
```

## 🎮 Controls

| Key | Action |
| --- | --- |
| `1` | Switch to **Home** |
| `2` | Switch to **Standings** |
| `3` | Switch to **Calendar** |
| `4` | Switch to **Race Details** |
| `5` | Switch to **Drivers** |
| `6` | Switch to **Live Timing** |
| `7` | Switch to **Track Map** |
| `tab` / `shift+tab` | Next / Previous tab |
| `j`/`↓` | Navigate down |
| `k`/`↑` | Navigate up |
| `enter` | Select/Inspect item |
| `b` / `esc` | Go back / collapse |
| `s` | Toggle sector times (Live tab) |
| `b` | Toggle Battle Tracker (Live tab) |
| `p` | Toggle Pit Window Calculator (Live tab) |
| `r` | Enter Race Replay (Race Detail tab, Race sessions) |
| `←`/`h` · `→`/`l` | Scrub laps in Replay |
| `y` | Cycle season year |
| `q` / `ctrl+c` | Exit |

## 🛠️ Tech Stack

- **[Bubble Tea](https://github.com/charmbracelet/bubbletea)**: The TUI engine.
- **[Lipgloss](https://github.com/charmbracelet/lipgloss)**: For that sleek F1 styling.
- **[Bubbles](https://github.com/charmbracelet/bubbles)**: Common TUI components.
- **[OpenF1 API](https://api.openf1.org)**: The data source (Free, no API key needed).

## 🚥 Development

Want to tinker under the hood?

```bash
# Run tests
go test ./...

# View API integration tests (requires internet)
go test -v ./internal/api
```

## 📜 License

MIT © [Aman Tahiliani](https://github.com/AmanTahiliani)

---
*Disclaimer: This project is unofficial and not associated with Formula 1 or the FIA in any way.*
