package chapters

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

const (
	KindStart            = "start"
	KindSafetyCar        = "safety_car"
	KindVirtualSafetyCar = "virtual_safety_car"
	KindRedFlag          = "red_flag"
	KindPitPhase         = "pit_phase"
	KindDecisiveSwing    = "decisive_swing"
	KindFinish           = "finish"

	pitPhaseWindowLaps = 3
	pitPhaseShare      = 0.30
	minPitPhaseStops   = 2
	maxDecisiveSwings  = 3
	decisiveAfterLap   = 5
	structuralPriority = 110
	flagPriority       = 100
	pitPhasePriority   = 50
	decisivePriority   = 40
)

type RaceControl = models.RaceControl
type PositionSample = models.Position
type Lap = models.Lap

// Chapter is a deterministic replay segment derived from timing and race-control data.
type Chapter struct {
	Kind          string `json:"kind"`
	Title         string `json:"title"`
	Headline      string `json:"headline"`
	StartLap      int    `json:"start_lap"`
	EndLap        int    `json:"end_lap"`
	StartTime     string `json:"start_time,omitempty"`
	EndTime       string `json:"end_time,omitempty"`
	DriverNumbers []int  `json:"driver_numbers"`
}

// Detect builds replay chapters from already-loaded race-hub datasets.
func Detect(rc []RaceControl, positions []PositionSample, laps []Lap, totalLaps int) []Chapter {
	totalLaps = normalizeTotalLaps(totalLaps, laps, rc)
	if totalLaps <= 0 && len(rc) == 0 && len(positions) == 0 && len(laps) == 0 {
		return []Chapter{}
	}
	if totalLaps <= 0 {
		totalLaps = 1
	}

	lapIndex := buildLapIndex(laps)
	chapters := []Chapter{
		{
			Kind:      KindStart,
			Title:     "Start",
			StartLap:  1,
			EndLap:    minInt(1, totalLaps),
			StartTime: lapIndex.lapStart(1),
			EndTime:   lapIndex.lapEnd(1),
		},
	}
	chapters = append(chapters, detectFlagPeriods(rc, lapIndex, totalLaps)...)
	chapters = append(chapters, detectPitPhases(laps, lapIndex)...)
	chapters = append(chapters, detectDecisiveSwings(positions, lapIndex, totalLaps)...)
	chapters = append(chapters, detectFinish(rc, lapIndex, totalLaps))

	return resolveConflicts(chapters, lapIndex)
}

func normalizeTotalLaps(totalLaps int, laps []Lap, rc []RaceControl) int {
	for _, l := range laps {
		if l.LapNumber > totalLaps {
			totalLaps = l.LapNumber
		}
	}
	for _, msg := range rc {
		if msg.LapNumber != nil && *msg.LapNumber > totalLaps {
			totalLaps = *msg.LapNumber
		}
	}
	return totalLaps
}

type lapIndex struct {
	byLap  map[int]string
	events []lapEvent
}

type lapEvent struct {
	lap int
	at  time.Time
}

func buildLapIndex(laps []Lap) lapIndex {
	idx := lapIndex{byLap: map[int]string{}}
	for _, l := range laps {
		if l.LapNumber <= 0 || l.DateStart == "" {
			continue
		}
		if _, ok := idx.byLap[l.LapNumber]; !ok {
			idx.byLap[l.LapNumber] = l.DateStart
		}
		at, ok := parseTime(l.DateStart)
		if ok {
			idx.events = append(idx.events, lapEvent{lap: l.LapNumber, at: at})
		}
	}
	sort.Slice(idx.events, func(i, j int) bool {
		if idx.events[i].at.Equal(idx.events[j].at) {
			return idx.events[i].lap < idx.events[j].lap
		}
		return idx.events[i].at.Before(idx.events[j].at)
	})
	return idx
}

func (idx lapIndex) lapStart(lap int) string {
	return idx.byLap[lap]
}

func (idx lapIndex) lapEnd(lap int) string {
	if v := idx.byLap[lap+1]; v != "" {
		return v
	}
	return idx.byLap[lap]
}

func (idx lapIndex) lapForTime(raw string) int {
	at, ok := parseTime(raw)
	if !ok || len(idx.events) == 0 {
		return 0
	}
	lap := 0
	for _, event := range idx.events {
		if event.at.After(at) {
			break
		}
		lap = event.lap
	}
	if lap == 0 {
		return idx.events[0].lap
	}
	return lap
}

type flagState struct {
	startLap  int
	startTime string
}

func detectFlagPeriods(rc []RaceControl, idx lapIndex, totalLaps int) []Chapter {
	var chapters []Chapter
	active := map[string]flagState{}
	for _, msg := range rc {
		kind, ok := flagKind(msg)
		if !ok && greenFlagClear(msg) {
			for activeKind, st := range active {
				lap := messageLap(msg, idx)
				if lap <= 0 {
					lap = st.startLap
				}
				endLap := clampLap(lap, st.startLap, totalLaps)
				chapters = append(chapters, Chapter{
					Kind:      activeKind,
					Title:     flagTitle(activeKind, st.startLap, endLap),
					StartLap:  st.startLap,
					EndLap:    endLap,
					StartTime: st.startTime,
					EndTime:   firstNonEmpty(msg.Date, idx.lapEnd(endLap)),
				})
				delete(active, activeKind)
			}
			continue
		}
		if !ok {
			continue
		}
		lap := messageLap(msg, idx)
		if lap <= 0 {
			lap = 1
		}
		if flagCleared(msg) {
			st, ok := active[kind]
			if !ok {
				continue
			}
			endLap := clampLap(lap, st.startLap, totalLaps)
			chapters = append(chapters, Chapter{
				Kind:      kind,
				Title:     flagTitle(kind, st.startLap, endLap),
				StartLap:  st.startLap,
				EndLap:    endLap,
				StartTime: st.startTime,
				EndTime:   firstNonEmpty(msg.Date, idx.lapEnd(endLap)),
			})
			delete(active, kind)
			continue
		}
		if flagStarted(msg) {
			active[kind] = flagState{
				startLap:  clampLap(lap, 1, totalLaps),
				startTime: firstNonEmpty(msg.Date, idx.lapStart(lap)),
			}
		}
	}
	for kind, st := range active {
		endLap := totalLaps
		chapters = append(chapters, Chapter{
			Kind:      kind,
			Title:     flagTitle(kind, st.startLap, endLap),
			StartLap:  st.startLap,
			EndLap:    endLap,
			StartTime: st.startTime,
			EndTime:   idx.lapEnd(endLap),
		})
	}
	return chapters
}

func flagKind(msg RaceControl) (string, bool) {
	text := upperText(string(msg.Category), string(msg.Flag), msg.Message)
	if strings.Contains(text, "VSC") || strings.Contains(text, "VIRTUAL SAFETY CAR") {
		return KindVirtualSafetyCar, true
	}
	if strings.Contains(text, "RED FLAG") || string(msg.Flag) == string(models.FlagRed) {
		return KindRedFlag, true
	}
	if strings.Contains(text, "SAFETY CAR") || msg.Category == models.CategorySafetyCar {
		return KindSafetyCar, true
	}
	return "", false
}

func flagStarted(msg RaceControl) bool {
	text := upperText(string(msg.Category), string(msg.Flag), msg.Message)
	if strings.Contains(text, "CLEAR") || strings.Contains(text, "ENDING") || strings.Contains(text, "IN THIS LAP") || strings.Contains(text, "GREEN") {
		return false
	}
	return strings.Contains(text, "DEPLOY") ||
		strings.Contains(text, "RED FLAG") ||
		strings.Contains(text, "VIRTUAL SAFETY CAR") ||
		strings.Contains(text, "VSC") ||
		strings.Contains(text, "SAFETY CAR") ||
		string(msg.Flag) == string(models.FlagRed)
}

func flagCleared(msg RaceControl) bool {
	text := upperText(string(msg.Category), string(msg.Flag), msg.Message)
	return strings.Contains(text, "CLEAR") ||
		strings.Contains(text, "ENDING") ||
		strings.Contains(text, "IN THIS LAP") ||
		strings.Contains(text, "GREEN")
}

func greenFlagClear(msg RaceControl) bool {
	text := upperText(string(msg.Flag), msg.Message)
	return strings.Contains(text, "GREEN")
}

func flagTitle(kind string, startLap, endLap int) string {
	name := "Flag period"
	switch kind {
	case KindSafetyCar:
		name = "Safety Car"
	case KindVirtualSafetyCar:
		name = "Virtual Safety Car"
	case KindRedFlag:
		name = "Red Flag"
	}
	return fmt.Sprintf("%s (L%d-L%d)", name, startLap, endLap)
}

func detectPitPhases(laps []Lap, idx lapIndex) []Chapter {
	type pitOut struct {
		lap    int
		driver int
	}
	var stops []pitOut
	for _, l := range laps {
		if l.IsPitOutLap && l.LapNumber > 0 {
			stops = append(stops, pitOut{lap: l.LapNumber, driver: l.DriverNumber})
		}
	}
	if len(stops) < minPitPhaseStops {
		return nil
	}
	sort.Slice(stops, func(i, j int) bool {
		if stops[i].lap == stops[j].lap {
			return stops[i].driver < stops[j].driver
		}
		return stops[i].lap < stops[j].lap
	})
	needed := int(math.Ceil(float64(len(stops)) * pitPhaseShare))
	if needed < minPitPhaseStops {
		needed = minPitPhaseStops
	}

	var windows []Chapter
	for i := 0; i < len(stops); i++ {
		start := stops[i].lap
		end := start + pitPhaseWindowLaps - 1
		drivers := map[int]bool{}
		count := 0
		for _, stop := range stops {
			if stop.lap < start || stop.lap > end {
				continue
			}
			count++
			drivers[stop.driver] = true
		}
		if count < needed {
			continue
		}
		ch := Chapter{
			Kind:          KindPitPhase,
			Title:         pitPhaseTitle(start, end),
			StartLap:      start,
			EndLap:        end,
			StartTime:     idx.lapStart(start),
			EndTime:       idx.lapEnd(end),
			DriverNumbers: sortedDriverNumbers(drivers),
		}
		if len(windows) > 0 && ch.StartLap <= windows[len(windows)-1].EndLap+1 {
			last := &windows[len(windows)-1]
			if ch.EndLap > last.EndLap {
				last.EndLap = ch.EndLap
				last.EndTime = idx.lapEnd(last.EndLap)
			}
			drivers := sliceToSet(last.DriverNumbers)
			for _, driver := range ch.DriverNumbers {
				drivers[driver] = true
			}
			last.DriverNumbers = sortedDriverNumbers(drivers)
			last.Title = pitPhaseTitle(last.StartLap, last.EndLap)
			continue
		}
		windows = append(windows, ch)
	}
	return windows
}

type swingCandidate struct {
	chapter      Chapter
	significance int
}

func detectDecisiveSwings(positions []PositionSample, idx lapIndex, totalLaps int) []Chapter {
	if len(positions) == 0 || len(idx.events) == 0 || totalLaps <= decisiveAfterLap {
		return nil
	}
	snapshots := buildPositionSnapshots(positions, idx, totalLaps)
	if len(snapshots) == 0 {
		return nil
	}
	final := snapshots[totalLaps]
	if len(final) == 0 {
		for lap := totalLaps - 1; lap >= 1; lap-- {
			if len(snapshots[lap]) > 0 {
				final = snapshots[lap]
				break
			}
		}
	}
	var candidates []swingCandidate
	seenDriver := map[int]bool{}
	for lap := decisiveAfterLap + 1; lap <= totalLaps; lap++ {
		prev := snapshots[lap-1]
		curr := snapshots[lap]
		if len(prev) == 0 || len(curr) == 0 {
			continue
		}
		for driver, pos := range curr {
			prevPos, ok := prev[driver]
			if !ok || prevPos <= pos || pos > 5 || pos <= 0 || seenDriver[driver] {
				continue
			}
			finalPos, ok := final[driver]
			if !ok || finalPos > pos {
				continue
			}
			overtaken := driverAtPosition(curr, prevPos, driver)
			drivers := []int{driver}
			if overtaken != 0 {
				drivers = append(drivers, overtaken)
			}
			candidates = append(candidates, swingCandidate{
				chapter: Chapter{
					Kind:          KindDecisiveSwing,
					Title:         fmt.Sprintf("Decisive swing: #%d to P%d (L%d)", driver, pos, lap),
					StartLap:      lap,
					EndLap:        lap,
					StartTime:     idx.lapStart(lap),
					EndTime:       idx.lapEnd(lap),
					DriverNumbers: drivers,
				},
				significance: (prevPos-pos)*10 + (6 - pos),
			})
			seenDriver[driver] = true
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].significance == candidates[j].significance {
			return candidates[i].chapter.StartLap < candidates[j].chapter.StartLap
		}
		return candidates[i].significance > candidates[j].significance
	})
	if len(candidates) > maxDecisiveSwings {
		candidates = candidates[:maxDecisiveSwings]
	}
	out := make([]Chapter, 0, len(candidates))
	for _, c := range candidates {
		out = append(out, c.chapter)
	}
	return out
}

func buildPositionSnapshots(positions []PositionSample, idx lapIndex, totalLaps int) map[int]map[int]int {
	byLap := map[int][]PositionSample{}
	for _, p := range positions {
		if p.Position <= 0 {
			continue
		}
		lap := idx.lapForTime(p.Date)
		if lap <= 0 || lap > totalLaps {
			continue
		}
		byLap[lap] = append(byLap[lap], p)
	}
	last := map[int]int{}
	snapshots := map[int]map[int]int{}
	for lap := 1; lap <= totalLaps; lap++ {
		for _, p := range byLap[lap] {
			last[p.DriverNumber] = p.Position
		}
		if len(last) == 0 {
			continue
		}
		cp := make(map[int]int, len(last))
		for driver, pos := range last {
			cp[driver] = pos
		}
		snapshots[lap] = cp
	}
	return snapshots
}

func driverAtPosition(snapshot map[int]int, pos int, exclude int) int {
	for driver, driverPos := range snapshot {
		if driver != exclude && driverPos == pos {
			return driver
		}
	}
	return 0
}

func detectFinish(rc []RaceControl, idx lapIndex, totalLaps int) Chapter {
	finishLap := totalLaps
	finishTime := idx.lapEnd(totalLaps)
	for _, msg := range rc {
		text := upperText(string(msg.Flag), msg.Message)
		if strings.Contains(text, "CHEQUER") || string(msg.Flag) == string(models.FlagChequered) {
			if lap := messageLap(msg, idx); lap > 0 {
				finishLap = lap
			}
			finishTime = firstNonEmpty(msg.Date, finishTime)
		}
	}
	startLap := finishLap - 1
	if startLap < 1 {
		startLap = 1
	}
	return Chapter{
		Kind:      KindFinish,
		Title:     finishTitle(startLap, finishLap),
		StartLap:  startLap,
		EndLap:    finishLap,
		StartTime: idx.lapStart(startLap),
		EndTime:   finishTime,
	}
}

func pitPhaseTitle(startLap, endLap int) string {
	return fmt.Sprintf("Pit phase (L%d-L%d)", startLap, endLap)
}

func finishTitle(startLap, endLap int) string {
	return fmt.Sprintf("Finish (L%d-L%d)", startLap, endLap)
}

// titleForResolved rebuilds range-bearing titles from the final StartLap/EndLap
// after conflict resolution. Flag and pit-phase formatters are reused so stale
// pre-trim strings are never parsed.
func titleForResolved(ch Chapter) string {
	switch ch.Kind {
	case KindSafetyCar, KindVirtualSafetyCar, KindRedFlag:
		return flagTitle(ch.Kind, ch.StartLap, ch.EndLap)
	case KindPitPhase:
		return pitPhaseTitle(ch.StartLap, ch.EndLap)
	case KindFinish:
		return finishTitle(ch.StartLap, ch.EndLap)
	default:
		return ch.Title
	}
}

func resolveConflicts(chapters []Chapter, idx lapIndex) []Chapter {
	normalized := make([]Chapter, 0, len(chapters))
	for _, ch := range chapters {
		if ch.StartLap <= 0 {
			ch.StartLap = 1
		}
		if ch.EndLap <= 0 {
			ch.EndLap = ch.StartLap
		}
		if ch.EndLap < ch.StartLap {
			ch.EndLap = ch.StartLap
		}
		if ch.DriverNumbers == nil {
			ch.DriverNumbers = []int{}
		}
		normalized = append(normalized, ch)
	}
	sort.SliceStable(normalized, func(i, j int) bool {
		if normalized[i].StartLap == normalized[j].StartLap {
			return priority(normalized[i].Kind) > priority(normalized[j].Kind)
		}
		return normalized[i].StartLap < normalized[j].StartLap
	})

	out := make([]Chapter, 0, len(normalized))
	for _, ch := range normalized {
		if len(out) == 0 {
			out = append(out, ch)
			continue
		}
		last := &out[len(out)-1]
		if ch.StartLap > last.EndLap {
			out = append(out, ch)
			continue
		}
		if isFlag(last.Kind) && priority(ch.Kind) < priority(last.Kind) {
			continue
		}
		if priority(ch.Kind) > priority(last.Kind) {
			if last.StartLap < ch.StartLap {
				last.EndLap = ch.StartLap - 1
				last.EndTime = idx.lapEnd(last.EndLap)
				out = append(out, ch)
			} else {
				*last = ch
			}
			continue
		}
		if ch.EndLap > last.EndLap {
			ch.StartLap = last.EndLap + 1
			if ch.StartLap <= ch.EndLap {
				out = append(out, ch)
			}
		}
	}
	for i := range out {
		out[i].Title = titleForResolved(out[i])
	}
	return out
}

func isFlag(kind string) bool {
	return kind == KindSafetyCar || kind == KindVirtualSafetyCar || kind == KindRedFlag
}

func priority(kind string) int {
	switch kind {
	case KindStart, KindFinish:
		return structuralPriority
	case KindSafetyCar, KindVirtualSafetyCar, KindRedFlag:
		return flagPriority
	case KindPitPhase:
		return pitPhasePriority
	case KindDecisiveSwing:
		return decisivePriority
	default:
		return 0
	}
}

func messageLap(msg RaceControl, idx lapIndex) int {
	if msg.LapNumber != nil && *msg.LapNumber > 0 {
		return *msg.LapNumber
	}
	return idx.lapForTime(msg.Date)
}

func clampLap(lap, minLap, maxLap int) int {
	if lap < minLap {
		return minLap
	}
	if maxLap > 0 && lap > maxLap {
		return maxLap
	}
	return lap
}

func parseTime(raw string) (time.Time, bool) {
	if raw == "" {
		return time.Time{}, false
	}
	at, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, false
	}
	return at, true
}

func upperText(parts ...string) string {
	return strings.ToUpper(strings.Join(parts, " "))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func sortedDriverNumbers(drivers map[int]bool) []int {
	out := make([]int, 0, len(drivers))
	for driver := range drivers {
		out = append(out, driver)
	}
	sort.Ints(out)
	return out
}

func sliceToSet(values []int) map[int]bool {
	out := make(map[int]bool, len(values))
	for _, value := range values {
		out[value] = true
	}
	return out
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
