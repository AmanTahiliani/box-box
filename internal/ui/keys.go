package ui

import "github.com/charmbracelet/bubbles/key"

// GlobalKeyMap holds keybindings that work from any tab.
type GlobalKeyMap struct {
	Tab1     key.Binding
	Tab2     key.Binding
	Tab3     key.Binding
	Tab4     key.Binding
	Tab5     key.Binding
	Tab6     key.Binding
	Tab7     key.Binding
	NextTab  key.Binding
	PrevTab  key.Binding
	Quit     key.Binding
	Up       key.Binding
	Down     key.Binding
	Enter    key.Binding
	Back     key.Binding
	Year     key.Binding
	Retry    key.Binding
	GoTop    key.Binding
	GoBottom key.Binding
	HalfUp   key.Binding
	HalfDown key.Binding
}

// GlobalKeys is the singleton global key map.
var GlobalKeys = GlobalKeyMap{
	Tab1: key.NewBinding(
		key.WithKeys("1"),
		key.WithHelp("1", "home"),
	),
	Tab2: key.NewBinding(
		key.WithKeys("2"),
		key.WithHelp("2", "standings"),
	),
	Tab3: key.NewBinding(
		key.WithKeys("3"),
		key.WithHelp("3", "calendar"),
	),
	Tab4: key.NewBinding(
		key.WithKeys("4"),
		key.WithHelp("4", "race detail"),
	),
	Tab5: key.NewBinding(
		key.WithKeys("5"),
		key.WithHelp("5", "drivers"),
	),
	Tab6: key.NewBinding(
		key.WithKeys("6"),
		key.WithHelp("6", "live"),
	),
	Tab7: key.NewBinding(
		key.WithKeys("7"),
		key.WithHelp("7", "track map"),
	),
	NextTab: key.NewBinding(
		key.WithKeys("tab", "right"),
		key.WithHelp("tab/->", "next tab"),
	),
	PrevTab: key.NewBinding(
		key.WithKeys("shift+tab", "left"),
		key.WithHelp("shift+tab/<-", "prev tab"),
	),
	Quit: key.NewBinding(
		key.WithKeys("q", "ctrl+c"),
		key.WithHelp("q", "quit"),
	),
	Up: key.NewBinding(
		key.WithKeys("k", "up"),
		key.WithHelp("k", "up"),
	),
	Down: key.NewBinding(
		key.WithKeys("j", "down"),
		key.WithHelp("j", "down"),
	),
	Enter: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "select"),
	),
	Back: key.NewBinding(
		key.WithKeys("b", "esc"),
		key.WithHelp("b/esc", "back"),
	),
	Year: key.NewBinding(
		key.WithKeys("y"),
		key.WithHelp("y", "switch year"),
	),
	Retry: key.NewBinding(
		key.WithKeys("r"),
		key.WithHelp("r", "retry"),
	),
	GoTop: key.NewBinding(
		key.WithKeys("g", "home"),
		key.WithHelp("g", "go to top"),
	),
	GoBottom: key.NewBinding(
		key.WithKeys("G", "end"),
		key.WithHelp("G", "go to bottom"),
	),
	HalfUp: key.NewBinding(
		key.WithKeys("ctrl+u"),
		key.WithHelp("ctrl+u", "half page up"),
	),
	HalfDown: key.NewBinding(
		key.WithKeys("ctrl+d"),
		key.WithHelp("ctrl+d", "half page down"),
	),
}

// StandingsKeyMap holds standing-specific keybindings.
type StandingsKeyMap struct {
	DriverView      key.Binding
	ConstructorView key.Binding
}

var StandingsKeys = StandingsKeyMap{
	DriverView: key.NewBinding(
		key.WithKeys("d"),
		key.WithHelp("d", "drivers"),
	),
	ConstructorView: key.NewBinding(
		key.WithKeys("c"),
		key.WithHelp("c", "constructors"),
	),
}

// LiveKeyMap holds keybindings specific to the live timing tab.
type LiveKeyMap struct {
	ToggleSectors   key.Binding
	ToggleRC        key.Binding
	ToggleBattles   key.Binding
	TogglePitWindow key.Binding
	ScrollRCUp      key.Binding
	ScrollRCDown    key.Binding
	ExpandDriver    key.Binding
	Collapse        key.Binding
}

var LiveKeys = LiveKeyMap{
	ToggleSectors: key.NewBinding(
		key.WithKeys("s"),
		key.WithHelp("s", "toggle sectors"),
	),
	ToggleRC: key.NewBinding(
		key.WithKeys("r"),
		key.WithHelp("r", "toggle RC panel"),
	),
	ToggleBattles: key.NewBinding(
		key.WithKeys("b"),
		key.WithHelp("b", "toggle battles"),
	),
	TogglePitWindow: key.NewBinding(
		key.WithKeys("p"),
		key.WithHelp("p", "pit window"),
	),
	ScrollRCUp: key.NewBinding(
		key.WithKeys("K"),
		key.WithHelp("K", "scroll RC up"),
	),
	ScrollRCDown: key.NewBinding(
		key.WithKeys("J"),
		key.WithHelp("J", "scroll RC down"),
	),
	ExpandDriver: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "driver detail"),
	),
	Collapse: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "collapse"),
	),
}

// RaceDetailKeyMap holds keybindings for the race detail tab.
type RaceDetailKeyMap struct {
	ScrollUp    key.Binding
	ScrollDown  key.Binding
	PrevSession key.Binding
	NextSession key.Binding
	Replay      key.Binding
}

var RaceDetailKeys = RaceDetailKeyMap{
	ScrollUp: key.NewBinding(
		key.WithKeys("K"),
		key.WithHelp("K", "scroll race control up"),
	),
	ScrollDown: key.NewBinding(
		key.WithKeys("J"),
		key.WithHelp("J", "scroll race control down"),
	),
	PrevSession: key.NewBinding(
		key.WithKeys("["),
		key.WithHelp("[", "previous session"),
	),
	NextSession: key.NewBinding(
		key.WithKeys("]"),
		key.WithHelp("]", "next session"),
	),
	Replay: key.NewBinding(
		key.WithKeys("r"),
		key.WithHelp("r", "replay lap scrubber"),
	),
}
