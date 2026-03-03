package ui

import (
	"fmt"
	"math"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/AmanTahiliani/box-box/internal/models"
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
		// Qualifying: return best Q time
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
		// Qualifying: return best Q time
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
// The hex string may or may not have a leading '#'.
func hexToStyle(hex string) lipgloss.Style {
	if hex == "" {
		return lipgloss.NewStyle()
	}
	if !strings.HasPrefix(hex, "#") {
		hex = "#" + hex
	}
	return lipgloss.NewStyle().Foreground(lipgloss.Color(hex))
}

// sparkline generates a unicode block chart for lap times.
// Pit laps (nil duration) are rendered as spaces.
func sparkline(laps []models.Lap, width int) string {
	const blocks = "▁▂▃▄▅▆▇█"
	blockRunes := []rune(blocks)

	if len(laps) == 0 {
		return strings.Repeat(" ", width)
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
			sb.WriteRune(' ')
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
			sb.WriteRune(blockRunes[idx])
		}
		count++
	}

	result := sb.String()
	resultLen := utf8.RuneCountInString(result)
	if resultLen < width {
		result += strings.Repeat(" ", width-resultLen)
	}
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

// renderDelta returns a colored ▲N/▼N/= string for position change.
func renderDelta(current, start int) string {
	diff := start - current // positive = gained positions
	switch {
	case diff > 0:
		return styleDeltaUp.Render(fmt.Sprintf("▲%d", diff))
	case diff < 0:
		return styleDeltaDown.Render(fmt.Sprintf("▼%d", -diff))
	default:
		return styleDeltaEqual.Render("=")
	}
}

// meetingStatus returns a status indicator for a meeting.
// isNext should be true only for the first upcoming meeting.
func meetingStatus(m models.Meeting, now time.Time, isNext bool) string {
	end, err := time.Parse(time.RFC3339, m.DateEnd)
	if err != nil {
		// Fallback: try date-only parsing
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
		return styleNext.Render("◎")
	}
	return " "
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

// padRight pads or truncates a string to exactly width runes.
func padRight(s string, width int) string {
	runes := []rune(s)
	if len(runes) >= width {
		return string(runes[:width])
	}
	return s + strings.Repeat(" ", width-len(runes))
}

// padLeft left-pads a string to exactly width runes.
func padLeft(s string, width int) string {
	runes := []rune(s)
	if len(runes) >= width {
		return string(runes[:width])
	}
	return strings.Repeat(" ", width-len(runes)) + s
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

// countryFlag converts a country flag URL or code to an emoji flag.
// OpenF1 provides flag URLs; we do a best-effort mapping from country_code.
func countryFlag(countryCode string) string {
	// Convert ISO 3166-1 alpha-2 to emoji regional indicators
	code := strings.ToUpper(countryCode)
	if len(code) != 2 {
		return "  "
	}
	// Each letter maps to a regional indicator symbol (U+1F1E6 = 'A')
	r1 := rune(0x1F1E6 + int(code[0]-'A'))
	r2 := rune(0x1F1E6 + int(code[1]-'A'))
	return string(r1) + string(r2)
}

// helpBar renders a horizontal help bar for a set of key hints.
func helpBar(hints ...string) string {
	return styleHelp.Render(strings.Join(hints, "  "))
}
