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

type driverView int

const (
	driverViewList driverView = iota
	driverViewDetail
)

type DriverModel struct {
	client     *api.OpenF1Client
	sessionKey int

	drivers        []models.Driver
	selectedDriver *models.Driver
	stints         []models.Stint
	laps           []models.Lap
	pits           []models.Pit

	view    driverView
	loading bool
	err     error
	spinner spinner.Model

	cursor int
	width  int
	height int
}

func NewDriverModel(client *api.OpenF1Client) DriverModel {
	s := spinner.New()
	s.Spinner = spinner.MiniDot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))
	return DriverModel{
		client:  client,
		loading: false, // lazy-loaded on first focus
		spinner: s,
		view:    driverViewList,
	}
}

func fetchDriverList(client *api.OpenF1Client) tea.Cmd {
	return func() tea.Msg {
		// Use latest session key
		drivers, err := client.GetDriversForSession(9999) // will use "latest" via a workaround
		if err != nil || len(drivers) == 0 {
			// Fallback: get latest championship drivers' session key
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
	)
}

func (m DriverModel) Init() tea.Cmd {
	return m.spinner.Tick
}

func (m DriverModel) Update(msg tea.Msg) (DriverModel, tea.Cmd) {
	switch msg := msg.(type) {
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
		m.cursor = 0

	case driverStintsLoadedMsg:
		if msg.err == nil {
			m.stints = msg.stints
		}
		m.loading = false

	case driverLapsLoadedMsg:
		if msg.err == nil {
			m.laps = msg.laps
		}

	case driverPitsLoadedMsg:
		if msg.err == nil {
			m.pits = msg.pits
		}

	// When a meeting is selected from calendar, update session key for driver lookup
	case meetingSelectedMsg:
		// We'll pick up session key when sessions are loaded; for now reset
		m.drivers = nil

	case sessionsLoadedMsg:
		if msg.err == nil && len(msg.sessions) > 0 {
			// Use the Race session key if available
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
			case matchKey(msg, GlobalKeys.Up):
				if m.cursor > 0 {
					m.cursor--
				}
			case matchKey(msg, GlobalKeys.Down):
				if m.cursor < len(m.drivers)-1 {
					m.cursor++
				}
			case matchKey(msg, GlobalKeys.Enter):
				if len(m.drivers) > 0 && m.cursor < len(m.drivers) {
					d := m.drivers[m.cursor]
					m.selectedDriver = &d
					m.stints = nil
					m.laps = nil
					m.pits = nil
					m.view = driverViewDetail
					m.loading = true
					sessionKey := m.sessionKey
					if sessionKey == 0 && d.SessionKey != 0 {
						sessionKey = d.SessionKey
					}
					return m, tea.Batch(
						m.spinner.Tick,
						fetchDriverDetail(m.client, sessionKey, d.DriverNumber),
					)
				}
			}
		case driverViewDetail:
			switch {
			case matchKey(msg, GlobalKeys.Back):
				m.view = driverViewList
				m.selectedDriver = nil
				m.stints = nil
				m.laps = nil
				m.pits = nil
			}
		}
	}

	return m, nil
}

// TriggerLoad initiates the driver list load if not already loaded.
func (m DriverModel) TriggerLoad() (DriverModel, tea.Cmd) {
	if m.drivers != nil || m.loading {
		return m, nil
	}
	m.loading = true
	return m, tea.Batch(m.spinner.Tick, fetchDriverList(m.client))
}

func (m DriverModel) View() string {
	if m.loading {
		return fmt.Sprintf("\n  %s  Loading drivers…", m.spinner.View())
	}
	if m.err != nil {
		return styleError.Render(fmt.Sprintf("\n  Error: %v", m.err))
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
	if len(m.drivers) == 0 {
		return styleMuted.Render("\n  No driver data. Select a race from Calendar first.\n\n" +
			helpBar("2 calendar", "q quit"))
	}

	const (
		wNum    = 3
		wAcronym = 5
		wName   = 25
		wTeam   = 22
	)

	header := styleBold.Render(
		padLeft("#", wNum) + " " +
			padRight("DRV", wAcronym) + " " +
			padRight("Name", wName) + " " +
			padRight("Team", wTeam),
	)

	var rows []string
	rows = append(rows, header)

	for i, d := range m.drivers {
		teamStr := hexToStyle(d.TeamColour).Render(padRight(truncate(d.TeamName, wTeam), wTeam))
		row := fmt.Sprintf("%s %s %s %s",
			padLeft(fmt.Sprintf("%d", d.DriverNumber), wNum),
			padRight(d.NameAcronym, wAcronym),
			padRight(truncate(d.FullName, wName), wName),
			teamStr,
		)
		if i == m.cursor {
			row = styleSelected.Render(row)
		}
		rows = append(rows, row)
	}

	var sb strings.Builder
	sb.WriteString(strings.Join(rows, "\n"))
	sb.WriteString("\n\n")
	sb.WriteString(helpBar("j/k navigate", "enter view driver", "q quit"))
	return sb.String()
}

func (m DriverModel) renderDriverDetail() string {
	if m.selectedDriver == nil {
		return ""
	}
	d := m.selectedDriver

	var sb strings.Builder

	// Nameplate header
	nameStyle := hexToStyle(d.TeamColour).Bold(true)
	sb.WriteString(nameStyle.Render(fmt.Sprintf("  %s  %s", d.NameAcronym, d.FullName)))
	sb.WriteString(styleMuted.Render(fmt.Sprintf("  ·  %s  ·  #%d", d.TeamName, d.DriverNumber)))
	sb.WriteString("\n\n")

	// Stint bar
	sb.WriteString(styleBold.Render("Stints") + "\n")
	sb.WriteString(m.renderStintBar())
	sb.WriteString("\n\n")

	// Lap sparkline
	sb.WriteString(styleBold.Render("Lap Times") + "\n")
	sparkWidth := min(m.width-4, 80)
	if sparkWidth < 10 {
		sparkWidth = 40
	}
	sb.WriteString("  " + sparkline(m.laps, sparkWidth) + "\n")
	sb.WriteString(styleMuted.Render(fmt.Sprintf("  %d laps  (▁=slow, █=fast, space=pit out)\n", len(m.laps))))
	sb.WriteString("\n")

	// Pit stops
	sb.WriteString(styleBold.Render("Pit Stops") + "\n")
	sb.WriteString(m.renderPitStops())
	sb.WriteString("\n\n")

	sb.WriteString(helpBar("b back to driver list", "q quit"))
	return sb.String()
}

func (m DriverModel) renderStintBar() string {
	if len(m.stints) == 0 {
		if m.loading {
			return fmt.Sprintf("  %s", m.spinner.View())
		}
		return styleMuted.Render("  No stint data.")
	}

	var parts []string
	for _, stint := range m.stints {
		label := fmt.Sprintf("%s %d-%d", tyreAbbrev(stint.Compound), stint.LapStart, stint.LapEnd)
		part := tyreStyle(stint.Compound).Render(fmt.Sprintf("[%s]", label))
		parts = append(parts, part)
	}

	return "  " + strings.Join(parts, "  ")
}

func (m DriverModel) renderPitStops() string {
	if len(m.pits) == 0 {
		return styleMuted.Render("  No pit stop data.")
	}

	header := styleBold.Render(
		padLeft("Lap", 4) + "  " +
			padLeft("Stop", 8) + "  " +
			padLeft("Lane", 8),
	)
	var rows []string
	rows = append(rows, header)

	for _, p := range m.pits {
		row := fmt.Sprintf("%s  %s  %s",
			padLeft(fmt.Sprintf("%d", p.LapNumber), 4),
			padLeft(fmt.Sprintf("%.3fs", p.StopDuration), 8),
			padLeft(fmt.Sprintf("%.3fs", p.LaneDuration), 8),
		)
		rows = append(rows, "  "+row)
	}

	return strings.Join(rows, "\n")
}
