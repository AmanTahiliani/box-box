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
	drivers         map[int]models.Driver // driver_number → Driver

	view    standingsView
	loading bool
	err     error
	spinner spinner.Model

	year   int
	cursor int
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
	switch msg := msg.(type) {
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
		// Phase 2: fetch drivers to join names
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
		case matchKey(msg, StandingsKeys.DriverView):
			m.view = standingsViewDriver
			m.cursor = 0
		case matchKey(msg, StandingsKeys.ConstructorView):
			m.view = standingsViewConstructor
			m.cursor = 0
		case matchKey(msg, GlobalKeys.Up):
			if m.cursor > 0 {
				m.cursor--
			}
		case matchKey(msg, GlobalKeys.Down):
			m.cursor++
		}
	}
	return m, nil
}

func (m StandingsModel) View() string {
	if m.loading {
		return fmt.Sprintf("\n  %s  Loading %d championship standings…", m.spinner.View(), m.year)
	}
	if m.err != nil {
		return styleError.Render(fmt.Sprintf("\n  Error: %v", m.err))
	}

	var sb strings.Builder

	// Year indicator
	sb.WriteString(styleBold.Render(fmt.Sprintf(" Season: %d", m.year)) + "\n\n")

	// Toggle bar
	dStyle, cStyle := styleInactiveTab, styleInactiveTab
	if m.view == standingsViewDriver {
		dStyle = styleActiveTab
	} else {
		cStyle = styleActiveTab
	}
	sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top,
		dStyle.Render("d Drivers"),
		cStyle.Render("c Constructors"),
	))
	sb.WriteString("\n\n")

	if m.view == standingsViewDriver {
		sb.WriteString(m.renderDriverStandings())
	} else {
		sb.WriteString(m.renderTeamStandings())
	}

	sb.WriteString("\n")
	sb.WriteString(helpBar("y season", "d drivers", "c constructors", "j/k navigate", "q quit"))
	return sb.String()
}

func (m StandingsModel) renderDriverStandings() string {
	if len(m.driverStandings) == 0 {
		return styleMuted.Render("  No standings data available.")
	}

	// Column widths
	const (
		wPos     = 4
		wAcronym = 5
		wName    = 22
		wTeam    = 22
		wPoints  = 8
		wDelta   = 5
	)

	header := styleBold.Render(
		padRight("Pos", wPos) + " " +
			padRight("DRV", wAcronym) + " " +
			padRight("Name", wName) + " " +
			padRight("Team", wTeam) + " " +
			padLeft("Pts", wPoints) + " " +
			padLeft("Δ", wDelta),
	)

	var rows []string
	rows = append(rows, header)

	maxCursor := len(m.driverStandings) - 1
	if m.cursor > maxCursor {
		_ = maxCursor // cursor clamping happens in Update
	}

	for i, s := range m.driverStandings {
		d, ok := m.drivers[s.DriverNumber]
		acronym, name, team, teamColor := "---", "Unknown Driver", "Unknown Team", ""
		if ok {
			acronym = d.NameAcronym
			name = d.FullName
			team = d.TeamName
			teamColor = d.TeamColour
		}

		delta := renderDelta(s.PositionCurrent, s.PositionStart)

		teamStr := hexToStyle(teamColor).Render(truncate(team, wTeam))
		// Pad team to width (lipgloss rendering may shift widths, so use padRight on plain string then style)
		teamPlain := padRight(truncate(team, wTeam), wTeam)
		teamStr = hexToStyle(teamColor).Render(teamPlain)

		row := fmt.Sprintf("%s %s %s %s %s %s",
			padLeft(fmt.Sprintf("%d", s.PositionCurrent), wPos),
			padRight(acronym, wAcronym),
			padRight(truncate(name, wName), wName),
			teamStr,
			padLeft(fmt.Sprintf("%.0f", s.PointsCurrent), wPoints),
			delta,
		)

		if i == m.cursor {
			row = styleSelected.Render(row)
		}
		rows = append(rows, row)
	}

	return strings.Join(rows, "\n")
}

func (m StandingsModel) renderTeamStandings() string {
	if len(m.teamStandings) == 0 {
		return styleMuted.Render("  No constructor standings available.")
	}

	const (
		wPos    = 4
		wTeam   = 30
		wPoints = 8
		wDelta  = 5
	)

	header := styleBold.Render(
		padRight("Pos", wPos) + " " +
			padRight("Constructor", wTeam) + " " +
			padLeft("Pts", wPoints) + " " +
			padLeft("Δ", wDelta),
	)

	var rows []string
	rows = append(rows, header)

	for i, s := range m.teamStandings {
		delta := renderDelta(s.PositionCurrent, s.PositionStart)
		row := fmt.Sprintf("%s %s %s %s",
			padLeft(fmt.Sprintf("%d", s.PositionCurrent), wPos),
			padRight(truncate(s.TeamName, wTeam), wTeam),
			padLeft(fmt.Sprintf("%.0f", s.PointsCurrent), wPoints),
			delta,
		)
		if i == m.cursor {
			row = styleSelected.Render(row)
		}
		rows = append(rows, row)
	}

	return strings.Join(rows, "\n")
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
