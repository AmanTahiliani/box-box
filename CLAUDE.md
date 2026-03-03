# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**box-box** is a Formula 1 Terminal User Interface (TUI) application written in Go. It displays F1 standings, race calendar, results, and driver data sourced from the [OpenF1 API](https://openf1.org) (free, no auth required).

## Commands

```bash
# Build
go build ./cmd

# Run
go run ./cmd/main.go

# Run all tests
go test ./...

# Run tests with output
go test -v ./internal/api

# Install dependencies (not yet done)
go get github.com/charmbracelet/bubbletea
go get github.com/charmbracelet/lipgloss
go get github.com/charmbracelet/bubbles
```

Tests in `internal/api/openf1_test.go` are integration tests hitting the real OpenF1 API — they include rate-limit-aware skipping logic.

## Architecture

### Tech Stack

| Tool | Purpose |
|---|---|
| **Bubble Tea** | TUI framework using Elm architecture (Model → Update → View) |
| **Lipgloss** | Terminal styling — colors, borders, layout |
| **Bubbles** | Pre-built TUI components (tables, spinners, viewports) |
| **OpenF1 API** | F1 data source at `https://api.openf1.org/v1/` |

### Elm Architecture (Bubble Tea)

All UI follows the unidirectional flow: `event → Update → View`

- **Model** — app state (active tab, loaded data, loading flags)
- **Update(msg)** — handles keypresses and API response messages, returns new model + optional `tea.Cmd`
- **View()** — renders model to a string printed to terminal
- **Cmd** — async work (API calls) that runs outside the Update loop and sends a `Msg` back when done

Each tab (standings, calendar, results, driver) is its own Bubble Tea sub-model. The root `app.go` holds all tabs and delegates input to the active one.

### Package Structure

```
cmd/main.go              # Entry point — wire up and launch the TUI
internal/
  api/
    client.go            # OpenF1Client: HTTP wrapper with 10s timeout
    openf1.go            # 23 endpoint methods (meetings, drivers, results, telemetry, etc.)
    openf1_test.go       # Integration tests for API layer
  models/
    types.go             # 18 data structs: Circuit, Meeting, Session, Driver, Lap, Stint, etc.
  ui/
    app.go               # (planned) Root model, tab switching
    standings.go         # (planned) Championship standings tab
    calendar.go          # (planned) Race calendar tab
    results.go           # (planned) Race results tab
    driver.go            # (planned) Driver lookup tab
```

### Current Status

- **API layer**: Complete — all 23 OpenF1 endpoints implemented
- **Data models**: Complete — 18 structs covering all F1 entities
- **UI layer**: Not yet implemented — `internal/ui/` is empty, `cmd/main.go` is a stub
- **Dependencies**: Not yet installed — `go.mod` has no direct deps yet

### API Layer

`OpenF1Client` in `internal/api/client.go` wraps a standard `http.Client`. All methods in `openf1.go` follow the pattern: build query params → GET from `https://api.openf1.org/v1/{endpoint}` → decode JSON into model types.

Key endpoint groups:
- **Session context**: `GetMeetings`, `GetSessions`
- **Standings**: `GetDriverChampionship`, `GetTeamChampionship`
- **Race data**: `GetSessionResults`, `GetStartingGrid`, `GetLaps`, `GetStints`, `GetPits`
- **Live telemetry**: `GetPositions`, `GetIntervals`, `GetCarData`, `GetLocations`
- **Race events**: `GetRaceControl`, `GetOvertakes`, `GetWeather`, `GetTeamRadio`
