package ui

import "github.com/charmbracelet/lipgloss"

// F1 brand colors
const (
	colorF1Red   = "#E10600"
	colorF1Black = "#15151E"
	colorSubtle  = "#2A2A3C"
	colorMuted   = "#6B6B7A"
	colorWhite   = "#FFFFFF"
	colorGreen   = "#00D26A"
	colorYellow  = "#FFD700"
	colorOrange  = "#FF8700"
	colorCyan    = "#00BFFF"

	// Surfaces
	colorSurface0 = "#1B1B2F"
	colorSurface1 = "#222236"
	colorSurface2 = "#2D2D44"
	colorBorder   = "#3C3C54"

	// Tyre compounds
	colorSoft   = "#FF3333"
	colorMedium = "#FFD700"
	colorHard   = "#CCCCCC"
	colorInter  = "#39B54A"
	colorWet    = "#0080FF"

	// F1 team colors (2024/2025 season)
	colorRedbull     = "#3671C6"
	colorMercedes    = "#27F4D2"
	colorFerrari     = "#E8002D"
	colorMclaren     = "#FF8000"
	colorAstonMartin = "#229971"
	colorAlpine      = "#FF87BC"
	colorWilliams    = "#64C4FF"
	colorHaas        = "#B6BABD"
	colorRB          = "#6692FF"
	colorSauber      = "#52E252"
)

var (
	// ── Tab bar ──────────────────────────────────────────
	styleActiveTab = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(colorWhite)).
			Background(lipgloss.Color(colorF1Red)).
			Padding(0, 2)

	styleInactiveTab = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorMuted)).
				Background(lipgloss.Color(colorSurface0)).
				Padding(0, 2)

	styleTabBar = lipgloss.NewStyle().
			Background(lipgloss.Color(colorSurface0))

	// Tab bar accent stripe
	styleTabStripe = lipgloss.NewStyle().
			Background(lipgloss.Color(colorF1Red)).
			Foreground(lipgloss.Color(colorF1Red))

	// Year badge in tab bar
	styleYearBadge = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(colorYellow)).
			Background(lipgloss.Color(colorSurface0)).
			Padding(0, 1)

	// ── Panel / border styles ────────────────────────────
	stylePanelBorder = lipgloss.NewStyle().
				BorderStyle(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color(colorBorder)).
				Padding(0, 1)

	styleActivePanelBorder = lipgloss.NewStyle().
				BorderStyle(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color(colorF1Red)).
				Padding(0, 1)

	// ── Text styles ──────────────────────────────────────
	styleBold = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorWhite))

	styleMuted = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted))

	styleError = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorF1Red)).
			Bold(true)

	styleHeader = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(colorWhite)).
			Background(lipgloss.Color(colorSurface2)).
			Padding(0, 1).
			MarginBottom(0)

	styleSectionTitle = lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color(colorF1Red)).
				PaddingLeft(1)

	// ── Delta styles ─────────────────────────────────────
	styleDeltaUp = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorGreen)).
			Bold(true)

	styleDeltaDown = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorF1Red)).
			Bold(true)

	styleDeltaEqual = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted))

	// ── Selected row style ───────────────────────────────
	styleSelected = lipgloss.NewStyle().
			Background(lipgloss.Color(colorSurface2)).
			Foreground(lipgloss.Color(colorWhite)).
			Bold(true)

	// ── Status indicators ────────────────────────────────
	stylePast = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorGreen))

	styleNext = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorF1Red)).
			Bold(true)

	styleFuture = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted))

	// ── Flag colors for race control ─────────────────────
	styleFlagGreen  = lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen))
	styleFlagYellow = lipgloss.NewStyle().Foreground(lipgloss.Color(colorYellow))
	styleFlagRed    = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))
	styleFlagBlue   = lipgloss.NewStyle().Foreground(lipgloss.Color(colorCyan))
	styleFlagWhite  = lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite))

	// Race control category styles
	styleSafetyCar = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorOrange)).
			Bold(true)

	styleDRS = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorCyan))

	// ── Help bar ─────────────────────────────────────────
	styleHelp = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted)).
			Background(lipgloss.Color(colorSurface0)).
			Padding(0, 1)

	styleHelpKey = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorWhite)).
			Bold(true)

	styleHelpDesc = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted))

	// ── Status bar ───────────────────────────────────────
	styleStatusBar = lipgloss.NewStyle().
			Background(lipgloss.Color(colorSurface0)).
			Foreground(lipgloss.Color(colorWhite)).
			Padding(0, 1)

	styleStatusLabel = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorMuted))

	styleStatusValue = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorWhite)).
				Bold(true)

	styleCountdown = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorYellow)).
			Bold(true)

	// ── Points bar ───────────────────────────────────────
	stylePointsBarFilled = lipgloss.NewStyle().
				Background(lipgloss.Color(colorF1Red)).
				Foreground(lipgloss.Color(colorF1Red))

	stylePointsBarEmpty = lipgloss.NewStyle().
				Background(lipgloss.Color(colorSurface2)).
				Foreground(lipgloss.Color(colorSurface2))

	// ── Session pill ─────────────────────────────────────
	styleSessionActive = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorWhite)).
				Background(lipgloss.Color(colorF1Red)).
				Bold(true).
				Padding(0, 1)

	styleSessionInactive = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorMuted)).
				Background(lipgloss.Color(colorSurface1)).
				Padding(0, 1)

	styleSessionCursor = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorWhite)).
				Background(lipgloss.Color(colorSurface2)).
				Bold(true).
				Padding(0, 1)

	// ── Driver card ──────────────────────────────────────
	styleDriverNumber = lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color(colorWhite)).
				Padding(0, 1)

	styleDriverName = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(colorWhite))

	styleTeamName = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted))

	// ── Misc ─────────────────────────────────────────────
	stylePositionFirst = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorYellow)).
				Bold(true)

	stylePositionSecond = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorHard))

	stylePositionThird = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorOrange))

	styleDNF = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorF1Red)).
			Bold(true)

	styleLeader = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorYellow)).
			Bold(true)

	styleGap = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted))

	// Base Table styles
	styleTableBase = lipgloss.NewStyle().
			BorderStyle(lipgloss.NormalBorder()).
			BorderForeground(lipgloss.Color(colorBorder))

	// Weather card
	styleWeatherLabel = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorMuted))

	styleWeatherValue = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorWhite)).
				Bold(true)

	styleRain = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorCyan)).
			Bold(true)

	styleDry = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorGreen))
)

// DefaultTableStyles returns a base style map for bubbles/table.
func DefaultTableStyles() tableStyles {
	return tableStyles{}
}

type tableStyles struct{}
