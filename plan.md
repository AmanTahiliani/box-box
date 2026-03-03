Great name! **box-box** it is 🏎️

Here's your getting started guide:

---

## The Stack

| Tool | Purpose |
|---|---|
| **Bubble Tea** | TUI framework — the "engine" (like React for terminals) |
| **Lipgloss** | Styling — colors, borders, padding |
| **Bubbles** | Pre-built components — tables, spinners, viewports |
| **OpenF1 API** | Data source — free, no key needed |

---

## Core Bubble Tea Concepts to Know

Bubble Tea follows the **Elm architecture** — just 3 things:

1. **Model** — your app's state (what data you're holding, which tab is active, etc.)
2. **Update** — handles events (keypresses, API responses) and returns a new model
3. **View** — renders the model to a string that gets printed to the terminal

Everything flows in one direction: `event → update → view`. That's it.

```
type model struct {
    activeTab  int
    standings  []Driver
    loading    bool
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) { ... }
func (m model) View() string { ... }
```

---

## Project Structure

```
box-box/
├── cmd/
│   └── main.go          # Entry point
├── internal/
│   ├── api/
│   │   └── openf1.go    # All API calls
│   ├── ui/
│   │   ├── app.go       # Root model, tab switching
│   │   ├── standings.go # Standings tab
│   │   ├── calendar.go  # Calendar tab
│   │   ├── results.go   # Results tab
│   │   └── driver.go    # Driver lookup tab
│   └── models/
│       └── types.go     # Structs (Driver, Race, Result, etc.)
├── go.mod
└── README.md
```

---

## How to Bootstrap It

```bash
mkdir box-box && cd box-box
go mod init github.com/yourusername/box-box

# Install dependencies
go get github.com/charmbracelet/bubbletea
go get github.com/charmbracelet/lipgloss
go get github.com/charmbracelet/bubbles
```

---

## Key Concepts for a Beginner

**1. Commands (Cmd) are how you do async work**
API calls happen outside the Update loop — you return a `tea.Cmd` which runs in the background and sends a message back when done. This keeps the UI non-blocking.

**2. Messages (Msg) are how things communicate**
When your API call finishes, it sends a message like `standingsFetchedMsg` back into Update. You pattern match on it and update your model.

**3. Tabs = multiple models composed together**
Each tab (standings, calendar, etc.) can be its own mini Bubble Tea model. The root `app.go` model holds them all and delegates keypresses to whichever tab is active.

**4. Lipgloss is just styling strings**
Since everything in Bubble Tea is strings, Lipgloss lets you wrap them with colors, borders, and layout — think of it like CSS for your terminal output.

---

## Suggested Learning Order

1. Follow the [Bubble Tea tutorial](https://github.com/charmbracelet/bubbletea/tree/master/tutorials) — takes ~30 mins
2. Build a single tab first (just standings) — get data showing in a table
3. Add tab navigation
4. Add the remaining views one by one
5. Polish with Lipgloss last

---

The OpenF1 API is straightforward REST — for example `https://api.openf1.org/v1/drivers?session_key=latest` gives you current session drivers. No auth, no rate limits to worry about for personal use.

Want me to write out the skeleton code to get you started — just the structure with empty stubs and the Bubble Tea boilerplate wired up?
