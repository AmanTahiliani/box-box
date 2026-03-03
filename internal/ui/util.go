package ui

import (
	"fmt"
	"math"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/AmanTahiliani/box-box/internal/models"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// formatSeconds converts a duration in seconds to a lap time string (e.g. "1:31.234").
func formatSeconds(s float64) string {
	if s <= 0 {
		return "--:--.---"
	}
	minutes := int(s) / 60
	secs := s - float64(minutes*60)
	return fmt.Sprintf("%d:%06.3f", minutes, secs)
}

// formatGap formats the gap_to_leader field which can be float64, string, or []interface{}.
func formatGap(v interface{}) string {
	if v == nil {
		return "LEADER"
	}
	switch val := v.(type) {
	case float64:
		if val == 0 {
			return "LEADER"
		}
		return fmt.Sprintf("+%.3fs", val)
	case string:
		return val
	case []interface{}:
		if len(val) == 0 {
			return "--"
		}
		if f, ok := val[len(val)-1].(float64); ok {
			return formatSeconds(f)
		}
		return "--"
	}
	return "--"
}

// formatDuration formats a session result duration (float64 or []float64 for qualifying).
func formatDuration(v interface{}) string {
	if v == nil {
		return "--"
	}
	switch val := v.(type) {
	case float64:
		return formatSeconds(val)
	case []interface{}:
		if len(val) == 0 {
			return "--"
		}
		if f, ok := val[len(val)-1].(float64); ok {
			return formatSeconds(f)
		}
		return "--"
	}
	return "--"
}

// hexToStyle creates a lipgloss.Style with the given hex color as the foreground.
func hexToStyle(hex string) lipgloss.Style {
	if hex == "" {
		return lipgloss.NewStyle()
	}
	if !strings.HasPrefix(hex, "#") {
		hex = "#" + hex
	}
	return lipgloss.NewStyle().Foreground(lipgloss.Color(hex))
}

// hexToBgStyle creates a lipgloss.Style with the given hex color as the background.
func hexToBgStyle(hex string) lipgloss.Style {
	if hex == "" {
		return lipgloss.NewStyle()
	}
	if !strings.HasPrefix(hex, "#") {
		hex = "#" + hex
	}
	return lipgloss.NewStyle().Background(lipgloss.Color(hex)).Foreground(lipgloss.Color(colorWhite))
}

// sparkline generates a unicode block chart for lap times.
// Pit laps (nil duration) are rendered as spaces.
func sparkline(laps []models.Lap, width int) string {
	const blocks = "▁▂▃▄▅▆▇█"
	blockRunes := []rune(blocks)

	if len(laps) == 0 {
		return styleMuted.Render(strings.Repeat("·", width))
	}

	// Collect valid lap durations
	var durations []float64
	minDur, maxDur := math.MaxFloat64, 0.0
	for _, lap := range laps {
		if lap.LapDuration != nil && *lap.LapDuration > 0 {
			d := *lap.LapDuration
			durations = append(durations, d)
			if d < minDur {
				minDur = d
			}
			if d > maxDur {
				maxDur = d
			}
		} else {
			durations = append(durations, -1)
		}
	}

	rng := maxDur - minDur
	if rng == 0 {
		rng = 1
	}

	var sb strings.Builder
	count := 0
	for _, d := range durations {
		if count >= width {
			break
		}
		if d < 0 {
			sb.WriteString(styleMuted.Render("·"))
		} else {
			norm := (d - minDur) / rng
			// Invert: fast laps = tall bar (higher index)
			idx := int((1.0-norm)*float64(len(blockRunes)-1) + 0.5)
			if idx < 0 {
				idx = 0
			}
			if idx >= len(blockRunes) {
				idx = len(blockRunes) - 1
			}
			// Color based on performance: fast=green, mid=yellow, slow=red
			var blockStyle lipgloss.Style
			switch {
			case norm < 0.25:
				blockStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen))
			case norm < 0.5:
				blockStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorYellow))
			case norm < 0.75:
				blockStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorOrange))
			default:
				blockStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))
			}
			sb.WriteString(blockStyle.Render(string(blockRunes[idx])))
		}
		count++
	}

	result := sb.String()
	resultLen := utf8.RuneCountInString(lipgloss.NewStyle().Render(result))
	_ = resultLen
	return result
}

// windArrow maps a wind direction in degrees to a unicode arrow.
func windArrow(degrees int) string {
	arrows := []string{"↑", "↗", "→", "↘", "↓", "↙", "←", "↖"}
	idx := ((degrees + 22) / 45) % 8
	return arrows[idx]
}

// tyreStyle returns a lipgloss.Style for a tyre compound.
func tyreStyle(c models.TyreCompound) lipgloss.Style {
	switch c {
	case models.CompoundSoft:
		return lipgloss.NewStyle().Foreground(lipgloss.Color(colorSoft)).Bold(true)
	case models.CompoundMedium:
		return lipgloss.NewStyle().Foreground(lipgloss.Color(colorMedium)).Bold(true)
	case models.CompoundHard:
		return lipgloss.NewStyle().Foreground(lipgloss.Color(colorHard)).Bold(true)
	case models.CompoundIntermediate:
		return lipgloss.NewStyle().Foreground(lipgloss.Color(colorInter)).Bold(true)
	case models.CompoundWet:
		return lipgloss.NewStyle().Foreground(lipgloss.Color(colorWet)).Bold(true)
	default:
		return lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted))
	}
}

// tyreBgStyle returns a lipgloss.Style with background for tyre compound.
func tyreBgStyle(c models.TyreCompound) lipgloss.Style {
	switch c {
	case models.CompoundSoft:
		return lipgloss.NewStyle().Background(lipgloss.Color(colorSoft)).Foreground(lipgloss.Color("#000000")).Bold(true)
	case models.CompoundMedium:
		return lipgloss.NewStyle().Background(lipgloss.Color(colorMedium)).Foreground(lipgloss.Color("#000000")).Bold(true)
	case models.CompoundHard:
		return lipgloss.NewStyle().Background(lipgloss.Color(colorHard)).Foreground(lipgloss.Color("#000000")).Bold(true)
	case models.CompoundIntermediate:
		return lipgloss.NewStyle().Background(lipgloss.Color(colorInter)).Foreground(lipgloss.Color("#000000")).Bold(true)
	case models.CompoundWet:
		return lipgloss.NewStyle().Background(lipgloss.Color(colorWet)).Foreground(lipgloss.Color(colorWhite)).Bold(true)
	default:
		return lipgloss.NewStyle().Background(lipgloss.Color(colorSurface2)).Foreground(lipgloss.Color(colorMuted))
	}
}

// tyreAbbrev returns a single-letter abbreviation for a tyre compound.
func tyreAbbrev(c models.TyreCompound) string {
	switch c {
	case models.CompoundSoft:
		return "S"
	case models.CompoundMedium:
		return "M"
	case models.CompoundHard:
		return "H"
	case models.CompoundIntermediate:
		return "I"
	case models.CompoundWet:
		return "W"
	default:
		return "?"
	}
}

// renderDelta returns a colored position change indicator, always 2 visible columns wide.
func renderDelta(current, start int) string {
	diff := start - current // positive = gained positions
	switch {
	case diff > 0:
		s := fmt.Sprintf("▲%d", diff)
		return padRightVisible(styleDeltaUp.Render(s), 2)
	case diff < 0:
		s := fmt.Sprintf("▼%d", -diff)
		return padRightVisible(styleDeltaDown.Render(s), 2)
	default:
		return padRightVisible(styleDeltaEqual.Render("─"), 2)
	}
}

// renderPosition formats a position with podium coloring.
func renderPosition(pos int) string {
	s := fmt.Sprintf("%d", pos)
	switch pos {
	case 1:
		return stylePositionFirst.Render(s)
	case 2:
		return stylePositionSecond.Render(s)
	case 3:
		return stylePositionThird.Render(s)
	default:
		return s
	}
}

// renderPointsBar draws a horizontal progress bar for points.
func renderPointsBar(points, maxPoints float64, width int, color string) string {
	if maxPoints == 0 || width <= 0 {
		return ""
	}
	ratio := points / maxPoints
	filled := int(ratio * float64(width))
	if filled > width {
		filled = width
	}
	if filled < 0 {
		filled = 0
	}

	barStyle := lipgloss.NewStyle().
		Background(lipgloss.Color(color)).
		Foreground(lipgloss.Color(color))
	emptyStyle := lipgloss.NewStyle().
		Background(lipgloss.Color(colorSurface2)).
		Foreground(lipgloss.Color(colorSurface2))

	bar := ""
	if filled > 0 {
		bar += barStyle.Render(strings.Repeat("━", filled))
	}
	remaining := width - filled
	if remaining > 0 {
		bar += emptyStyle.Render(strings.Repeat("━", remaining))
	}
	return bar
}

// meetingStatus returns a status indicator for a meeting.
func meetingStatus(m models.Meeting, now time.Time, isNext bool) string {
	end, err := time.Parse(time.RFC3339, m.DateEnd)
	if err != nil {
		end, err = time.Parse("2006-01-02", m.DateEnd[:min(len(m.DateEnd), 10)])
		if err != nil {
			return " "
		}
		end = end.Add(24 * time.Hour)
	}

	if end.Before(now) {
		return stylePast.Render("✓")
	}
	if isNext {
		return styleNext.Render("●")
	}
	return styleFuture.Render("○")
}

// truncate shortens a string to max runes, appending "…" if truncated.
func truncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	if max <= 1 {
		return "…"
	}
	return string(runes[:max-1]) + "…"
}

// padRight pads or truncates a plain string to exactly width runes.
// Only use this for strings that contain no ANSI escape codes.
func padRight(s string, width int) string {
	runes := []rune(s)
	if len(runes) >= width {
		return string(runes[:width])
	}
	return s + strings.Repeat(" ", width-len(runes))
}

// padLeft left-pads a plain string to exactly width runes.
// Only use this for strings that contain no ANSI escape codes.
func padLeft(s string, width int) string {
	runes := []rune(s)
	if len(runes) >= width {
		return string(runes[:width])
	}
	return strings.Repeat(" ", width-len(runes)) + s
}

// padRightVisible pads an ANSI-styled string to exactly width visible columns.
// Uses lipgloss.Width to measure the visible display width, ignoring escape codes.
func padRightVisible(s string, width int) string {
	vis := lipgloss.Width(s)
	if vis >= width {
		return s
	}
	return s + strings.Repeat(" ", width-vis)
}

// padLeftVisible left-pads an ANSI-styled string to exactly width visible columns.
// Uses lipgloss.Width to measure the visible display width, ignoring escape codes.
func padLeftVisible(s string, width int) string {
	vis := lipgloss.Width(s)
	if vis >= width {
		return s
	}
	return strings.Repeat(" ", width-vis) + s
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// countryFlag converts a country code to an emoji flag.
func countryFlag(countryCode string) string {
	code := strings.ToUpper(countryCode)
	if len(code) != 2 {
		return "  "
	}
	r1 := rune(0x1F1E6 + int(code[0]-'A'))
	r2 := rune(0x1F1E6 + int(code[1]-'A'))
	return string(r1) + string(r2)
}

// helpBar renders a styled help bar with key/description pairs.
// Format: "key:description" pairs separated by spaces in the output.
func helpBar(hints ...string) string {
	var parts []string
	for _, h := range hints {
		// Split on first space: "key description"
		idx := strings.Index(h, " ")
		if idx > 0 {
			key := h[:idx]
			desc := h[idx+1:]
			parts = append(parts, styleHelpKey.Render(key)+" "+styleHelpDesc.Render(desc))
		} else {
			parts = append(parts, styleHelpDesc.Render(h))
		}
	}
	bar := strings.Join(parts, styleMuted.Render("  │  "))
	return styleHelp.Render(bar)
}

// divider renders a subtle horizontal divider line.
func divider(width int) string {
	if width <= 0 {
		width = 40
	}
	return styleMuted.Render(strings.Repeat("─", width))
}

// matchKey checks if a KeyMsg matches a binding.
func matchKey(msg tea.KeyMsg, binding interface{ Keys() []string }) bool {
	for _, k := range binding.Keys() {
		if msg.String() == k {
			return true
		}
	}
	return false
}

// teamColorFromName returns the known team color hex for a team name, or a fallback.
func teamColorFromName(teamName string) string {
	name := strings.ToLower(teamName)
	switch {
	case strings.Contains(name, "red bull") && !strings.Contains(name, "racing bulls"):
		return colorRedbull
	case strings.Contains(name, "mercedes"):
		return colorMercedes
	case strings.Contains(name, "ferrari"):
		return colorFerrari
	case strings.Contains(name, "mclaren"):
		return colorMclaren
	case strings.Contains(name, "aston martin"):
		return colorAstonMartin
	case strings.Contains(name, "alpine"):
		return colorAlpine
	case strings.Contains(name, "williams"):
		return colorWilliams
	case strings.Contains(name, "haas"):
		return colorHaas
	case strings.Contains(name, "racing bulls"), strings.Contains(name, "alphatauri"), strings.Contains(name, "rb "):
		return colorRB
	case strings.Contains(name, "sauber"), strings.Contains(name, "alfa romeo"), strings.Contains(name, "stake"):
		return colorSauber
	default:
		return colorMuted
	}
}

// teamColorBar renders a thin colored bar (e.g., "█") for team identity.
func teamColorBar(teamColor string) string {
	if teamColor == "" {
		teamColor = colorMuted
	}
	if !strings.HasPrefix(teamColor, "#") {
		teamColor = "#" + teamColor
	}
	return lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")
}
