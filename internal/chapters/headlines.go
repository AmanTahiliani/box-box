package chapters

import (
	"fmt"
	"strings"

	"github.com/AmanTahiliani/box-box/internal/models"
)

// DriverIdentityInput carries session driver fields used for headline templates.
type DriverIdentityInput struct {
	DriverNumber int
	NameAcronym  string
	FullName     string
	TeamName     string
}

type driverIdentity struct {
	display string
	team    string
	acronym string
}

// BuildDriverMap indexes driver identity from session drivers and enriched results.
func BuildDriverMap(drivers []models.Driver, results []DriverIdentityInput) map[int]driverIdentity {
	out := map[int]driverIdentity{}
	for _, d := range drivers {
		if d.DriverNumber <= 0 {
			continue
		}
		out[d.DriverNumber] = driverIdentity{
			display: driverDisplayName(d.LastName, d.FullName, d.NameAcronym, d.BroadcastName),
			team:    d.TeamName,
			acronym: firstNonEmpty(d.NameAcronym, d.BroadcastName),
		}
	}
	for _, r := range results {
		if r.DriverNumber <= 0 {
			continue
		}
		if _, ok := out[r.DriverNumber]; ok {
			continue
		}
		out[r.DriverNumber] = driverIdentity{
			display: driverDisplayName("", r.FullName, r.NameAcronym, ""),
			team:    r.TeamName,
			acronym: r.NameAcronym,
		}
	}
	return out
}

// ApplyHeadlines fills Headline on each chapter using deterministic templates.
func ApplyHeadlines(chapters []Chapter, drivers map[int]driverIdentity, rc []RaceControl, winnerNumber int) []Chapter {
	out := make([]Chapter, len(chapters))
	copy(out, chapters)
	for i := range out {
		out[i].Headline = headlineFor(out[i], drivers, rc, winnerNumber)
	}
	return out
}

func headlineFor(ch Chapter, drivers map[int]driverIdentity, rc []RaceControl, winnerNumber int) string {
	switch ch.Kind {
	case KindStart:
		return pickVariant(ch.StartLap,
			"Lights out — the field charges into Turn 1",
			"Race start — Lap 1 shuffle at the front",
		)
	case KindSafetyCar:
		if name := driverName(ch, drivers, incidentDriver(rc, ch.StartLap)); name != "" {
			return pickVariant(ch.StartLap,
				fmt.Sprintf("%s incident brings out the Safety Car — leaders dive for the pits", name),
				fmt.Sprintf("Safety Car deployed after %s stops on track", name),
			)
		}
	case KindVirtualSafetyCar:
		if name := driverName(ch, drivers, incidentDriver(rc, ch.StartLap)); name != "" {
			return pickVariant(ch.StartLap,
				fmt.Sprintf("%s off track triggers the Virtual Safety Car", name),
				fmt.Sprintf("Virtual Safety Car — %s loses control on Lap %d", name, ch.StartLap),
			)
		}
		return pickVariant(ch.StartLap,
			fmt.Sprintf("Virtual Safety Car deployed on Lap %d", ch.StartLap),
			fmt.Sprintf("VSC period — field backs off on L%d–L%d", ch.StartLap, ch.EndLap),
		)
	case KindRedFlag:
		if name := driverName(ch, drivers, incidentDriver(rc, ch.StartLap)); name != "" {
			return pickVariant(ch.StartLap,
				fmt.Sprintf("%s crash forces a red flag on Lap %d", name, ch.StartLap),
				fmt.Sprintf("Red flag after %s incident on Lap %d", name, ch.StartLap),
			)
		}
		return pickVariant(ch.StartLap,
			fmt.Sprintf("Red flag — session halted on Lap %d", ch.StartLap),
			fmt.Sprintf("Race suspended under red flag on L%d–L%d", ch.StartLap, ch.EndLap),
		)
	case KindPitPhase:
		names := driverNames(ch.DriverNumbers, drivers, 3)
		if len(names) >= 2 {
			return pickVariant(ch.StartLap,
				fmt.Sprintf("Mass pit-window scramble — %s and %s box on L%d–L%d", names[0], names[1], ch.StartLap, ch.EndLap),
				fmt.Sprintf("Undercut window opens — %s leads the pit rush on L%d–L%d", names[0], ch.StartLap, ch.EndLap),
			)
		}
		if len(names) == 1 {
			return pickVariant(ch.StartLap,
				fmt.Sprintf("%s pits under green — strategy window opens on L%d", names[0], ch.StartLap),
				fmt.Sprintf("Pit phase on L%d–L%d — %s among the first to stop", ch.StartLap, ch.EndLap, names[0]),
			)
		}
	case KindDecisiveSwing:
		if len(ch.DriverNumbers) >= 2 {
			attacker := driverName(ch, drivers, ch.DriverNumbers[0])
			defender := driverName(ch, drivers, ch.DriverNumbers[1])
			pos := swingPosition(ch.Title)
			if attacker != "" && defender != "" && pos > 0 {
				return pickVariant(ch.StartLap,
					fmt.Sprintf("%s overtakes %s for P%d", attacker, defender, pos),
					fmt.Sprintf("%s charges past %s into P%d on Lap %d", attacker, defender, pos, ch.StartLap),
				)
			}
		}
		if len(ch.DriverNumbers) >= 1 {
			attacker := driverName(ch, drivers, ch.DriverNumbers[0])
			pos := swingPosition(ch.Title)
			if attacker != "" && pos > 0 {
				return pickVariant(ch.StartLap,
					fmt.Sprintf("%s moves up to P%d on Lap %d", attacker, pos, ch.StartLap),
					fmt.Sprintf("Decisive swing — %s climbs to P%d", attacker, pos),
				)
			}
		}
	case KindFinish:
		winner := driverName(ch, drivers, winnerNumber)
		if winner != "" {
			return pickVariant(ch.StartLap,
				fmt.Sprintf("%s crosses the line to take the win", winner),
				fmt.Sprintf("Chequered flag — %s wins the race", winner),
			)
		}
	}
	return ch.Title
}

func pickVariant(seed int, variants ...string) string {
	if len(variants) == 0 {
		return ""
	}
	if seed < 0 {
		seed = -seed
	}
	return variants[seed%len(variants)]
}

func driverName(_ Chapter, drivers map[int]driverIdentity, number int) string {
	if number <= 0 {
		return ""
	}
	if id, ok := drivers[number]; ok && id.display != "" {
		return id.display
	}
	return ""
}

func driverNames(numbers []int, drivers map[int]driverIdentity, limit int) []string {
	out := make([]string, 0, limit)
	for _, number := range numbers {
		if name := driverName(Chapter{}, drivers, number); name != "" {
			out = append(out, name)
			if len(out) >= limit {
				break
			}
		}
	}
	return out
}

func driverDisplayName(lastName, fullName, acronym, broadcast string) string {
	if lastName != "" {
		return lastName
	}
	if fullName != "" {
		parts := strings.Fields(fullName)
		if len(parts) > 0 {
			return parts[len(parts)-1]
		}
		return fullName
	}
	return firstNonEmpty(acronym, broadcast)
}

func incidentDriver(rc []RaceControl, startLap int) int {
	for _, msg := range rc {
		if msg.DriverNumber == nil || *msg.DriverNumber <= 0 {
			continue
		}
		lap := 0
		if msg.LapNumber != nil {
			lap = *msg.LapNumber
		}
		if lap < startLap-1 || lap > startLap+1 {
			continue
		}
		text := upperText(msg.Message, string(msg.Category))
		if strings.Contains(text, "DEPLOY") ||
			strings.Contains(text, "CLEAR") ||
			strings.Contains(text, "ENDING") ||
			strings.Contains(text, "GREEN") ||
			strings.Contains(text, "CHEQUER") {
			continue
		}
		return *msg.DriverNumber
	}
	return 0
}

func swingPosition(title string) int {
	// Title format: "Decisive swing: #16 to P3 (L6)"
	idx := strings.Index(title, "P")
	if idx < 0 || idx+1 >= len(title) {
		return 0
	}
	pos := 0
	for i := idx + 1; i < len(title); i++ {
		if title[i] < '0' || title[i] > '9' {
			break
		}
		pos = pos*10 + int(title[i]-'0')
	}
	return pos
}
