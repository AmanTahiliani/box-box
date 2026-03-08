package ui

import (
	"fmt"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sahilm/fuzzy"
)

type driverView int

const (
	driverViewList driverView = iota
	driverViewDetail
)

type DriverModel struct {
	client     *api.OpenF1Client
	sessionKey int

	drivers         []models.Driver
	filteredDrivers []models.Driver
	selectedDriver  *models.Driver
	stints          []models.Stint
	laps            []models.Lap
	pits            []models.Pit
	positions       []models.Position
	teamRadios      []models.TeamRadio
	raceControl     []models.RaceControl

	view    driverView
	loading bool
	err     error
	spinner spinner.Model

	cursor int
	scroll int
	input  textinput.Model

	detailView      viewport.Model
	detailViewReady bool

	width  int
	height int
}

type driverSource []models.Driver

func (d driverSource) String(i int) string {
	return d[i].FullName + " " + d[i].NameAcronym + " " + d[i].TeamName
}

func (d driverSource) Len() int {
	return len(d)
}

func NewDriverModel(client *api.OpenF1Client) DriverModel {
	s := spinner.New()
	s.Spinner = spinner.MiniDot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))

	ti := textinput.New()
	ti.Placeholder = "Search drivers..."
	ti.Focus()
	ti.CharLimit = 50
	ti.Width = 30
	ti.PromptStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))
	ti.TextStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite))

	return DriverModel{
		client:  client,
		loading: false,
		spinner: s,
		input:   ti,
		view:    driverViewList,
	}
}

func fetchDriverList(client *api.OpenF1Client) tea.Cmd {
	return func() tea.Msg {
		drivers, err := client.GetDriversForSession(9999)
		if err != nil || len(drivers) == 0 {
			champ, champErr := client.GetLatestDriverChampionship()
			if champErr != nil || len(champ) == 0 {
				return driverListLoadedMsg{err: err}
			}
			drivers, err = client.GetDriversForSession(champ[0].SessionKey)
		}
		return driverListLoadedMsg{drivers: drivers, err: err}
	}
}

func fetchDriverListForSession(client *api.OpenF1Client, sessionKey int) tea.Cmd {
	return func() tea.Msg {
		drivers, err := client.GetDriversForSession(sessionKey)
		return driverListLoadedMsg{drivers: drivers, err: err}
	}
}

func fetchDriverDetail(client *api.OpenF1Client, sessionKey, driverNumber int) tea.Cmd {
	return tea.Batch(
		func() tea.Msg {
			stints, err := client.GetStintsForSession(sessionKey)
			var driverStints []models.Stint
			for _, s := range stints {
				if s.DriverNumber == driverNumber {
					driverStints = append(driverStints, s)
				}
			}
			return driverStintsLoadedMsg{stints: driverStints, err: err}
		},
		func() tea.Msg {
			laps, err := client.GetLapsForDriver(sessionKey, driverNumber)
			return driverLapsLoadedMsg{laps: laps, err: err}
		},
		func() tea.Msg {
			pits, err := client.GetPitStopsForSession(sessionKey)
			var driverPits []models.Pit
			for _, p := range pits {
				if p.DriverNumber == driverNumber {
					driverPits = append(driverPits, p)
				}
			}
			return driverPitsLoadedMsg{pits: driverPits, err: err}
		},
		func() tea.Msg {
			positions, err := client.GetPositions(sessionKey, driverNumber)
			return driverPositionsLoadedMsg{positions: positions, err: err}
		},
		func() tea.Msg {
			radios, err := client.GetTeamRadio(sessionKey, driverNumber)
			return driverTeamRadioLoadedMsg{radios: radios, err: err}
		},
	)
}

func (m DriverModel) Init() tea.Cmd {
	return m.spinner.Tick
}

func (m DriverModel) Update(msg tea.Msg) (DriverModel, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case spinner.TickMsg:
		if m.loading {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	case driverListLoadedMsg:
		m.loading = false
		if msg.err != nil {
			m.err = msg.err
			return m, nil
		}
		m.drivers = msg.drivers
		m.filterDrivers()

	case driverStintsLoadedMsg:
		if msg.err == nil {
			m.stints = msg.stints
		}
		m.loading = false
		m.updateDetailViewport()

	case driverLapsLoadedMsg:
		if msg.err == nil {
			m.laps = msg.laps
		}
		m.updateDetailViewport()

	case driverPitsLoadedMsg:
		if msg.err == nil {
			m.pits = msg.pits
		}
		m.updateDetailViewport()

	case driverPositionsLoadedMsg:
		if msg.err == nil {
			m.positions = msg.positions
		}
		m.updateDetailViewport()

	case driverTeamRadioLoadedMsg:
		if msg.err == nil {
			m.teamRadios = msg.radios
		}
		m.updateDetailViewport()

	case meetingSelectedMsg:
		m.drivers = nil

	case sessionsLoadedMsg:
		if msg.err == nil && len(msg.sessions) > 0 {
			for _, s := range msg.sessions {
				if s.SessionName == "Race" {
					m.sessionKey = s.SessionKey
					return m, nil
				}
			}
			m.sessionKey = msg.sessions[len(msg.sessions)-1].SessionKey
		}

	case tea.KeyMsg:
		switch m.view {
		case driverViewList:
			switch {
			case matchKey(msg, GlobalKeys.Retry):
				if m.err != nil {
					m.err = nil
					m.loading = true
					var cmd tea.Cmd
					m, cmd = m.TriggerLoad()
					cmds = append(cmds, cmd)
				}
			case matchKey(msg, GlobalKeys.Up):
				if m.cursor > 0 {
					m.cursor--
					m.ensureCursorVisible()
				}
			case matchKey(msg, GlobalKeys.Down):
				if m.cursor < len(m.filteredDrivers)-1 {
					m.cursor++
					m.ensureCursorVisible()
				}
			case matchKey(msg, GlobalKeys.GoTop):
				if m.input.Value() == "" {
					m.cursor = 0
					m.scroll = 0
				} else {
					var cmd tea.Cmd
					m.input, cmd = m.input.Update(msg)
					cmds = append(cmds, cmd)
					m.filterDrivers()
				}
			case matchKey(msg, GlobalKeys.GoBottom):
				if m.input.Value() == "" {
					if len(m.filteredDrivers) > 0 {
						m.cursor = len(m.filteredDrivers) - 1
						m.ensureCursorVisible()
					}
				} else {
					var cmd tea.Cmd
					m.input, cmd = m.input.Update(msg)
					cmds = append(cmds, cmd)
					m.filterDrivers()
				}
			case matchKey(msg, GlobalKeys.HalfUp):
				half := m.visibleRows() / 2
				m.cursor -= half
				if m.cursor < 0 {
					m.cursor = 0
				}
				m.ensureCursorVisible()
			case matchKey(msg, GlobalKeys.HalfDown):
				half := m.visibleRows() / 2
				m.cursor += half
				if m.cursor >= len(m.filteredDrivers) {
					m.cursor = len(m.filteredDrivers) - 1
				}
				if m.cursor < 0 {
					m.cursor = 0
				}
				m.ensureCursorVisible()
			case matchKey(msg, GlobalKeys.Enter):
				if len(m.filteredDrivers) > 0 && m.cursor >= 0 && m.cursor < len(m.filteredDrivers) {
					d := m.filteredDrivers[m.cursor]
					m.selectedDriver = &d
					m.stints = nil
					m.laps = nil
					m.pits = nil
					m.positions = nil
					m.teamRadios = nil
					m.view = driverViewDetail
					m.loading = true
					m.detailViewReady = false
					sessionKey := m.sessionKey
					if sessionKey == 0 && d.SessionKey != 0 {
						sessionKey = d.SessionKey
					}
					cmds = append(cmds, m.spinner.Tick, fetchDriverDetail(m.client, sessionKey, d.DriverNumber))
				}
			default:
				var cmd tea.Cmd
				m.input, cmd = m.input.Update(msg)
				cmds = append(cmds, cmd)
				m.filterDrivers()
			}
		case driverViewDetail:
			switch {
			case matchKey(msg, GlobalKeys.Back):
				m.view = driverViewList
				m.selectedDriver = nil
				m.stints = nil
				m.laps = nil
				m.pits = nil
				m.positions = nil
				m.teamRadios = nil
				m.detailViewReady = false
			case matchKey(msg, GlobalKeys.Up):
				if m.detailViewReady {
					m.detailView.LineUp(1)
				}
			case matchKey(msg, GlobalKeys.Down):
				if m.detailViewReady {
					m.detailView.LineDown(1)
				}
			case matchKey(msg, GlobalKeys.GoTop):
				if m.detailViewReady {
					m.detailView.GotoTop()
				}
			case matchKey(msg, GlobalKeys.GoBottom):
				if m.detailViewReady {
					m.detailView.GotoBottom()
				}
			case matchKey(msg, GlobalKeys.HalfUp):
				if m.detailViewReady {
					m.detailView.HalfViewUp()
				}
			case matchKey(msg, GlobalKeys.HalfDown):
				if m.detailViewReady {
					m.detailView.HalfViewDown()
				}
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m DriverModel) visibleRows() int {
	rows := m.height - 12
	if rows < 5 {
		rows = 5
	}
	return rows
}

func (m *DriverModel) ensureCursorVisible() {
	visible := m.visibleRows()
	if m.cursor < m.scroll {
		m.scroll = m.cursor
	}
	if m.cursor >= m.scroll+visible {
		m.scroll = m.cursor - visible + 1
	}
}

func (m *DriverModel) filterDrivers() {
	query := m.input.Value()
	if query == "" {
		m.filteredDrivers = m.drivers
	} else {
		matches := fuzzy.FindFrom(query, driverSource(m.drivers))
		m.filteredDrivers = make([]models.Driver, 0, len(matches))
		for _, match := range matches {
			m.filteredDrivers = append(m.filteredDrivers, m.drivers[match.Index])
		}
	}
	m.cursor = 0
	m.scroll = 0
}

func (m DriverModel) TriggerLoad() (DriverModel, tea.Cmd) {
	if m.drivers != nil || m.loading {
		return m, nil
	}
	m.loading = true
	return m, tea.Batch(m.spinner.Tick, fetchDriverList(m.client))
}

func (m DriverModel) View() string {
	if m.loading && m.view == driverViewList {
		return fmt.Sprintf("\n  %s  Loading drivers...", m.spinner.View())
	}
	if m.err != nil {
		return styleError.Render(fmt.Sprintf("\n  Error: %v\n\n", m.err)) +
			helpBar("r retry", "q quit")
	}

	switch m.view {
	case driverViewList:
		return m.renderDriverList()
	case driverViewDetail:
		return m.renderDriverDetail()
	}
	return ""
}

func (m DriverModel) renderDriverList() string {
	if len(m.drivers) == 0 && !m.loading {
		return styleMuted.Render("\n  No driver data. Select a race from Calendar first.\n\n") +
			helpBar("2 calendar", "r retry", "q quit")
	}

	var sb strings.Builder
	w := m.width
	if w < 40 {
		w = 40
	}
	compact := w < 80

	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorF1Red)).
		Render("  DRIVER LOOKUP")
	sb.WriteString(title + "\n\n")

	// Search input
	sb.WriteString("  " + m.input.View() + "\n\n")

	// Responsive columns
	nameWidth := 24
	teamWidth := 22
	if compact {
		nameWidth = 16
		teamWidth = 0 // hide team in compact mode
	} else if w >= 120 {
		nameWidth = 28
		teamWidth = 26
	}

	// Header
	var header string
	if compact {
		header = fmt.Sprintf("  %s  %s  %s  %s",
			padRight("#", 3),
			padRight("", 1),
			padRight("DRV", 4),
			padRight("NAME", nameWidth),
		)
	} else {
		header = fmt.Sprintf("  %s  %s  %s  %s  %s",
			padRight("#", 3),
			padRight("", 1),
			padRight("DRV", 4),
			padRight("NAME", nameWidth),
			padRight("TEAM", teamWidth),
		)
	}
	sb.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted)).Bold(true).Render(header) + "\n")
	sb.WriteString("  " + divider(min(w-6, lipgloss.Width(header))) + "\n")

	visible := m.visibleRows()
	endIdx := m.scroll + visible
	if endIdx > len(m.filteredDrivers) {
		endIdx = len(m.filteredDrivers)
	}

	for i := m.scroll; i < endIdx; i++ {
		d := m.filteredDrivers[i]

		teamColor := colorMuted
		if d.TeamColour != "" {
			teamColor = "#" + d.TeamColour
		} else {
			teamColor = teamColorFromName(d.TeamName)
		}

		colorBar := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")

		var row string
		if compact {
			row = fmt.Sprintf("  %s  %s  %s  %s",
				padRight(fmt.Sprintf("%d", d.DriverNumber), 3),
				colorBar,
				padRight(d.NameAcronym, 4),
				padRight(truncate(d.FullName, nameWidth), nameWidth),
			)
		} else {
			row = fmt.Sprintf("  %s  %s  %s  %s  %s",
				padRight(fmt.Sprintf("%d", d.DriverNumber), 3),
				colorBar,
				padRight(d.NameAcronym, 4),
				padRight(truncate(d.FullName, nameWidth), nameWidth),
				padRight(truncate(d.TeamName, teamWidth), teamWidth),
			)
		}

		if i == m.cursor {
			row = styleSelected.Render(row)
		}
		sb.WriteString(row + "\n")
	}

	if len(m.filteredDrivers) > visible {
		sb.WriteString(styleMuted.Render(fmt.Sprintf("\n  %d of %d drivers", len(m.filteredDrivers), len(m.drivers))) + "\n")
	}

	sb.WriteString("\n")
	sb.WriteString(helpBar("↑/↓ navigate", "g/G top/bottom", "^d/^u page", "enter view", "type to search", "q quit"))
	return sb.String()
}

func (m *DriverModel) updateDetailViewport() {
	if m.selectedDriver == nil {
		return
	}
	content := m.renderDetailContent()
	vpWidth := m.width - 2
	if vpWidth < 40 {
		vpWidth = 40
	}
	vpHeight := m.height - 5 // room for header + help bar
	if vpHeight < 5 {
		vpHeight = 5
	}
	if !m.detailViewReady {
		m.detailView = viewport.New(vpWidth, vpHeight)
		m.detailViewReady = true
	} else {
		m.detailView.Width = vpWidth
		m.detailView.Height = vpHeight
	}
	m.detailView.SetContent(content)
}

func (m DriverModel) renderDriverDetail() string {
	if m.selectedDriver == nil {
		return ""
	}
	d := m.selectedDriver

	var sb strings.Builder

	teamColor := colorMuted
	if d.TeamColour != "" {
		teamColor = "#" + d.TeamColour
	} else {
		teamColor = teamColorFromName(d.TeamName)
	}

	// Driver card header (fixed, not scrollable)
	numberBg := lipgloss.NewStyle().
		Background(lipgloss.Color(teamColor)).
		Foreground(lipgloss.Color(colorWhite)).
		Bold(true).
		Padding(0, 1).
		Render(fmt.Sprintf(" #%d ", d.DriverNumber))

	nameStyled := lipgloss.NewStyle().
		Foreground(lipgloss.Color(teamColor)).
		Bold(true).
		Render(d.FullName)

	acronymStyled := lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorWhite)).
		Bold(true).
		Render(d.NameAcronym)

	teamStyled := styleTeamName.Render(d.TeamName)

	sb.WriteString(fmt.Sprintf("\n  %s  %s  %s  %s\n", numberBg, nameStyled, acronymStyled, teamStyled))

	stripeWidth := min(m.width-6, 60)
	stripe := lipgloss.NewStyle().
		Foreground(lipgloss.Color(teamColor)).
		Render(strings.Repeat("━", stripeWidth))
	sb.WriteString("  " + stripe + "\n")

	if m.loading {
		sb.WriteString(fmt.Sprintf("\n  %s  Loading driver data...\n", m.spinner.View()))
	}

	// Scrollable content via viewport
	if m.detailViewReady {
		sb.WriteString(m.detailView.View())
		sb.WriteString("\n")
		// Scroll indicator
		pct := m.detailView.ScrollPercent()
		scrollInfo := styleMuted.Render(fmt.Sprintf("  %.0f%%", pct*100))
		sb.WriteString(scrollInfo + "\n")
	}

	sb.WriteString(helpBar("↑/↓ scroll", "g/G top/bottom", "^d/^u page", "b back", "q quit"))
	return sb.String()
}

// renderDetailContent generates the full content for the driver detail viewport.
func (m DriverModel) renderDetailContent() string {
	var sb strings.Builder

	// ── POSITION HISTORY ────────────────────────────────
	sb.WriteString("\n  " + styleSectionTitle.Render("POSITION HISTORY") + "\n")
	sb.WriteString(m.renderPositionChart())
	sb.WriteString("\n")

	// ── RACE STRATEGY ───────────────────────────────────
	sb.WriteString("  " + styleSectionTitle.Render("RACE STRATEGY") + "\n")
	sb.WriteString(m.renderStintBar())
	sb.WriteString("\n\n")

	// ── LAP TIMES ───────────────────────────────────────
	sb.WriteString("  " + styleSectionTitle.Render("LAP TIMES") + "\n")
	sparkWidth := min(m.width-6, 70)
	if sparkWidth < 10 {
		sparkWidth = 40
	}
	sb.WriteString("  " + sparkline(m.laps, sparkWidth) + "\n")
	legend := fmt.Sprintf("  %s fast  %s mid  %s slow  %s pit",
		lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen)).Render("█"),
		lipgloss.NewStyle().Foreground(lipgloss.Color(colorYellow)).Render("█"),
		lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red)).Render("█"),
		styleMuted.Render("·"),
	)
	sb.WriteString(legend)

	if len(m.laps) > 0 {
		var bestLap, worstLap float64
		var bestLapNum, worstLapNum int
		bestLap = 999999
		for _, lap := range m.laps {
			if lap.LapDuration != nil && *lap.LapDuration > 0 {
				if *lap.LapDuration < bestLap {
					bestLap = *lap.LapDuration
					bestLapNum = lap.LapNumber
				}
				if *lap.LapDuration > worstLap && !lap.IsPitOutLap {
					worstLap = *lap.LapDuration
					worstLapNum = lap.LapNumber
				}
			}
		}
		if bestLap < 999999 {
			sb.WriteString(fmt.Sprintf("  %s %s (Lap %d)",
				styleMuted.Render("Best:"),
				lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen)).Bold(true).Render(formatSeconds(bestLap)),
				bestLapNum,
			))
			if worstLap > 0 {
				sb.WriteString(fmt.Sprintf("  %s %s (Lap %d)",
					styleMuted.Render("Slowest:"),
					lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red)).Render(formatSeconds(worstLap)),
					worstLapNum,
				))
			}
		}
	}
	sb.WriteString("\n\n")

	// ── PIT STOPS ───────────────────────────────────────
	sb.WriteString("  " + styleSectionTitle.Render("PIT STOPS") + "\n")
	sb.WriteString(m.renderPitStops())
	sb.WriteString("\n\n")

	// ── TEAM RADIO ──────────────────────────────────────
	sb.WriteString("  " + styleSectionTitle.Render("TEAM RADIO") + "\n")
	sb.WriteString(m.renderTeamRadio())
	sb.WriteString("\n")

	return sb.String()
}

func (m DriverModel) renderStintBar() string {
	if len(m.stints) == 0 {
		if m.loading {
			return fmt.Sprintf("  %s Loading...", m.spinner.View())
		}
		return styleMuted.Render("  No stint data available.")
	}

	var parts []string
	for i, stint := range m.stints {
		label := fmt.Sprintf(" %s L%d-%d ", tyreAbbrev(stint.Compound), stint.LapStart, stint.LapEnd)
		stintStr := tyreBgStyle(stint.Compound).Render(label)

		parts = append(parts, stintStr)

		// Arrow between stints
		if i < len(m.stints)-1 {
			parts = append(parts, styleMuted.Render(" > "))
		}
	}

	return "  " + strings.Join(parts, "")
}

func (m DriverModel) renderPitStops() string {
	if len(m.pits) == 0 {
		return styleMuted.Render("  No pit stop data available.")
	}

	var sb strings.Builder

	// Header
	header := fmt.Sprintf("  %s  %s  %s  %s",
		padRight("STOP", 5),
		padLeft("LAP", 4),
		padLeft("STOP TIME", 10),
		padLeft("PIT LANE", 10),
	)
	sb.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted)).Bold(true).Render(header) + "\n")
	sb.WriteString("  " + divider(35) + "\n")

	for i, p := range m.pits {
		stopNum := fmt.Sprintf("#%d", i+1)

		// Color stop duration: green = fast, red = slow
		stopDur := p.StopDuration
		var stopStyle lipgloss.Style
		switch {
		case stopDur < 2.5:
			stopStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen)).Bold(true)
		case stopDur < 3.5:
			stopStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorYellow))
		default:
			stopStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))
		}

		row := fmt.Sprintf("  %s  %s  %s  %s",
			padRight(stopNum, 5),
			padLeft(fmt.Sprintf("%d", p.LapNumber), 4),
			padLeftVisible(stopStyle.Render(fmt.Sprintf("%.3fs", p.StopDuration)), 10),
			padLeft(fmt.Sprintf("%.3fs", p.LaneDuration), 10),
		)
		sb.WriteString(row + "\n")
	}

	return sb.String()
}

// renderPositionChart draws a text-based position history chart.
// Shows position changes over the race using a compact inline format.
func (m DriverModel) renderPositionChart() string {
	if len(m.positions) == 0 {
		return styleMuted.Render("  No position data available.\n")
	}

	var sb strings.Builder

	// Deduplicate: only keep position changes
	type posChange struct {
		position int
		date     string
	}
	var changes []posChange
	lastPos := -1
	for _, p := range m.positions {
		if p.Position != lastPos {
			changes = append(changes, posChange{position: p.Position, date: p.Date})
			lastPos = p.Position
		}
	}

	if len(changes) == 0 {
		return styleMuted.Render("  No position changes.\n")
	}

	// Start and end positions
	startPos := changes[0].position
	endPos := changes[len(changes)-1].position
	bestPos := startPos
	worstPos := startPos
	for _, c := range changes {
		if c.position < bestPos {
			bestPos = c.position
		}
		if c.position > worstPos {
			worstPos = c.position
		}
	}

	// Summary line
	startStyled := renderPosition(startPos)
	endStyled := renderPosition(endPos)
	delta := startPos - endPos // positive = gained
	var deltaStr string
	if delta > 0 {
		deltaStr = styleDeltaUp.Render(fmt.Sprintf("▲%d gained", delta))
	} else if delta < 0 {
		deltaStr = styleDeltaDown.Render(fmt.Sprintf("▼%d lost", -delta))
	} else {
		deltaStr = styleDeltaEqual.Render("─ no change")
	}
	sb.WriteString(fmt.Sprintf("  Start: P%s  Finish: P%s  %s\n", startStyled, endStyled, deltaStr))
	sb.WriteString(fmt.Sprintf("  %s P%s  %s P%s\n",
		styleMuted.Render("Best:"),
		lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen)).Bold(true).Render(fmt.Sprintf("%d", bestPos)),
		styleMuted.Render("Worst:"),
		lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red)).Render(fmt.Sprintf("%d", worstPos)),
	))

	// Visual position timeline (compact sparkline-style)
	chartWidth := min(m.width-6, 60)
	if chartWidth < 20 {
		chartWidth = 20
	}

	if len(changes) > 1 {
		posRange := worstPos - bestPos
		if posRange == 0 {
			posRange = 1
		}

		// Sample positions at regular intervals
		samples := make([]int, chartWidth)
		for i := 0; i < chartWidth; i++ {
			idx := i * (len(changes) - 1) / (chartWidth - 1)
			if idx >= len(changes) {
				idx = len(changes) - 1
			}
			samples[i] = changes[idx].position
		}

		// Draw the chart
		blocks := []rune("▁▂▃▄▅▆▇█")
		var chartLine strings.Builder
		for _, pos := range samples {
			// Invert: lower position (better) = taller bar
			norm := float64(pos-bestPos) / float64(posRange)
			idx := int((1.0-norm)*float64(len(blocks)-1) + 0.5)
			if idx < 0 {
				idx = 0
			}
			if idx >= len(blocks) {
				idx = len(blocks) - 1
			}
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
			chartLine.WriteString(blockStyle.Render(string(blocks[idx])))
		}
		sb.WriteString("  " + chartLine.String() + "\n")
		sb.WriteString(fmt.Sprintf("  %s%s%s\n",
			styleMuted.Render(fmt.Sprintf("P%d", bestPos)),
			strings.Repeat(" ", max(chartWidth-8, 1)),
			styleMuted.Render(fmt.Sprintf("P%d", worstPos)),
		))
	}

	// Position change timeline (textual)
	if len(changes) > 1 && len(changes) <= 20 {
		sb.WriteString("  ")
		for i, c := range changes {
			posStr := fmt.Sprintf("P%d", c.position)
			if c.position <= 3 {
				posStr = renderPosition(c.position)
			}
			sb.WriteString(posStr)
			if i < len(changes)-1 {
				next := changes[i+1].position
				if next < c.position {
					sb.WriteString(styleDeltaUp.Render(" > "))
				} else if next > c.position {
					sb.WriteString(styleDeltaDown.Render(" > "))
				} else {
					sb.WriteString(styleMuted.Render(" > "))
				}
			}
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// renderTeamRadio displays team radio messages with timestamps.
func (m DriverModel) renderTeamRadio() string {
	if len(m.teamRadios) == 0 {
		return styleMuted.Render("  No team radio messages available.\n")
	}

	var sb strings.Builder

	countStr := styleMuted.Render(fmt.Sprintf("  %d audio messages (open URL in browser to listen)", len(m.teamRadios)))
	sb.WriteString(countStr + "\n")

	for i, radio := range m.teamRadios {
		t := "--:--:--"
		if len(radio.Date) >= 19 {
			pt, err := time.Parse(time.RFC3339, radio.Date)
			if err == nil {
				t = pt.Format("15:04:05")
			} else {
				t = radio.Date[11:19]
			}
		}

		icon := lipgloss.NewStyle().Foreground(lipgloss.Color(colorOrange)).Render("📻")
		timeStr := styleMuted.Render(fmt.Sprintf("[%s]", t))

		urlStr := radio.RecordingURL
		urlStyled := lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorCyan)).
			Render(truncate(urlStr, min(m.width-20, 50)))

		sb.WriteString(fmt.Sprintf("  %s %s  %s\n", icon, timeStr, urlStyled))

		if i >= 14 && i < len(m.teamRadios)-1 {
			remaining := len(m.teamRadios) - i - 1
			sb.WriteString(styleMuted.Render(fmt.Sprintf("  ... and %d more messages\n", remaining)))
			break
		}
	}

	return sb.String()
}
