package ui

import (
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// drsRange is the gap threshold (seconds) within which two drivers are
// considered to be in a battle. 1.0s is the DRS activation gap in F1.
const drsRange = 1.0

// Battle represents an active on-track duel between two drivers.
type Battle struct {
	LeaderNum    string // racing number of the driver ahead
	ChaserNum    string // racing number of the driver behind
	GapSeconds   float64
	LeaderData   LiveDriverData
	ChaserData   LiveDriverData
	LeaderInfo   F1DriverListEntry
	ChaserInfo   F1DriverListEntry
	LeaderTyre   LiveTyreData
	ChaserTyre   LiveTyreData
	LeaderStints []LiveStintData
	ChaserStints []LiveStintData
	// GapHistory for the chaser (interval to car ahead)
	GapHistory []float64
}

// detectBattles scans the sorted driver list and returns all pairs whose
// interval to the car directly ahead is within drsRange seconds.
func detectBattles(
	drivers []LiveDriverData,
	driverInfo map[string]F1DriverListEntry,
	tyres map[string]LiveTyreData,
	stints map[string][]LiveStintData,
	gapHistory map[string][]float64,
) []Battle {
	var battles []Battle

	// Build position-sorted list (positioned drivers only)
	var positioned []LiveDriverData
	for _, d := range drivers {
		if d.Position > 0 && !d.Retired && !d.InPit {
			positioned = append(positioned, d)
		}
	}
	sort.Slice(positioned, func(i, j int) bool {
		return positioned[i].Position < positioned[j].Position
	})

	for i := 1; i < len(positioned); i++ {
		chaser := positioned[i]
		leader := positioned[i-1]

		gap := parseGapToFloat(chaser.Interval)
		if gap < 0 || gap > drsRange {
			continue
		}

		b := Battle{
			LeaderNum:    leader.RacingNumber,
			ChaserNum:    chaser.RacingNumber,
			GapSeconds:   gap,
			LeaderData:   leader,
			ChaserData:   chaser,
			LeaderInfo:   driverInfo[leader.RacingNumber],
			ChaserInfo:   driverInfo[chaser.RacingNumber],
			LeaderTyre:   tyres[leader.RacingNumber],
			ChaserTyre:   tyres[chaser.RacingNumber],
			LeaderStints: stints[leader.RacingNumber],
			ChaserStints: stints[chaser.RacingNumber],
			GapHistory:   gapHistory[chaser.RacingNumber],
		}
		battles = append(battles, b)
	}
	return battles
}

// renderBattlePanel renders the full battle tracker panel.
// width is the available character width.
func renderBattlePanel(
	battles []Battle,
	width int,
	isRace bool,
) string {
	var sb strings.Builder

	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorF1Red)).
		Render("⚔  BATTLE TRACKER")

	subtitle := styleMuted.Render(fmt.Sprintf("  drivers within %.1fs (DRS range)", drsRange))
	sb.WriteString("  " + title + "  " + subtitle + "\n")
	sb.WriteString("  " + divider(min(width-4, 70)) + "\n")

	if !isRace {
		sb.WriteString("\n" + styleMuted.Render("  Battle tracker is only available during Race sessions.\n"))
		return sb.String()
	}

	if len(battles) == 0 {
		sb.WriteString("\n" + styleMuted.Render("  No active battles detected — all gaps > 1.0s.\n"))
		return sb.String()
	}

	for i, b := range battles {
		if i > 0 {
			sb.WriteString("  " + styleMuted.Render(strings.Repeat("·", min(width-4, 60))) + "\n")
		}
		sb.WriteString(renderBattleCard(b, width))
	}

	return sb.String()
}

// renderBattleCard renders a single battle card showing both drivers side by side.
func renderBattleCard(b Battle, width int) string {
	var sb strings.Builder

	// ── Gap headline ──────────────────────────────────────────────────────────
	gapStr := fmt.Sprintf("%.3fs", b.GapSeconds)
	var gapColor string
	switch {
	case b.GapSeconds < 0.3:
		gapColor = colorF1Red // very close, danger
	case b.GapSeconds < 0.6:
		gapColor = colorOrange
	default:
		gapColor = colorYellow
	}
	gapStyled := lipgloss.NewStyle().Foreground(lipgloss.Color(gapColor)).Bold(true).Render(gapStr)

	trend := ""
	if len(b.GapHistory) >= 2 {
		trend = "  " + gapTrendIndicator(b.GapHistory)
	}

	sb.WriteString(fmt.Sprintf("  P%d vs P%d  gap: %s%s\n",
		b.LeaderData.Position, b.ChaserData.Position,
		gapStyled, trend))

	// ── Driver rows ───────────────────────────────────────────────────────────
	// Each row: [TEAM-COLOR-BAR] TLA  tyre(age)  lastlap  best  stints
	sb.WriteString(renderBattleDriverRow("AHEAD", b.LeaderData, b.LeaderInfo, b.LeaderTyre, b.LeaderStints))
	sb.WriteString(renderBattleDriverRow("CHASE", b.ChaserData, b.ChaserInfo, b.ChaserTyre, b.ChaserStints))

	return sb.String()
}

func renderBattleDriverRow(
	role string,
	d LiveDriverData,
	info F1DriverListEntry,
	tyre LiveTyreData,
	stints []LiveStintData,
) string {
	tla := d.RacingNumber
	teamColor := colorMuted
	if info.Tla != "" {
		tla = info.Tla
	}
	if info.TeamColour != "" {
		teamColor = "#" + info.TeamColour
	} else if info.TeamName != "" {
		teamColor = teamColorFromName(info.TeamName)
	}

	colorBar := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")
	tlaStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(teamColor))

	roleStyle := styleMuted
	tlaRendered := tlaStyle.Render(padRight(tla, 4))

	// Tyre indicator
	tyreStr := "  ?"
	if tyre.Compound != "" {
		abbrev, ts := compoundAbbrevStyle(strings.ToUpper(tyre.Compound))
		newMark := " "
		if tyre.New {
			newMark = ts.Render("*")
		}
		tyreStr = ts.Render("●") + " " + abbrev + newMark
		if tyre.Age > 0 {
			tyreStr += styleMuted.Render(fmt.Sprintf("/%d", tyre.Age))
		}
	}

	// Last lap time
	lastLap := styleMuted.Render("  --:--.---")
	if d.LastLapTime != "" {
		ll := d.LastLapTime
		if d.LastLapOB {
			lastLap = "  " + stylePurple.Render(ll)
		} else if d.LastLapPB {
			lastLap = "  " + lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen)).Render(ll)
		} else {
			lastLap = "  " + ll
		}
	}

	// Stint history (compact: S(12)→M(5))
	stintStr := ""
	if len(stints) > 0 {
		var parts []string
		for _, st := range stints {
			abbrev, ts := compoundAbbrevStyle(strings.ToUpper(st.Compound))
			newMark := ""
			if st.New {
				newMark = "*"
			}
			parts = append(parts, ts.Render(fmt.Sprintf("%s(%d%s)", abbrev, st.Laps, newMark)))
		}
		stintStr = "  " + strings.Join(parts, styleMuted.Render("→"))
	}

	row := fmt.Sprintf("  %s  %s  %s  %s%s%s",
		colorBar,
		roleStyle.Render(padRight(role, 5)),
		tlaRendered,
		tyreStr,
		lastLap,
		stintStr,
	)

	return row + "\n"
}
