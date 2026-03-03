package ui

import (
	"fmt"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
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

var tabNames = []string{"Standings", "Calendar", "Race", "Drivers"}
var tabIcons = []string{"🏆", "📅", "🏁", "👤"}

// splashDoneMsg is sent after the splash screen duration has elapsed.
type splashDoneMsg struct{}

// AppModel is the root Bubble Tea model.
type AppModel struct {
	client *api.OpenF1Client

	activeTab tabIndex
	year      int
	width     int
	height    int

	standings  StandingsModel
	calendar   CalendarModel
	raceDetail RaceDetailModel
	driver     DriverModel

	meetings []models.Meeting

	// Splash screen state
	showSplash    bool
	splashSpinner spinner.Model
}

func NewAppModel(client *api.OpenF1Client) AppModel {
	year := 2025

	sp := spinner.New()
	sp.Spinner = spinner.Points
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))

	return AppModel{
		client:        client,
		activeTab:     tabStandings,
		year:          year,
		standings:     NewStandingsModel(client, year),
		calendar:      NewCalendarModel(client, year),
		raceDetail:    NewRaceDetailModel(client),
		driver:        NewDriverModel(client),
		showSplash:    true,
		splashSpinner: sp,
	}
}

func splashTimer() tea.Cmd {
	return tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
		return splashDoneMsg{}
	})
}

func (m AppModel) Init() tea.Cmd {
	return tea.Batch(
		m.standings.Init(),
		m.calendar.Init(),
		m.raceDetail.Init(),
		m.driver.Init(),
		m.splashSpinner.Tick,
		splashTimer(),
	)
}

func (m AppModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		contentHeight := m.height - 5 // tab bar(2) + status bar + help + spacing
		m.raceDetail.SetSize(m.width-4, contentHeight)
		var cmd1, cmd2, cmd3, cmd4 tea.Cmd
		m.standings, cmd1 = m.standings.Update(msg)
		m.calendar, cmd2 = m.calendar.Update(msg)
		m.raceDetail, cmd3 = m.raceDetail.Update(msg)
		m.driver, cmd4 = m.driver.Update(msg)
		return m, tea.Batch(cmd1, cmd2, cmd3, cmd4)

	case splashDoneMsg:
		m.showSplash = false
		return m, nil

	case tea.KeyMsg:
		// Any key press during splash dismisses it
		if m.showSplash {
			m.showSplash = false
			return m, nil
		}

		// Global quit
		if matchKey(msg, GlobalKeys.Quit) {
			return m, tea.Quit
		}
		// Tab switching
		switch {
		case matchKey(msg, GlobalKeys.Tab1):
			m.activeTab = tabStandings
			return m, nil
		case matchKey(msg, GlobalKeys.Tab2):
			m.activeTab = tabCalendar
			return m, nil
		case matchKey(msg, GlobalKeys.Tab3):
			m.activeTab = tabRaceDetail
			return m, nil
		case matchKey(msg, GlobalKeys.Tab4):
			m.activeTab = tabDriver
			var cmd tea.Cmd
			m.driver, cmd = m.driver.TriggerLoad()
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		case matchKey(msg, GlobalKeys.NextTab):
			m.activeTab = (m.activeTab + 1) % 4
			if m.activeTab == tabDriver {
				var cmd tea.Cmd
				m.driver, cmd = m.driver.TriggerLoad()
				cmds = append(cmds, cmd)
			}
			return m, tea.Batch(cmds...)
		case matchKey(msg, GlobalKeys.PrevTab):
			m.activeTab = (m.activeTab - 1 + 4) % 4
			if m.activeTab == tabDriver {
				var cmd tea.Cmd
				m.driver, cmd = m.driver.TriggerLoad()
				cmds = append(cmds, cmd)
			}
			return m, tea.Batch(cmds...)
		case matchKey(msg, GlobalKeys.Back):
			// Back from race detail -> calendar
			if m.activeTab == tabRaceDetail {
				m.activeTab = tabCalendar
				return m, nil
			}
		case matchKey(msg, GlobalKeys.Year):
			// Cycle years: 2025 -> 2023 -> 2024 -> 2025
			if m.year == 2025 {
				m.year = 2023
			} else {
				m.year++
			}
			m.calendar.year = m.year
			m.calendar.loading = true
			m.standings.year = m.year
			m.standings.loading = true

			return m, tea.Batch(
				m.calendar.Init(),
				m.standings.Init(),
			)
		}

	case meetingSelectedMsg:
		m.activeTab = tabRaceDetail
		var cmd tea.Cmd
		m.raceDetail, cmd = m.raceDetail.Update(msg)
		cmds = append(cmds, cmd)
		m.driver, _ = m.driver.Update(msg)
		return m, tea.Batch(cmds...)

	case sessionsLoadedMsg:
		var cmd1, cmd2 tea.Cmd
		m.raceDetail, cmd1 = m.raceDetail.Update(msg)
		m.driver, cmd2 = m.driver.Update(msg)
		cmds = append(cmds, cmd1, cmd2)
		return m, tea.Batch(cmds...)

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
		if msg.err == nil {
			m.meetings = msg.meetings
		}
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

	case overtakesLoadedMsg:
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

	case driverPositionsLoadedMsg:
		var cmd tea.Cmd
		m.driver, cmd = m.driver.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case driverTeamRadioLoadedMsg:
		var cmd tea.Cmd
		m.driver, cmd = m.driver.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case spinner.TickMsg:
		if m.showSplash {
			var cmd tea.Cmd
			m.splashSpinner, cmd = m.splashSpinner.Update(msg)
			cmds = append(cmds, cmd)
		}
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
	if m.showSplash {
		return m.renderSplash()
	}

	w := m.width
	if w < 40 {
		w = 40
	}

	// Red accent stripe at the very top (F1 style)
	stripe := styleTabStripe.Render(strings.Repeat("▔", w))

	// Tab bar
	tabs := renderTabBar(m.activeTab, m.year, w)

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

	statusBar := m.renderStatusBar(w)

	// Calculate how much vertical space is available for content
	usedLines := 1 + 1 + 1 + 1 // stripe + tab bar + gap + status bar
	contentHeight := m.height - usedLines
	if contentHeight < 5 {
		contentHeight = 5
	}

	// Trim content to fit available height
	contentLines := strings.Split(content, "\n")
	if len(contentLines) > contentHeight {
		contentLines = contentLines[:contentHeight]
	}
	content = strings.Join(contentLines, "\n")

	return stripe + "\n" + tabs + "\n" + content + "\n" + statusBar
}

func renderTabBar(active tabIndex, year int, width int) string {
	// Build the logo
	logo := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorF1Red)).
		Background(lipgloss.Color(colorSurface0)).
		Padding(0, 1).
		Render("F1")

	// Build tabs
	var tabs []string
	for i, name := range tabNames {
		label := fmt.Sprintf(" %s %d %s ", tabIcons[i], i+1, name)
		if tabIndex(i) == active {
			tabs = append(tabs, styleActiveTab.Render(label))
		} else {
			tabs = append(tabs, styleInactiveTab.Render(label))
		}
	}

	// Year badge
	yearBadge := styleYearBadge.Render(fmt.Sprintf(" %d ", year))

	// Assemble: logo + tabs + spacer + year
	left := logo + strings.Join(tabs, "")
	leftWidth := lipgloss.Width(left)
	yearWidth := lipgloss.Width(yearBadge)
	spacerWidth := width - leftWidth - yearWidth
	if spacerWidth < 0 {
		spacerWidth = 0
	}
	spacer := lipgloss.NewStyle().
		Background(lipgloss.Color(colorSurface0)).
		Render(strings.Repeat(" ", spacerWidth))

	bar := left + spacer + yearBadge
	return styleTabBar.Render(bar)
}

func (m AppModel) renderStatusBar(width int) string {
	now := time.Now()

	// Left side: brand
	leftParts := []string{
		lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorF1Red)).
			Bold(true).
			Render("BOX-BOX"),
	}

	// Next race countdown
	var nextMeeting *models.Meeting
	for i := range m.meetings {
		start, err := time.Parse(time.RFC3339, m.meetings[i].DateStart)
		if err != nil {
			start, _ = time.Parse("2006-01-02", m.meetings[i].DateStart[:min(len(m.meetings[i].DateStart), 10)])
		}
		if start.After(now) {
			nextMeeting = &m.meetings[i]
			break
		}
	}

	if nextMeeting != nil {
		start, err := time.Parse(time.RFC3339, nextMeeting.DateStart)
		if err == nil {
			diff := start.Sub(now)
			days := int(diff.Hours() / 24)
			hours := int(diff.Hours()) % 24

			flag := countryFlag(nextMeeting.CountryCode)
			raceName := styleStatusValue.Render(nextMeeting.MeetingName)
			countdown := styleCountdown.Render(fmt.Sprintf("%dd %dh", days, hours))

			leftParts = append(leftParts,
				styleStatusLabel.Render("│"),
				styleStatusLabel.Render("NEXT"),
				flag+" "+raceName,
				styleStatusLabel.Render("in"),
				countdown,
			)
		}
	}

	left := strings.Join(leftParts, " ")

	// Right side: cache stats + navigation hints
	cacheStats := m.client.CacheStats()
	cacheInfo := styleMuted.Render(fmt.Sprintf("cache %d/%d", cacheStats.Hits, cacheStats.Hits+cacheStats.Misses))
	right := cacheInfo + "  " + styleMuted.Render("1-4 tabs · y year · q quit")

	leftW := lipgloss.Width(left)
	rightW := lipgloss.Width(right)
	spacerW := width - leftW - rightW - 2
	if spacerW < 0 {
		spacerW = 0
	}

	bar := " " + left + strings.Repeat(" ", spacerW) + right + " "
	return styleStatusBar.Width(width).Render(bar)
}

func (m AppModel) renderSplash() string {
	w := m.width
	h := m.height
	if w == 0 {
		w = 80
	}
	if h == 0 {
		h = 24
	}

	// F1-themed ASCII logo
	logo := []string{
		"██████╗  ██████╗ ██╗  ██╗     ██████╗  ██████╗ ██╗  ██╗",
		"██╔══██╗██╔═══██╗╚██╗██╔╝     ██╔══██╗██╔═══██╗╚██╗██╔╝",
		"██████╔╝██║   ██║ ╚███╔╝█████╗██████╔╝██║   ██║ ╚███╔╝ ",
		"██╔══██╗██║   ██║ ██╔██╗╚════╝██╔══██╗██║   ██║ ██╔██╗ ",
		"██████╔╝╚██████╔╝██╔╝ ██╗     ██████╔╝╚██████╔╝██╔╝ ██╗",
		"╚═════╝  ╚═════╝ ╚═╝  ╚═╝     ╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
	}

	redStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorF1Red)).
		Bold(true)

	var logoBlock strings.Builder
	for _, line := range logo {
		logoBlock.WriteString(redStyle.Render(line) + "\n")
	}

	subtitle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorMuted)).
		Render("Formula 1 Terminal Dashboard")

	loadingLine := fmt.Sprintf("%s  %s",
		m.splashSpinner.View(),
		styleMuted.Render("Loading data..."))

	hint := lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSurface2)).
		Render("press any key to skip")

	content := lipgloss.JoinVertical(lipgloss.Center,
		logoBlock.String(),
		"",
		subtitle,
		"",
		loadingLine,
		"",
		hint,
	)

	// Center the splash on screen
	return lipgloss.Place(w, h, lipgloss.Center, lipgloss.Center, content)
}
