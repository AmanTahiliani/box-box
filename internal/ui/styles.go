package ui

import "github.com/charmbracelet/lipgloss"

// F1 brand colors
const (
	colorF1Red   = "#E8002D"
	colorF1Black = "#15151E"
	colorSubtle  = "#3C3C4A"
	colorMuted   = "#6B6B7A"
	colorWhite   = "#FFFFFF"
	colorGreen   = "#39B54A"

	// Tyre compounds
	colorSoft   = "#FF1E1E"
	colorMedium = "#FFD700"
	colorHard   = "#EEEEEE"
	colorInter  = "#39B54A"
	colorWet    = "#0057FF"
)

var (
	// Tab bar styles
	styleActiveTab = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(colorWhite)).
			Background(lipgloss.Color(colorF1Red)).
			Padding(0, 2)

	styleInactiveTab = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorMuted)).
				Padding(0, 2)

	styleTabBar = lipgloss.NewStyle().
			Background(lipgloss.Color(colorF1Black)).
			BorderStyle(lipgloss.NormalBorder()).
			BorderBottom(true).
			BorderForeground(lipgloss.Color(colorSubtle))

	// Panel / border styles
	stylePanelBorder = lipgloss.NewStyle().
				BorderStyle(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color(colorSubtle)).
				Padding(0, 1)

	styleActivePanelBorder = lipgloss.NewStyle().
				BorderStyle(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color(colorF1Red)).
				Padding(0, 1)

	// Text styles
	styleBold = lipgloss.NewStyle().Bold(true)

	styleMuted = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted))

	styleError = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorF1Red)).
			Bold(true)

	styleHeader = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(colorWhite)).
			Background(lipgloss.Color(colorSubtle)).
			Padding(0, 1)

	// Delta styles
	styleDeltaUp = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorGreen)).
			Bold(true)

	styleDeltaDown = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorF1Red)).
			Bold(true)

	styleDeltaEqual = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted))

	// Selected row style
	styleSelected = lipgloss.NewStyle().
			Background(lipgloss.Color(colorSubtle)).
			Bold(true)

	// Status indicators
	stylePast = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted))

	styleNext = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorF1Red)).
			Bold(true)

	// Flag colors for race control
	styleFlagGreen  = lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen))
	styleFlagYellow = lipgloss.NewStyle().Foreground(lipgloss.Color(colorMedium))
	styleFlagRed    = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))
	styleFlagBlue   = lipgloss.NewStyle().Foreground(lipgloss.Color(colorWet))
	styleFlagWhite  = lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite))

	// Help bar
	styleHelp = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorMuted)).
			Padding(0, 1)
)
