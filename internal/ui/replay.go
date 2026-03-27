package ui

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ---------------------------------------------------------------------------
// Replay data structures
// ---------------------------------------------------------------------------

// ReplayLapSnapshot holds a full field snapshot at the end of a given lap.
type ReplayLapSnapshot struct {
	LapNumber int
	// Positions: driver number → position at end of this lap
	Positions map[int]int
	// GapsToLeader: driver number → gap to leader in seconds (-1 = leader/lap down)
	GapsToLeader map[int]float64
	// PitsThisLap: driver numbers who pitted on this lap
	PitsThisLap []int
	// PitDurations: driver number → stop duration for this lap (0 if no pit)
	PitDurations map[int]float64
	// RCMessages this lap
	RCMessages []models.RaceControl
	// Weather snapshot (last reading before/at this lap)
	Weather *models.Weather
	// LapTimes: driver number → lap duration this lap (0 if unknown)
	LapTimes map[int]float64
}

// ReplayData is the full pre-processed replay dataset for a race session.
type ReplayData struct {
	SessionKey  int
	SessionName string
	TotalLaps   int
	Drivers     map[int]models.Driver // driver number → Driver
	Snapshots   []ReplayLapSnapshot   // index 0 = lap 1
}

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

// replayLoadMsg is sent when the user presses `r` on a race session to trigger
// a lazy data load.
type replayLoadMsg struct {
	sessionKey  int
	sessionName string
}

// replayDataLoadedMsg is the async response with the fully processed ReplayData.
type replayDataLoadedMsg struct {
	data *ReplayData
	err  error
}

// ---------------------------------------------------------------------------
// Async fetch command
// ---------------------------------------------------------------------------

func fetchReplayData(client *api.OpenF1Client, sessionKey int, sessionName string) tea.Cmd {
	return func() tea.Msg {
		data, err := buildReplayData(client, sessionKey, sessionName)
		return replayDataLoadedMsg{data: data, err: err}
	}
}

func buildReplayData(client *api.OpenF1Client, sessionKey int, sessionName string) (*ReplayData, error) {
	// Fetch all required data concurrently via goroutines with a simple fan-in.
	type result struct {
		tag string
		val interface{}
		err error
	}
	ch := make(chan result, 5)

	go func() {
		v, err := client.GetDriversForSession(sessionKey)
		ch <- result{"drivers", v, err}
	}()
	go func() {
		v, err := client.GetPositions(sessionKey, 0)
		ch <- result{"positions", v, err}
	}()
	go func() {
		v, err := client.GetLapsForSession(sessionKey)
		ch <- result{"laps", v, err}
	}()
	go func() {
		v, err := client.GetPitStopsForSession(sessionKey)
		ch <- result{"pits", v, err}
	}()
	go func() {
		v, err := client.GetRaceControl(sessionKey)
		ch <- result{"rc", v, err}
	}()

	var (
		driverList []models.Driver
		positions  []models.Position
		laps       []models.Lap
		pits       []models.Pit
		rcMsgs     []models.RaceControl
	)

	for i := 0; i < 5; i++ {
		r := <-ch
		if r.err != nil {
			return nil, fmt.Errorf("replay fetch %s: %w", r.tag, r.err)
		}
		switch r.tag {
		case "drivers":
			driverList = r.val.([]models.Driver)
		case "positions":
			positions = r.val.([]models.Position)
		case "laps":
			laps = r.val.([]models.Lap)
		case "pits":
			pits = r.val.([]models.Pit)
		case "rc":
			rcMsgs = r.val.([]models.RaceControl)
		}
	}

	// Build driver map
	drivers := make(map[int]models.Driver, len(driverList))
	for _, d := range driverList {
		drivers[d.DriverNumber] = d
	}

	// Determine total laps from lap data
	totalLaps := 0
	for _, l := range laps {
		if l.LapNumber > totalLaps {
			totalLaps = l.LapNumber
		}
	}
	if totalLaps == 0 {
		totalLaps = 1
	}

	// Build per-lap position snapshots from the position stream.
	// The position stream provides the position of each driver at timestamps.
	// We bucket positions by lap number: for each driver, their position at
	// the end of each lap is the last recorded position entry whose timestamp
	// falls before or at the next lap's start timestamp.
	//
	// Strategy: parse lap start times per driver, then for each lap find the
	// latest position reading before that driver's next lap start.

	// lap start times: driverNum → lapNum → DateStart
	lapStartByDriver := make(map[int]map[int]time.Time)
	for _, l := range laps {
		if _, ok := lapStartByDriver[l.DriverNumber]; !ok {
			lapStartByDriver[l.DriverNumber] = make(map[int]time.Time)
		}
		t, err := time.Parse(time.RFC3339, l.DateStart)
		if err == nil {
			lapStartByDriver[l.DriverNumber][l.LapNumber] = t.UTC()
		}
	}

	// Sort position stream per driver by time
	type posEntry struct {
		t   time.Time
		pos int
	}
	posByDriver := make(map[int][]posEntry)
	for _, p := range positions {
		t, err := time.Parse(time.RFC3339, p.Date)
		if err != nil {
			continue
		}
		posByDriver[p.DriverNumber] = append(posByDriver[p.DriverNumber], posEntry{t.UTC(), p.Position})
	}
	for dn := range posByDriver {
		sort.Slice(posByDriver[dn], func(i, j int) bool {
			return posByDriver[dn][i].t.Before(posByDriver[dn][j].t)
		})
	}

	// Lap time per driver per lap
	lapTimeMap := make(map[int]map[int]float64) // driverNum → lapNum → seconds
	for _, l := range laps {
		if l.LapDuration == nil || *l.LapDuration <= 0 || l.IsPitOutLap {
			continue
		}
		if _, ok := lapTimeMap[l.DriverNumber]; !ok {
			lapTimeMap[l.DriverNumber] = make(map[int]float64)
		}
		lapTimeMap[l.DriverNumber][l.LapNumber] = *l.LapDuration
	}

	// Pit stop map: driverNum → lapNum → stop duration
	pitMap := make(map[int]map[int]float64)
	for _, p := range pits {
		if _, ok := pitMap[p.DriverNumber]; !ok {
			pitMap[p.DriverNumber] = make(map[int]float64)
		}
		dur := p.StopDuration
		if dur == 0 {
			dur = p.PitDuration
		}
		pitMap[p.DriverNumber][p.LapNumber] = dur
	}

	// RC messages per lap
	rcByLap := make(map[int][]models.RaceControl)
	for _, rc := range rcMsgs {
		lap := 0
		if rc.LapNumber != nil {
			lap = *rc.LapNumber
		}
		rcByLap[lap] = append(rcByLap[lap], rc)
	}

	// Build snapshots for each lap
	snapshots := make([]ReplayLapSnapshot, totalLaps)
	for lapIdx := 0; lapIdx < totalLaps; lapIdx++ {
		lapNum := lapIdx + 1
		snap := ReplayLapSnapshot{
			LapNumber:    lapNum,
			Positions:    make(map[int]int),
			GapsToLeader: make(map[int]float64),
			PitDurations: make(map[int]float64),
			LapTimes:     make(map[int]float64),
		}

		// Get position of each driver at end of this lap.
		// Use the last position reading before (lapNum+1)'s start time for each driver.
		for dn, entries := range posByDriver {
			// Find the upper bound time: start of next lap for this driver
			var upperBound time.Time
			if nextStart, ok := lapStartByDriver[dn][lapNum+1]; ok {
				upperBound = nextStart
			} else if lapStart, ok := lapStartByDriver[dn][lapNum]; ok {
				// No next lap start — use current lap start + 2 min as safety bound
				upperBound = lapStart.Add(2 * time.Minute)
			} else {
				// No timing at all, use last entry
				upperBound = time.Now()
			}

			// Binary search for last entry before upperBound
			lastPos := 0
			for _, e := range entries {
				if e.t.Before(upperBound) {
					lastPos = e.pos
				}
			}
			if lastPos > 0 {
				snap.Positions[dn] = lastPos
			}
		}

		// Compute approximate gaps to leader from positions.
		// We derive gap from the accumulated lap-time differences — a rough but
		// useful reconstruction. Set leader gap = 0, others accumulate based on
		// position ordering relative to leader average lap pace.
		// For simplicity we store 0 = leader.
		for dn := range snap.Positions {
			snap.GapsToLeader[dn] = -1 // will be filled per position order
		}

		// Pits this lap
		for dn, lapPits := range pitMap {
			if dur, ok := lapPits[lapNum]; ok {
				snap.PitsThisLap = append(snap.PitsThisLap, dn)
				snap.PitDurations[dn] = dur
			}
		}
		sort.Ints(snap.PitsThisLap)

		// Lap times this lap
		for dn, lapTimes := range lapTimeMap {
			if lt, ok := lapTimes[lapNum]; ok {
				snap.LapTimes[dn] = lt
			}
		}

		// RC messages this lap
		snap.RCMessages = rcByLap[lapNum]

		snapshots[lapIdx] = snap
	}

	return &ReplayData{
		SessionKey:  sessionKey,
		SessionName: sessionName,
		TotalLaps:   totalLaps,
		Drivers:     drivers,
		Snapshots:   snapshots,
	}, nil
}

// ---------------------------------------------------------------------------
// ReplayModel — Bubble Tea model for the replay UI
// ---------------------------------------------------------------------------

// ReplayState tracks what mode the race-detail tab's replay sub-component is in.
type ReplayState int

const (
	ReplayStateInactive ReplayState = iota // not in replay mode
	ReplayStateLoading                     // data fetch in flight
	ReplayStateActive                      // showing replay
)

type ReplayModel struct {
	client  *api.OpenF1Client
	state   ReplayState
	data    *ReplayData
	err     error
	spinner spinner.Model

	// Current scrub position (0-indexed into data.Snapshots)
	cursor int
	// Number of visible rows in content area
	height int
	width  int
}

func NewReplayModel(client *api.OpenF1Client) ReplayModel {
	sp := spinner.New()
	sp.Spinner = spinner.Points
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))
	return ReplayModel{
		client:  client,
		state:   ReplayStateInactive,
		spinner: sp,
	}
}

// IsActive returns true when the replay pane is active (loading or showing).
func (m ReplayModel) IsActive() bool {
	return m.state != ReplayStateInactive
}

// Enter triggers a data load for the given race session.
func (m ReplayModel) Enter(sessionKey int, sessionName string) (ReplayModel, tea.Cmd) {
	m.state = ReplayStateLoading
	m.data = nil
	m.err = nil
	m.cursor = 0
	return m, tea.Batch(
		fetchReplayData(m.client, sessionKey, sessionName),
		m.spinner.Tick,
	)
}

// Exit resets replay to inactive.
func (m ReplayModel) Exit() ReplayModel {
	m.state = ReplayStateInactive
	m.data = nil
	m.err = nil
	return m
}

func (m ReplayModel) Update(msg tea.Msg) (ReplayModel, tea.Cmd) {
	switch msg := msg.(type) {
	case spinner.TickMsg:
		if m.state == ReplayStateLoading {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	case replayDataLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = ReplayStateActive // show error in active state
			return m, nil
		}
		m.data = msg.data
		m.state = ReplayStateActive
		// Start at lap 1
		m.cursor = 0
		return m, nil

	case tea.KeyMsg:
		if m.state != ReplayStateActive || m.data == nil {
			return m, nil
		}
		switch {
		case matchKey(msg, replayKeyLeft):
			if m.cursor > 0 {
				m.cursor--
			}
		case matchKey(msg, replayKeyRight):
			if m.cursor < m.data.TotalLaps-1 {
				m.cursor++
			}
		case matchKey(msg, replayKeyStart):
			m.cursor = 0
		case matchKey(msg, replayKeyEnd):
			if m.data.TotalLaps > 0 {
				m.cursor = m.data.TotalLaps - 1
			}
		}
	}
	return m, nil
}

// replayKey helpers — local bindings for the replay scrubber.
var (
	replayKeyLeft  = mustNewBinding("left", "h")
	replayKeyRight = mustNewBinding("right", "l")
	replayKeyStart = mustNewBinding("g", "home")
	replayKeyEnd   = mustNewBinding("G", "end")
)

// simpleBinding is a minimal implementation of the Keys() interface.
type simpleBinding struct{ keys []string }

func (s simpleBinding) Keys() []string { return s.keys }

func mustNewBinding(keys ...string) simpleBinding {
	return simpleBinding{keys: keys}
}

// View renders the replay pane for embedding into the RaceDetail view.
func (m ReplayModel) View() string {
	switch m.state {
	case ReplayStateInactive:
		return ""
	case ReplayStateLoading:
		return fmt.Sprintf("\n  %s  Loading replay data...\n", m.spinner.View())
	case ReplayStateActive:
		if m.err != nil {
			return renderErrorView(m.err)
		}
		if m.data == nil {
			return styleMuted.Render("\n  No replay data.\n")
		}
		return m.renderReplay()
	}
	return ""
}

func (m ReplayModel) renderReplay() string {
	var sb strings.Builder
	data := m.data

	if m.cursor >= len(data.Snapshots) {
		return styleMuted.Render("\n  No snapshot data for this lap.\n")
	}
	snap := data.Snapshots[m.cursor]

	// ── Header ────────────────────────────────────────────────────────────────
	title := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorF1Red)).
		Render("⏪  RACE REPLAY")
	lapBadge := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorYellow)).
		Render(fmt.Sprintf("LAP %d / %d", snap.LapNumber, data.TotalLaps))

	// Progress bar
	barWidth := 24
	filled := 0
	if data.TotalLaps > 0 {
		filled = int(float64(snap.LapNumber) / float64(data.TotalLaps) * float64(barWidth))
	}
	if filled > barWidth {
		filled = barWidth
	}
	bar := stylePointsBarFilled.Render(strings.Repeat("█", filled)) +
		stylePointsBarEmpty.Render(strings.Repeat("░", barWidth-filled))

	sb.WriteString(fmt.Sprintf("\n  %s    %s  %s\n", title, lapBadge, bar))
	sb.WriteString("  " + divider(min(m.width-4, 72)) + "\n")

	// ── Field snapshot ────────────────────────────────────────────────────────
	// Sort drivers by position at this lap
	type driverPos struct {
		driverNum int
		pos       int
	}
	var sorted []driverPos
	for dn, pos := range snap.Positions {
		sorted = append(sorted, driverPos{dn, pos})
	}
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].pos < sorted[j].pos
	})

	// Table header
	sb.WriteString(styleMuted.Render(fmt.Sprintf("  %-4s  %-4s  %-18s  %-12s  %s\n",
		"POS", "NO", "DRIVER", "TIME", "PIT")))
	sb.WriteString("  " + divider(min(m.width-4, 60)) + "\n")

	for _, dp := range sorted {
		d, ok := data.Drivers[dp.driverNum]
		name := fmt.Sprintf("#%d", dp.driverNum)
		teamColor := colorMuted
		if ok {
			name = d.NameAcronym
			if d.TeamColour != "" {
				teamColor = "#" + d.TeamColour
			} else {
				teamColor = teamColorFromName(d.TeamName)
			}
		}

		colorBar := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")
		nameStyled := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Bold(true).Render(padRight(name, 4))
		posStyled := renderPosition(dp.pos)

		// Lap time
		ltStr := styleMuted.Render("       --")
		if lt, ok := snap.LapTimes[dp.driverNum]; ok && lt > 0 {
			ltStr = padRight(formatSeconds(lt), 12)
		}

		// Pit this lap
		pitStr := ""
		if dur, ok := snap.PitDurations[dp.driverNum]; ok && dur > 0 {
			pitStr = lipgloss.NewStyle().Foreground(lipgloss.Color(colorOrange)).Bold(true).
				Render(fmt.Sprintf("PIT %.1fs", dur))
		}

		sb.WriteString(fmt.Sprintf("  %s  %s  %s  %s  %s\n",
			padRightVisible(posStyled, 4),
			colorBar,
			nameStyled,
			ltStr,
			pitStr,
		))
	}

	// ── RC messages this lap ─────────────────────────────────────────────────
	if len(snap.RCMessages) > 0 {
		sb.WriteString("\n  " + styleSectionTitle.Render("RACE CONTROL") + "\n")
		for _, rc := range snap.RCMessages {
			icon := "  "
			var flagStyle lipgloss.Style
			switch rc.Flag {
			case "GREEN":
				icon, flagStyle = "🟢", styleFlagGreen
			case "YELLOW", "DOUBLE YELLOW":
				icon, flagStyle = "🟡", styleFlagYellow
			case "RED":
				icon, flagStyle = "🔴", styleFlagRed
			case "BLUE":
				icon, flagStyle = "🔵", styleFlagBlue
			case "CHEQUERED":
				icon = "🏁"
				flagStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite)).Bold(true)
			default:
				flagStyle = styleMuted
			}
			sb.WriteString(fmt.Sprintf("  %s%s\n",
				flagStyle.Render(icon+" "),
				rc.Message))
		}
	}

	// ── Help bar ──────────────────────────────────────────────────────────────
	sb.WriteString("\n")
	sb.WriteString(helpBar("←/h prev lap", "→/l next lap", "g first", "G last", "b back to race"))

	return sb.String()
}
