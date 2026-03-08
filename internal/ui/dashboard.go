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

type DashboardModel struct {
	client   *api.OpenF1Client
	year     int
	width    int
	height   int
	loading  bool
	spinner  spinner.Model
	meetings []models.Meeting
	next     *models.Meeting
	sessions []models.Session
	err      error
}

func NewDashboardModel(client *api.OpenF1Client, year int) DashboardModel {
	sp := spinner.New()
	sp.Spinner = spinner.Points
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))

	return DashboardModel{
		client:  client,
		year:    year,
		loading: true,
		spinner: sp,
	}
}

func (m DashboardModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		fetchDashboardMeetings(m.client, m.year),
		tickCountdown(),
	)
}

func fetchDashboardMeetings(client *api.OpenF1Client, year int) tea.Cmd {
	return func() tea.Msg {
		meetings, err := client.GetMeetingsForYear(year)
		if err != nil {
			return dashboardMeetingsLoadedMsg{err: err}
		}
		return dashboardMeetingsLoadedMsg{meetings: meetings}
	}
}

func fetchDashboardSessions(client *api.OpenF1Client, meetingKey int) tea.Cmd {
	return func() tea.Msg {
		sessions, err := client.GetSessionsForMeeting(meetingKey)
		if err != nil {
			return dashboardSessionsLoadedMsg{err: err}
		}
		// Sort by DateStart
		sort.Slice(sessions, func(i, j int) bool {
			return sessions[i].DateStart < sessions[j].DateStart
		})
		return dashboardSessionsLoadedMsg{sessions: sessions}
	}
}

type dashboardMeetingsLoadedMsg struct {
	meetings []models.Meeting
	err      error
}

type dashboardSessionsLoadedMsg struct {
	sessions []models.Session
	err      error
}

type tickCountdownMsg time.Time

func tickCountdown() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return tickCountdownMsg(t)
	})
}

func (m DashboardModel) Update(msg tea.Msg) (DashboardModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil
	case spinner.TickMsg:
		if m.loading {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
	case dashboardMeetingsLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			m.loading = false
			return m, nil
		}
		m.meetings = msg.meetings
		now := time.Now()
		
		for i := range m.meetings {
			mtg := m.meetings[i]
			end, _ := time.Parse(time.RFC3339, mtg.DateEnd)
			if now.Before(end.Local()) || now.Sub(end.Local()) < 24*time.Hour { // also keep showing for 24h after
				m.next = &mtg
				break
			}
		}

		if m.next != nil {
			return m, fetchDashboardSessions(m.client, int(m.next.MeetingKey))
		}
		m.loading = false
		return m, nil
		
	case dashboardSessionsLoadedMsg:
		m.loading = false
		if msg.err == nil {
			m.sessions = msg.sessions
		}
		return m, nil

	case tickCountdownMsg:
		return m, tickCountdown()
	}
	return m, nil
}

func (m DashboardModel) View() string {
	if m.loading {
		return fmt.Sprintf("\n  %s  Loading dashboard...", m.spinner.View())
	}
	if m.err != nil {
		return styleError.Render(fmt.Sprintf("\n  Error: %v\n", m.err))
	}

	if m.next == nil {
		return styleMuted.Render(fmt.Sprintf("\n  No upcoming races found for %d.\n", m.year))
	}

	var sb strings.Builder
	w := m.width
	if w < 40 {
		w = 40
	}

	titleStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorF1Red)).
		Bold(true)

	sb.WriteString("\n")
	sb.WriteString(titleStyle.Render(fmt.Sprintf("  NEXT RACE: %s", m.next.MeetingOfficialName)) + "\n")
	sb.WriteString(fmt.Sprintf("  %s • %s\n", countryFlag(m.next.CountryCode), m.next.Location))
	
	now := time.Now()
	end, _ := time.Parse(time.RFC3339, m.next.DateEnd)
	endLocal := end.Local()

	// Show countdown to first session if available, else use start date
	var nextStart time.Time
	startFound := false
	for _, s := range m.sessions {
		st, _ := time.Parse(time.RFC3339, s.DateStart)
		if now.Before(st.Local()) {
			nextStart = st.Local()
			startFound = true
			break
		}
	}
	
	if !startFound {
		nextStart, _ = time.Parse(time.RFC3339, m.next.DateStart)
		nextStart = nextStart.Local()
	}

	sb.WriteString("\n")
	if now.After(nextStart) && now.Before(endLocal) {
		liveBadge := lipgloss.NewStyle().Background(lipgloss.Color(colorSoft)).Foreground(lipgloss.Color(colorSurface0)).Bold(true).Padding(0, 1).Render("LIVE")
		sb.WriteString("  " + liveBadge + "\n")
	} else if now.Before(nextStart) {
		diff := nextStart.Sub(now)
		days := int(diff.Hours() / 24)
		hours := int(diff.Hours()) % 24
		mins := int(diff.Minutes()) % 60
		secs := int(diff.Seconds()) % 60
		sb.WriteString(fmt.Sprintf("  Starts in: %dd %02dh %02dm %02ds\n", days, hours, mins, secs))
	} else {
		sb.WriteString("  " + lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted)).Render("Weekend Finished") + "\n")
	}

	sb.WriteString("\n")
	
	// Weekend Schedule
	if len(m.sessions) > 0 {
		sb.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite)).Bold(true).Render("  WEEKEND SCHEDULE (Local Time)") + "\n")
		for _, s := range m.sessions {
			st, _ := time.Parse(time.RFC3339, s.DateStart)
			stLocal := st.Local()
			day := stLocal.Format("Mon 02 Jan")
			tStr := stLocal.Format("15:04")
			
			rowStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite))
			if now.After(stLocal) {
				rowStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted))
			}
			
			sb.WriteString(rowStyle.Render(fmt.Sprintf("  %-15s %-12s %s", s.SessionName, day, tStr)) + "\n")
		}
	}

	sb.WriteString("\n" + helpBar("1-6 tabs", "q quit"))
	return sb.String()
}
