package ui

import (
	"fmt"
	"strings"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type tabIndex int

const (
	tabStandings  tabIndex = 0
	tabCalendar   tabIndex = 1
	tabRaceDetail tabIndex = 2
	tabDriver     tabIndex = 3
)

var tabNames = []string{"1 Standings", "2 Calendar", "3 Race", "4 Drivers"}

// AppModel is the root Bubble Tea model.
type AppModel struct {
	client *api.OpenF1Client

	activeTab tabIndex
	width     int
	height    int

	standings  StandingsModel
	calendar   CalendarModel
	raceDetail RaceDetailModel
	driver     DriverModel
}

// NewAppModel creates the root model and wires sub-models.
func NewAppModel(client *api.OpenF1Client) AppModel {
	return AppModel{
		client:     client,
		activeTab:  tabStandings,
		standings:  NewStandingsModel(client),
		calendar:   NewCalendarModel(client),
		raceDetail: NewRaceDetailModel(client),
		driver:     NewDriverModel(client),
	}
}

func (m AppModel) Init() tea.Cmd {
	return tea.Batch(
		m.standings.Init(),
		m.calendar.Init(),
		m.raceDetail.Init(),
		m.driver.Init(),
	)
}

func (m AppModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		contentHeight := m.height - 3 // tab bar + help
		m.raceDetail.SetSize(m.width-4, contentHeight)
		return m, nil

	case tea.KeyMsg:
		// Global quit
		if matchKey(msg, GlobalKeys.Quit) {
			return m, tea.Quit
		}
		// Tab switching
		switch msg.String() {
		case "1":
			m.activeTab = tabStandings
			return m, nil
		case "2":
			m.activeTab = tabCalendar
			return m, nil
		case "3":
			m.activeTab = tabRaceDetail
			return m, nil
		case "4":
			m.activeTab = tabDriver
			var cmd tea.Cmd
			m.driver, cmd = m.driver.TriggerLoad()
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		case "b":
			// Back from race detail → calendar
			if m.activeTab == tabRaceDetail {
				m.activeTab = tabCalendar
				return m, nil
			}
		}

	case meetingSelectedMsg:
		// Switch to race detail tab and forward the message
		m.activeTab = tabRaceDetail
		var cmd tea.Cmd
		m.raceDetail, cmd = m.raceDetail.Update(msg)
		cmds = append(cmds, cmd)
		// Also forward to driver model for session key tracking
		m.driver, _ = m.driver.Update(msg)
		return m, tea.Batch(cmds...)

	case sessionsLoadedMsg:
		// Forward to raceDetail and driver
		var cmd1, cmd2 tea.Cmd
		m.raceDetail, cmd1 = m.raceDetail.Update(msg)
		m.driver, cmd2 = m.driver.Update(msg)
		cmds = append(cmds, cmd1, cmd2)
		return m, tea.Batch(cmds...)

	// Route all loaded messages to the appropriate sub-models
	case driverChampionshipLoadedMsg:
		var cmd tea.Cmd
		m.standings, cmd = m.standings.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case teamChampionshipLoadedMsg:
		var cmd tea.Cmd
		m.standings, cmd = m.standings.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case standingsDriversLoadedMsg:
		var cmd tea.Cmd
		m.standings, cmd = m.standings.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case meetingsLoadedMsg:
		var cmd tea.Cmd
		m.calendar, cmd = m.calendar.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case sessionResultsLoadedMsg:
		var cmd tea.Cmd
		m.raceDetail, cmd = m.raceDetail.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case sessionDriversLoadedMsg:
		var cmd tea.Cmd
		m.raceDetail, cmd = m.raceDetail.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case raceControlLoadedMsg:
		var cmd tea.Cmd
		m.raceDetail, cmd = m.raceDetail.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case weatherLoadedMsg:
		var cmd tea.Cmd
		m.raceDetail, cmd = m.raceDetail.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case driverListLoadedMsg:
		var cmd tea.Cmd
		m.driver, cmd = m.driver.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case driverStintsLoadedMsg:
		var cmd tea.Cmd
		m.driver, cmd = m.driver.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case driverLapsLoadedMsg:
		var cmd tea.Cmd
		m.driver, cmd = m.driver.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case driverPitsLoadedMsg:
		var cmd tea.Cmd
		m.driver, cmd = m.driver.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case spinner.TickMsg:
		// Forward spinner ticks to all sub-models
		var cmd1, cmd2, cmd3, cmd4 tea.Cmd
		m.standings, cmd1 = m.standings.Update(msg)
		m.calendar, cmd2 = m.calendar.Update(msg)
		m.raceDetail, cmd3 = m.raceDetail.Update(msg)
		m.driver, cmd4 = m.driver.Update(msg)
		cmds = append(cmds, cmd1, cmd2, cmd3, cmd4)
		return m, tea.Batch(cmds...)
	}

	// Route keyboard input to active tab
	switch m.activeTab {
	case tabStandings:
		var cmd tea.Cmd
		m.standings, cmd = m.standings.Update(msg)
		cmds = append(cmds, cmd)
	case tabCalendar:
		var cmd tea.Cmd
		m.calendar, cmd = m.calendar.Update(msg)
		cmds = append(cmds, cmd)
	case tabRaceDetail:
		var cmd tea.Cmd
		m.raceDetail, cmd = m.raceDetail.Update(msg)
		cmds = append(cmds, cmd)
	case tabDriver:
		var cmd tea.Cmd
		m.driver, cmd = m.driver.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m AppModel) View() string {
	// Tab bar
	tabs := renderTabBar(m.activeTab, m.width)

	// Content area
	var content string
	switch m.activeTab {
	case tabStandings:
		content = m.standings.View()
	case tabCalendar:
		content = m.calendar.View()
	case tabRaceDetail:
		content = m.raceDetail.View()
	case tabDriver:
		content = m.driver.View()
	}

	return tabs + "\n" + content
}

func renderTabBar(active tabIndex, width int) string {
	var tabs []string
	for i, name := range tabNames {
		if tabIndex(i) == active {
			tabs = append(tabs, styleActiveTab.Render(name))
		} else {
			tabs = append(tabs, styleInactiveTab.Render(name))
		}
	}

	bar := strings.Join(tabs, "")
	// Pad remaining width
	barWidth := lipgloss.Width(bar)
	if barWidth < width {
		bar += strings.Repeat(" ", width-barWidth)
	}
	return styleTabBar.Render(fmt.Sprintf("%s", bar))
}
