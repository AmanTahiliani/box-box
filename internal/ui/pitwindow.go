package ui

import (
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// ---------------------------------------------------------------------------
// Pit loss table — average pit lane + stationary time per circuit.
// These are sensible defaults derived from historical F1 data.
// All times are in seconds.
// ---------------------------------------------------------------------------

// pitLossTable maps circuit short names (lowercased) to average pit loss time.
// Pit loss = pit lane traversal time delta vs staying on track at race pace.
var pitLossTable = map[string]float64{
	"monza":       17.0,
	"spa":         21.0,
	"silverstone": 22.0,
	"monaco":      25.0,
	"singapore":   30.0,
	"baku":        24.0,
	"montreal":    23.0,
	"austin":      23.5,
	"mexico":      21.0,
	"interlagos":  24.0,
	"suzuka":      22.5,
	"bahrain":     22.0,
	"jeddah":      21.5,
	"melbourne":   25.0,
	"shanghai":    25.0,
	"miami":       24.5,
	"barcelona":   22.0,
	"budapest":    25.5,
	"zandvoort":   24.5,
	"abu dhabi":   23.0,
	"las vegas":   26.0,
	"imola":       25.0,
	"lusail":      22.0,
}

const defaultPitLoss = 23.0 // fallback when circuit not in table

// pitWindowLookupLoss returns the pit loss for the current circuit name.
// Falls back to defaultPitLoss.
func pitWindowLookupLoss(circuitName string) float64 {
	lower := strings.ToLower(circuitName)
	for k, v := range pitLossTable {
		if strings.Contains(lower, k) {
			return v
		}
	}
	return defaultPitLoss
}

// ---------------------------------------------------------------------------
// Pit window prediction logic
// ---------------------------------------------------------------------------

// PitPrediction describes the predicted outcome if a given driver pits now.
type PitPrediction struct {
	DriverNum   string
	DriverTLA   string
	TeamColor   string
	PredictedP  int     // predicted position after rejoin
	RejoinGap   float64 // gap to the car they'd rejoin behind (seconds, +ve = behind)
	TightestCar string  // TLA of the nearest rival after rejoin
	PitLoss     float64 // pit stop time cost used in this calculation
}

// computePitWindow calculates the predicted pit window for every positioned
// driver that is currently on track (not in pit, not retired).
//
// Algorithm:
//  1. For each driver D, simulate their position after a pit stop of pitLoss seconds.
//  2. For each rival R ahead of D: if gap(D→R) + pitLoss > 0, D rejoins behind R.
//  3. For each rival R behind D: if gap(D→R) - pitLoss < threshold, R may undercut D.
//  4. Return the predicted finishing position after the pit.
func computePitWindow(
	drivers map[string]LiveDriverData,
	driverInfo map[string]F1DriverListEntry,
	pitLoss float64,
) []PitPrediction {
	if len(drivers) == 0 {
		return nil
	}

	// Sort all on-track drivers by position
	var sorted []LiveDriverData
	for _, d := range drivers {
		if d.Position > 0 && !d.Retired && !d.InPit {
			sorted = append(sorted, d)
		}
	}
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Position < sorted[j].Position
	})

	// Build gap-to-leader map (seconds, -1 = leader)
	gapToLeader := make(map[string]float64, len(sorted))
	for _, d := range sorted {
		if d.Position == 1 {
			gapToLeader[d.RacingNumber] = 0
		} else {
			g := parseGapToFloat(d.GapToLeader)
			if g < 0 {
				g = 9999 // lapped car
			}
			gapToLeader[d.RacingNumber] = g
		}
	}

	var predictions []PitPrediction

	for _, d := range sorted {
		dGap := gapToLeader[d.RacingNumber]
		if dGap == 9999 {
			continue // don't predict for lapped cars
		}

		// Gap after pit stop = original gap + pitLoss (D is now pitLoss seconds further back)
		gapAfterPit := dGap + pitLoss

		// Count rivals ahead that D will now be behind
		predictedPos := 1
		var rejoinBehind LiveDriverData
		tightestGap := 9999.0

		for _, rival := range sorted {
			if rival.RacingNumber == d.RacingNumber {
				continue
			}
			rGap := gapToLeader[rival.RacingNumber]
			if rGap == 9999 {
				continue
			}
			// Rival is ahead if their gap < gapAfterPit
			if rGap < gapAfterPit {
				predictedPos++
				// Track the rival we'd rejoin closest behind
				behind := gapAfterPit - rGap
				if behind < tightestGap {
					tightestGap = behind
					rejoinBehind = rival
				}
			}
		}

		// Team color
		teamColor := colorMuted
		tla := d.RacingNumber
		if info, ok := driverInfo[d.RacingNumber]; ok {
			if info.Tla != "" {
				tla = info.Tla
			}
			if info.TeamColour != "" {
				teamColor = "#" + info.TeamColour
			} else if info.TeamName != "" {
				teamColor = teamColorFromName(info.TeamName)
			}
		}

		tightestTLA := ""
		if rejoinBehind.RacingNumber != "" {
			if info, ok := driverInfo[rejoinBehind.RacingNumber]; ok && info.Tla != "" {
				tightestTLA = info.Tla
			} else {
				tightestTLA = rejoinBehind.RacingNumber
			}
		}

		rejoinGap := 0.0
		if tightestGap < 9999 {
			rejoinGap = tightestGap
		}

		predictions = append(predictions, PitPrediction{
			DriverNum:   d.RacingNumber,
			DriverTLA:   tla,
			TeamColor:   teamColor,
			PredictedP:  predictedPos,
			RejoinGap:   rejoinGap,
			TightestCar: tightestTLA,
			PitLoss:     pitLoss,
		})
	}

	// Sort predictions by current position (same as sorted)
	sort.Slice(predictions, func(i, j int) bool {
		di, _ := drivers[predictions[i].DriverNum]
		dj, _ := drivers[predictions[j].DriverNum]
		return di.Position < dj.Position
	})

	return predictions
}

// ---------------------------------------------------------------------------
// Pit window view renderer
// ---------------------------------------------------------------------------

// renderPitWindowPanel renders the full pit window calculator panel.
func renderPitWindowPanel(
	drivers map[string]LiveDriverData,
	driverInfo map[string]F1DriverListEntry,
	circuitName string,
	isRace bool,
	width int,
) string {
	var sb strings.Builder

	pitLoss := pitWindowLookupLoss(circuitName)

	title := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorF1Red)).
		Render("🔧 PIT WINDOW CALCULATOR")
	meta := styleMuted.Render(fmt.Sprintf("circuit: %s  pit loss: %.1fs",
		circuitNameShort(circuitName), pitLoss))

	sb.WriteString("  " + title + "\n")
	sb.WriteString("  " + meta + "\n")
	sb.WriteString("  " + divider(min(width-4, 70)) + "\n")

	if !isRace {
		sb.WriteString("\n" + styleMuted.Render("  Pit window calculator is only available during Race sessions.\n"))
		return sb.String()
	}

	if len(drivers) == 0 {
		sb.WriteString("\n" + styleMuted.Render("  Waiting for timing data...\n"))
		return sb.String()
	}

	predictions := computePitWindow(drivers, driverInfo, pitLoss)
	if len(predictions) == 0 {
		sb.WriteString("\n" + styleMuted.Render("  Not enough timing data to compute pit window.\n"))
		return sb.String()
	}

	// Table header
	sb.WriteString(styleMuted.Render(fmt.Sprintf("  %-4s  %-4s  %-6s  %-6s  %s\n",
		"NOW", "TLA", "→ P", "GAP", "REJOINS BEHIND")))
	sb.WriteString("  " + divider(min(width-4, 55)) + "\n")

	for _, p := range predictions {
		d := drivers[p.DriverNum]
		curPosStr := renderPosition(d.Position)
		predPosStr := renderPosition(p.PredictedP)

		tlaStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(p.TeamColor))
		tlaRendered := tlaStyle.Render(padRight(p.DriverTLA, 4))

		// Position change indicator
		diff := d.Position - p.PredictedP // negative = losing positions
		var posChange string
		switch {
		case diff > 0:
			posChange = styleDeltaUp.Render(fmt.Sprintf("▲%d", diff))
		case diff < 0:
			posChange = styleDeltaDown.Render(fmt.Sprintf("▼%d", -diff))
		default:
			posChange = styleDeltaEqual.Render("─")
		}

		// Rejoin gap
		gapStr := styleMuted.Render("  -")
		if p.RejoinGap > 0 {
			gapStr = styleGap.Render(fmt.Sprintf("+%.1fs", p.RejoinGap))
		}

		// Rejoin target
		rejoinStr := ""
		if p.TightestCar != "" {
			rejoinStr = styleMuted.Render("behind ") + styleBold.Render(p.TightestCar)
		} else if p.PredictedP == 1 {
			rejoinStr = styleLeader.Render("LEADS")
		}

		sb.WriteString(fmt.Sprintf("  %s  %s  %s %s  %s  %s\n",
			padRightVisible(curPosStr, 4),
			tlaRendered,
			padRightVisible(predPosStr, 2),
			padRightVisible(posChange, 3),
			padRightVisible(gapStr, 7),
			rejoinStr,
		))
	}

	sb.WriteString("\n")
	sb.WriteString(styleMuted.Render(fmt.Sprintf("  Assumes %.1fs pit loss. Gaps are approximate.", pitLoss)))
	sb.WriteString("\n")

	return sb.String()
}

// circuitNameShort returns a display-friendly short name for a circuit.
func circuitNameShort(name string) string {
	if name == "" {
		return "Unknown"
	}
	if len(name) > 20 {
		return name[:20] + "…"
	}
	return name
}
