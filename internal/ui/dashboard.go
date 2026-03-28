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

type DashboardModel struct {
	client   *api.OpenF1Client
	year     int
	width    int
	height   int
	loading  bool
	stale    bool
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
		sortSessionsByStart(sessions)
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
		if m.client.LastResponseWasStale() {
			m.stale = true
		}
		now := time.Now()
		m.next = currentMeeting(m.meetings, now)
		if m.next == nil {
			m.next = nextUpcomingMeeting(m.meetings, now)
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
			if m.client.LastResponseWasStale() {
				m.stale = true
			}
		}
		return m, nil

	case tickCountdownMsg:
		return m, tickCountdown()
	case tea.KeyMsg:
		if matchKey(msg, GlobalKeys.Retry) && m.err != nil {
			m.err = nil
			m.stale = false
			m.loading = true
			return m, m.Init()
		}
	}
	return m, nil
}

func (m DashboardModel) View() string {
	if m.loading {
		return fmt.Sprintf("\n  %s  Loading dashboard...", m.spinner.View())
	}
	if m.err != nil {
		return renderErrorView(m.err)
	}

	if m.next == nil {
		return styleMuted.Render(fmt.Sprintf("\n  No upcoming races found for %d.\n", m.year))
	}

	var sb strings.Builder
	w := m.width
	if w < 40 {
		w = 40
	}

	if m.stale {
		sb.WriteString(renderStaleBanner())
	}

	titleStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorF1Red)).
		Bold(true).
		MarginBottom(1)

	now := time.Now()
	weekendUnderway := meetingHasStarted(*m.next, now)

	// Left panel: Meeting Info & Countdown
	var leftSide strings.Builder
	leftSide.WriteString("\n")
	if weekendUnderway {
		leftSide.WriteString(titleStyle.Render(fmt.Sprintf("CURRENT RACE: %s", m.next.MeetingOfficialName)) + "\n")
	} else {
		leftSide.WriteString(titleStyle.Render(fmt.Sprintf("NEXT RACE: %s", m.next.MeetingOfficialName)) + "\n")
	}
	leftSide.WriteString(fmt.Sprintf(" %s • %s\n", countryFlag(m.next.CountryCode), m.next.Location))

	currentSession, nextSession := currentAndNextSession(m.sessions, now)

	leftSide.WriteString("\n")
	if currentSession != nil {
		liveBadge := lipgloss.NewStyle().Background(lipgloss.Color(colorF1Red)).Foreground(lipgloss.Color(colorWhite)).Bold(true).Padding(0, 1).Render("LIVE")
		leftSide.WriteString(fmt.Sprintf(" %s %s\n", liveBadge, currentSession.SessionName))
	} else if nextSession != nil {
		nextStart, err := sessionStartTime(*nextSession)
		if err != nil {
			leftSide.WriteString(" " + lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted)).Render("Schedule unavailable") + "\n")
		} else {
			diff := nextStart.Sub(now)
			days := int(diff.Hours() / 24)
			hours := int(diff.Hours()) % 24
			mins := int(diff.Minutes()) % 60
			secs := int(diff.Seconds()) % 60

			countdown := fmt.Sprintf("%dd %02dh %02dm %02ds", days, hours, mins, secs)
			leftSide.WriteString(fmt.Sprintf(" Next: %s\n", styleBold.Render(nextSession.SessionName)))
			leftSide.WriteString(fmt.Sprintf(" Starts in: %s\n", styleCountdown.Render(countdown)))
		}
	} else {
		leftSide.WriteString(" " + lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted)).Render("Weekend Finished") + "\n")
	}

	leftPanel := stylePanelBorder.Width(w/2 - 4).Render(leftSide.String())

	// Right panel: Weekend Schedule
	var rightSide strings.Builder
	if len(m.sessions) > 0 {
		rightSide.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite)).Bold(true).Render("WEEKEND SCHEDULE (Local Time)") + "\n\n")
		for _, s := range m.sessions {
			stLocal, err := sessionStartTime(s)
			if err != nil {
				continue
			}
			day := stLocal.Format("Mon 02 Jan")
			tStr := stLocal.Format("15:04")

			rowStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite))
			if end, err := sessionEndTime(s); err == nil && !now.Before(end) {
				rowStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted))
			} else if currentSession != nil && currentSession.SessionKey == s.SessionKey {
				rowStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red)).Bold(true)
			}

			rightSide.WriteString(rowStyle.Render(fmt.Sprintf("%-15s %-12s %s", s.SessionName, day, tStr)) + "\n")
		}
	}
	rightPanel := stylePanelBorder.Width(w/2 - 4).Render(rightSide.String())

	if m.width > 80 {
		sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, leftPanel, "  ", rightPanel))
	} else {
		sb.WriteString(leftPanel + "\n" + rightPanel)
	}

	sb.WriteString("\n\n" + helpBar("1-7 tabs", "q quit"))
	return sb.String()
}
