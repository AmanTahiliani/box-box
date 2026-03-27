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
	tabDashboard  tabIndex = 0
	tabStandings  tabIndex = 1
	tabCalendar   tabIndex = 2
	tabRaceDetail tabIndex = 3
	tabDriver     tabIndex = 4
	tabLive       tabIndex = 5
	tabTrackMap   tabIndex = 6
)

const numTabs = 7

var tabNames = []string{"Home", "Standings", "Calendar", "Race", "Drivers", "Live", "Map"}
var tabIcons = []string{"🏠", "🏆", "📅", "🏁", "👤", "🔴", "🗺"}

// splashDoneMsg is sent after the splash screen duration has elapsed.
type splashDoneMsg struct{}

// trackPrefetchDoneMsg is sent (and silently ignored) when the background
// track-outline pre-fetch finishes. It carries no data — its only purpose is
// to satisfy the tea.Cmd contract.
type trackPrefetchDoneMsg struct{}

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
	dashboard  DashboardModel
	live       OfficialLiveModel
	trackMap   TrackMapModel

	meetings []models.Meeting

	// Splash screen state
	showSplash    bool
	splashSpinner spinner.Model
}

func NewAppModel(client *api.OpenF1Client) AppModel {
	year := time.Now().Year()

	sp := spinner.New()
	sp.Spinner = spinner.Points
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))

	return AppModel{
		client:        client,
		activeTab:     tabDashboard,
		year:          year,
		standings:     NewStandingsModel(client, year),
		calendar:      NewCalendarModel(client, year),
		raceDetail:    NewRaceDetailModel(client),
		driver:        NewDriverModel(client),
		dashboard:     NewDashboardModel(client, year),
		live:          NewOfficialLiveModel(),
		trackMap:      NewTrackMapModel(client),
		showSplash:    true,
		splashSpinner: sp,
	}
}

func splashTimer() tea.Cmd {
	return tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
		return splashDoneMsg{}
	})
}

// prefetchTrackOutlines fetches the season calendar and then pre-populates
// the track outline cache for every circuit. This runs as a background command
// so the UI is never blocked. Errors are silently discarded — this is a
// best-effort operation.
func prefetchTrackOutlines(client *api.OpenF1Client, year int) tea.Cmd {
	return func() tea.Msg {
		meetings, err := client.GetMeetingsForYear(year)
		if err != nil || len(meetings) == 0 {
			return trackPrefetchDoneMsg{}
		}
		client.PrefetchTrackOutlines(meetings)
		return trackPrefetchDoneMsg{}
	}
}

func (m AppModel) Init() tea.Cmd {
	return tea.Batch(
		m.dashboard.Init(),
		m.live.Init(),
		m.standings.Init(),
		m.calendar.Init(),
		m.raceDetail.Init(),
		m.driver.Init(),
		m.trackMap.Init(),
		m.splashSpinner.Tick,
		splashTimer(),
		// Background: pre-fetch track outlines for all circuits this season
		// so the track map works during live sessions when the API is locked.
		prefetchTrackOutlines(m.client, m.year),
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
		m.live.SetSize(m.width, contentHeight)
		var cmd1, cmd2, cmd3, cmd4, cmd5, cmd6, cmd7 tea.Cmd
		m.dashboard, cmd1 = m.dashboard.Update(msg)
		m.live, cmd2 = m.live.Update(msg)
		m.standings, cmd3 = m.standings.Update(msg)
		m.calendar, cmd4 = m.calendar.Update(msg)
		m.raceDetail, cmd5 = m.raceDetail.Update(msg)
		m.driver, cmd6 = m.driver.Update(msg)
		m.trackMap, cmd7 = m.trackMap.Update(msg)
		return m, tea.Batch(cmd1, cmd2, cmd3, cmd4, cmd5, cmd6, cmd7)

	case splashDoneMsg:
		m.showSplash = false
		return m, nil

	case trackPrefetchDoneMsg:
		// Background track pre-fetch finished — nothing to display.
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
			m.activeTab = tabDashboard
			return m, nil
		case matchKey(msg, GlobalKeys.Tab2):
			m.activeTab = tabStandings
			return m, nil
		case matchKey(msg, GlobalKeys.Tab3):
			m.activeTab = tabCalendar
			return m, nil
		case matchKey(msg, GlobalKeys.Tab4):
			m.activeTab = tabRaceDetail
			return m, nil
		case matchKey(msg, GlobalKeys.Tab5):
			m.activeTab = tabDriver
			var cmd tea.Cmd
			m.driver, cmd = m.driver.TriggerLoad()
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		case matchKey(msg, GlobalKeys.Tab6):
			m.activeTab = tabLive
			return m, nil
		case matchKey(msg, GlobalKeys.Tab7):
			m.activeTab = tabTrackMap
			if !m.trackMap.HasSession() {
				var cmd tea.Cmd
				m.trackMap, cmd = m.trackMap.FetchActiveSession(m.client)
				cmds = append(cmds, cmd)
			}
			return m, tea.Batch(cmds...)
		case matchKey(msg, GlobalKeys.NextTab):
			m.activeTab = (m.activeTab + 1) % numTabs
			if m.activeTab == tabDriver {
				var cmd tea.Cmd
				m.driver, cmd = m.driver.TriggerLoad()
				cmds = append(cmds, cmd)
			}
			return m, tea.Batch(cmds...)
		case matchKey(msg, GlobalKeys.PrevTab):
			m.activeTab = (m.activeTab - 1 + numTabs) % numTabs
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
			// Cycle years: up to current year, wrap to 2023
			if m.year >= time.Now().Year() {
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

	case startingGridLoadedMsg:
		var cmd tea.Cmd
		m.raceDetail, cmd = m.raceDetail.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case loadSecondaryDataMsg:
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

	case wsDataMsg:
		var cmd tea.Cmd
		m.live, cmd = m.live.Update(msg)
		cmds = append(cmds, cmd)
		// Forward driver info to track map for car-marker colouring
		m.trackMap.InjectDriverInfo(msg.DriverInfo)
		return m, tea.Batch(cmds...)

	case trackOutlineLoadedMsg, trackCarsLoadedMsg, trackMapTickMsg:
		var cmd tea.Cmd
		m.trackMap, cmd = m.trackMap.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case spinner.TickMsg:
		if m.showSplash {
			var cmd tea.Cmd
			m.splashSpinner, cmd = m.splashSpinner.Update(msg)
			cmds = append(cmds, cmd)
		}
		var cmd1, cmd2, cmd3, cmd4, cmd5 tea.Cmd
		m.standings, cmd1 = m.standings.Update(msg)
		m.calendar, cmd2 = m.calendar.Update(msg)
		m.raceDetail, cmd3 = m.raceDetail.Update(msg)
		m.driver, cmd4 = m.driver.Update(msg)
		m.trackMap, cmd5 = m.trackMap.Update(msg)
		cmds = append(cmds, cmd1, cmd2, cmd3, cmd4, cmd5)
		return m, tea.Batch(cmds...)
	}

	// Route keyboard input to active tab
	switch m.activeTab {
	case tabDashboard:
		var cmd tea.Cmd
		m.dashboard, cmd = m.dashboard.Update(msg)
		cmds = append(cmds, cmd)
	case tabLive:
		var cmd tea.Cmd
		m.live, cmd = m.live.Update(msg)
		cmds = append(cmds, cmd)
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
	case tabTrackMap:
		var cmd tea.Cmd
		m.trackMap, cmd = m.trackMap.Update(msg)
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
	case tabDashboard:
		content = m.dashboard.View()
	case tabLive:
		content = m.live.View()
	case tabStandings:
		content = m.standings.View()
	case tabCalendar:
		content = m.calendar.View()
	case tabRaceDetail:
		content = m.raceDetail.View()
	case tabDriver:
		content = m.driver.View()
	case tabTrackMap:
		content = m.trackMap.View()
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
	right := cacheInfo + "  " + styleMuted.Render("1-7 tabs · y year · q quit")

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
