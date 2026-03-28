package ui

import (
	"fmt"
	"strings"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type standingsView int

const (
	standingsViewDriver standingsView = iota
	standingsViewConstructor
)

type StandingsModel struct {
	client *api.OpenF1Client

	driverStandings []models.ChampionshipDriver
	teamStandings   []models.ChampionshipTeam
	drivers         map[int]models.Driver // driver_number -> Driver

	view    standingsView
	loading bool
	stale   bool
	err     error
	spinner spinner.Model

	cursor int
	scroll int

	year   int
	width  int
	height int
}

func NewStandingsModel(client *api.OpenF1Client, year int) StandingsModel {
	s := spinner.New()
	s.Spinner = spinner.MiniDot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))

	return StandingsModel{
		client:  client,
		view:    standingsViewDriver,
		loading: true,
		spinner: s,
		drivers: make(map[int]models.Driver),
		year:    year,
	}
}

func (m StandingsModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		fetchDriverChampionship(m.client, m.year),
		fetchTeamChampionship(m.client, m.year),
	)
}

func fetchDriverChampionship(client *api.OpenF1Client, year int) tea.Cmd {
	return func() tea.Msg {
		standings, err := client.GetDriverChampionshipForYear(year)
		return driverChampionshipLoadedMsg{standings: standings, err: err}
	}
}

func fetchTeamChampionship(client *api.OpenF1Client, year int) tea.Cmd {
	return func() tea.Msg {
		standings, err := client.GetTeamChampionshipForYear(year)
		return teamChampionshipLoadedMsg{standings: standings, err: err}
	}
}

func fetchStandingsDrivers(client *api.OpenF1Client, sessionKey int) tea.Cmd {
	return func() tea.Msg {
		drivers, err := client.GetDriversForSession(sessionKey)
		return standingsDriversLoadedMsg{drivers: drivers, err: err}
	}
}

func (m StandingsModel) Update(msg tea.Msg) (StandingsModel, tea.Cmd) {
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

	case driverChampionshipLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			m.loading = false
			return m, nil
		}
		m.driverStandings = msg.standings
		if m.client.LastResponseWasStale() {
			m.stale = true
		}
		if len(msg.standings) > 0 {
			return m, fetchStandingsDrivers(m.client, msg.standings[0].SessionKey)
		}
		m.loading = false

	case teamChampionshipLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			return m, nil
		}
		m.teamStandings = msg.standings
		if m.client.LastResponseWasStale() {
			m.stale = true
		}

	case standingsDriversLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			m.loading = false
			return m, nil
		}
		for _, d := range msg.drivers {
			m.drivers[d.DriverNumber] = d
		}
		m.loading = false

	case tea.KeyMsg:
		switch {
		case matchKey(msg, GlobalKeys.Retry):
			if m.err != nil {
				m.err = nil
				m.stale = false
				m.loading = true
				return m, m.Init()
			}
		case matchKey(msg, StandingsKeys.DriverView):
			m.view = standingsViewDriver
			m.cursor = 0
			m.scroll = 0
		case matchKey(msg, StandingsKeys.ConstructorView):
			m.view = standingsViewConstructor
			m.cursor = 0
			m.scroll = 0
		case matchKey(msg, GlobalKeys.Up):
			if m.cursor > 0 {
				m.cursor--
				if m.cursor < m.scroll {
					m.scroll = m.cursor
				}
			}
		case matchKey(msg, GlobalKeys.Down):
			maxIdx := m.itemCount() - 1
			if m.cursor < maxIdx {
				m.cursor++
				visibleRows := m.visibleRows()
				if m.cursor >= m.scroll+visibleRows {
					m.scroll = m.cursor - visibleRows + 1
				}
			}
		case matchKey(msg, GlobalKeys.GoTop):
			m.cursor = 0
			m.scroll = 0
		case matchKey(msg, GlobalKeys.GoBottom):
			maxIdx := m.itemCount() - 1
			if maxIdx >= 0 {
				m.cursor = maxIdx
				visibleRows := m.visibleRows()
				if m.cursor >= visibleRows {
					m.scroll = m.cursor - visibleRows + 1
				}
			}
		case matchKey(msg, GlobalKeys.HalfUp):
			half := m.visibleRows() / 2
			m.cursor -= half
			if m.cursor < 0 {
				m.cursor = 0
			}
			if m.cursor < m.scroll {
				m.scroll = m.cursor
			}
		case matchKey(msg, GlobalKeys.HalfDown):
			half := m.visibleRows() / 2
			maxIdx := m.itemCount() - 1
			m.cursor += half
			if m.cursor > maxIdx {
				m.cursor = maxIdx
			}
			visibleRows := m.visibleRows()
			if m.cursor >= m.scroll+visibleRows {
				m.scroll = m.cursor - visibleRows + 1
			}
		}
	}
	return m, tea.Batch(cmds...)
}

func (m StandingsModel) itemCount() int {
	if m.view == standingsViewDriver {
		return len(m.driverStandings)
	}
	return len(m.teamStandings)
}

func (m StandingsModel) visibleRows() int {
	rows := m.height - 12 // header + toggle + help + padding
	if rows < 5 {
		rows = 5
	}
	return rows
}

func (m StandingsModel) View() string {
	if m.loading {
		return fmt.Sprintf("\n  %s  Loading %d championship standings...", m.spinner.View(), m.year)
	}
	if m.err != nil {
		return renderErrorView(m.err)
	}

	var sb strings.Builder

	if m.stale {
		sb.WriteString(renderStaleBanner())
	}

	// Title row with year and toggle
	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorF1Red)).
		Render(fmt.Sprintf("  FORMULA 1 %d CHAMPIONSHIP", m.year))

	sb.WriteString(title + "\n\n")

	// Toggle bar
	dLabel, cLabel := "  d Drivers  ", "  c Constructors  "
	if m.view == standingsViewDriver {
		sb.WriteString(styleActiveTab.Render(dLabel))
		sb.WriteString(styleInactiveTab.Render(cLabel))
	} else {
		sb.WriteString(styleInactiveTab.Render(dLabel))
		sb.WriteString(styleActiveTab.Render(cLabel))
	}
	sb.WriteString("\n\n")

	if m.view == standingsViewDriver {
		sb.WriteString(m.renderDriverStandings())
	} else {
		sb.WriteString(m.renderTeamStandings())
	}

	sb.WriteString("\n")
	sb.WriteString(helpBar("y season", "d drivers", "c constructors", "j/k navigate", "g/G top/bottom", "^d/^u page", "q quit"))
	return sb.String()
}

func (m StandingsModel) renderDriverStandings() string {
	if len(m.driverStandings) == 0 {
		return styleMuted.Render("  No standings data available.\n")
	}

	var sb strings.Builder
	maxPoints := m.driverStandings[0].PointsCurrent
	w := m.width
	if w < 40 {
		w = 40
	}

	// Responsive column widths
	compact := w < 80
	nameWidth := 20
	teamWidth := 20
	barWidth := 20
	if w >= 130 {
		nameWidth = 24
		teamWidth = 24
		barWidth = 35
	} else if w >= 100 {
		barWidth = 25
	} else if compact {
		nameWidth = 0 // hide full name in compact mode
		teamWidth = 14
		barWidth = 12
	}

	visible := m.visibleRows()
	endIdx := m.scroll + visible
	if endIdx > len(m.driverStandings) {
		endIdx = len(m.driverStandings)
	}

	// Header
	var header string
	if compact {
		header = fmt.Sprintf("  %s  %s  %s  %s  %s  %s",
			padRight("POS", 3),
			padRight("", 2),
			padRight("", 1),
			padRight("DRV", 4),
			padRight("TEAM", teamWidth),
			padLeft("PTS", 5),
		)
	} else {
		header = fmt.Sprintf("  %s  %s  %s  %s  %s  %s  %s  %s",
			padRight("POS", 4),
			padRight("", 2),
			padRight("", 1),
			padRight("DRV", 4),
			padRight("DRIVER", nameWidth),
			padRight("TEAM", teamWidth),
			padLeft("PTS", 6),
			padRight("", barWidth),
		)
	}
	sb.WriteString(lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorMuted)).
		Bold(true).
		Render(header) + "\n")
	sb.WriteString("  " + divider(min(w-6, lipgloss.Width(header))) + "\n")

	for i := m.scroll; i < endIdx; i++ {
		s := m.driverStandings[i]
		d, ok := m.drivers[s.DriverNumber]
		acronym, name, team, teamColor := "---", "Unknown", "Unknown", colorMuted
		if ok {
			acronym = d.NameAcronym
			name = d.FullName
			team = d.TeamName
			if d.TeamColour != "" {
				teamColor = "#" + d.TeamColour
			} else {
				teamColor = teamColorFromName(d.TeamName)
			}
		}

		delta := renderDelta(s.PositionCurrent, s.PositionStart)
		pos := renderPosition(s.PositionCurrent)
		colorBar := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")
		pointsBar := renderPointsBar(s.PointsCurrent, maxPoints, barWidth, teamColor)

		// Styling for top 3
		nameStyle := lipgloss.NewStyle()
		if i == 0 {
			nameStyle = stylePositionFirst
		} else if i == 1 {
			nameStyle = stylePositionSecond
		} else if i == 2 {
			nameStyle = stylePositionThird
		}

		var row string
		if compact {
			row = fmt.Sprintf("  %s  %s  %s  %s  %s  %s",
				padRightVisible(pos, 3),
				delta,
				colorBar,
				nameStyle.Render(padRight(acronym, 4)),
				padRight(truncate(team, teamWidth), teamWidth),
				padLeft(fmt.Sprintf("%.0f", s.PointsCurrent), 5),
			)
		} else {
			row = fmt.Sprintf("  %s  %s  %s  %s  %s  %s  %s  %s",
				padRightVisible(pos, 4),
				delta,
				colorBar,
				nameStyle.Render(padRight(acronym, 4)),
				nameStyle.Render(padRight(truncate(name, nameWidth), nameWidth)),
				padRight(truncate(team, teamWidth), teamWidth),
				padLeft(fmt.Sprintf("%.0f", s.PointsCurrent), 6),
				pointsBar,
			)
		}

		if i == m.cursor {
			row = styleSelected.Render(row)
		}

		sb.WriteString(row + "\n")
	}

	// Scroll indicator
	if len(m.driverStandings) > visible {
		sb.WriteString(styleMuted.Render(fmt.Sprintf("  Showing %d-%d of %d", m.scroll+1, endIdx, len(m.driverStandings))) + "\n")
	}

	return sb.String()
}

func (m StandingsModel) renderTeamStandings() string {
	if len(m.teamStandings) == 0 {
		return styleMuted.Render("  No standings data available.\n")
	}

	var sb strings.Builder
	maxPoints := m.teamStandings[0].PointsCurrent
	w := m.width
	if w < 40 {
		w = 40
	}

	// Responsive
	compact := w < 80
	teamWidth := 28
	barWidth := 30
	if w >= 130 {
		barWidth = 50
	} else if w >= 100 {
		barWidth = 40
	} else if compact {
		teamWidth = 18
		barWidth = 15
	}

	visible := m.visibleRows()
	endIdx := m.scroll + visible
	if endIdx > len(m.teamStandings) {
		endIdx = len(m.teamStandings)
	}

	// Header
	header := fmt.Sprintf("  %s  %s  %s  %s  %s  %s",
		padRight("POS", 4),
		padRight("", 2),
		padRight("", 1),
		padRight("CONSTRUCTOR", teamWidth),
		padLeft("PTS", 6),
		padRight("", barWidth),
	)
	sb.WriteString(lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorMuted)).
		Bold(true).
		Render(header) + "\n")
	sb.WriteString("  " + divider(min(w-6, lipgloss.Width(header))) + "\n")

	for i := m.scroll; i < endIdx; i++ {
		s := m.teamStandings[i]
		teamColor := teamColorFromName(s.TeamName)

		delta := renderDelta(s.PositionCurrent, s.PositionStart)
		pos := renderPosition(s.PositionCurrent)
		colorBar := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")
		pointsBar := renderPointsBar(s.PointsCurrent, maxPoints, barWidth, teamColor)

		row := fmt.Sprintf("  %s  %s  %s  %s  %s  %s",
			padRightVisible(pos, 4),
			delta,
			colorBar,
			padRight(truncate(s.TeamName, teamWidth), teamWidth),
			padLeft(fmt.Sprintf("%.0f", s.PointsCurrent), 6),
			pointsBar,
		)

		if i == m.cursor {
			row = styleSelected.Render(row)
		}

		sb.WriteString(row + "\n")
	}

	if len(m.teamStandings) > visible {
		sb.WriteString(styleMuted.Render(fmt.Sprintf("  Showing %d-%d of %d", m.scroll+1, endIdx, len(m.teamStandings))) + "\n")
	}

	return sb.String()
}
