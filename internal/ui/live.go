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

type LiveModel struct {
	client    *api.OpenF1Client
	width     int
	height    int
	loading   bool
	spinner   spinner.Model
	session   *models.Session
	positions map[int]models.Position
	intervals map[int]models.Interval
	err       error
}

func NewLiveModel(client *api.OpenF1Client) LiveModel {
	sp := spinner.New()
	sp.Spinner = spinner.Points
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))

	return LiveModel{
		client:    client,
		loading:   true,
		spinner:   sp,
		positions: make(map[int]models.Position),
		intervals: make(map[int]models.Interval),
	}
}

func (m LiveModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		fetchActiveSession(m.client),
		tickLiveTelemetry(),
	)
}

type liveSessionLoadedMsg struct {
	session *models.Session
	err     error
}

func fetchActiveSession(client *api.OpenF1Client) tea.Cmd {
	return func() tea.Msg {
		year := time.Now().Year()
		meetings, err := client.GetMeetingsForYear(year)
		if err != nil {
			return liveSessionLoadedMsg{err: err}
		}

		now := time.Now()
		var currentMtg *models.Meeting
		for i := range meetings {
			end, _ := time.Parse(time.RFC3339, meetings[i].DateEnd)
			if now.Before(end.Local()) || now.Sub(end.Local()) < 24*time.Hour {
				currentMtg = &meetings[i]
				break
			}
		}

		if currentMtg == nil {
			return liveSessionLoadedMsg{err: fmt.Errorf("no active weekend found")}
		}

		sessions, err := client.GetSessionsForMeeting(int(currentMtg.MeetingKey))
		if err != nil {
			return liveSessionLoadedMsg{err: err}
		}

		var activeSess *models.Session
		for i := range sessions {
			st, _ := time.Parse(time.RFC3339, sessions[i].DateStart)
			en, _ := time.Parse(time.RFC3339, sessions[i].DateEnd)
			if now.After(st.Local()) && now.Before(en.Local().Add(2*time.Hour)) {
				activeSess = &sessions[i]
			}
		}

		if activeSess == nil && len(sessions) > 0 {
			activeSess = &sessions[len(sessions)-1]
		}

		return liveSessionLoadedMsg{session: activeSess}
	}
}

type tickLiveTelemetryMsg time.Time

func tickLiveTelemetry() tea.Cmd {
	return tea.Tick(10*time.Second, func(t time.Time) tea.Msg {
		return tickLiveTelemetryMsg(t)
	})
}

type liveTelemetryLoadedMsg struct {
	positions []models.Position
	intervals []models.Interval
	err       error
}

func fetchLiveTelemetry(client *api.OpenF1Client, sessionKey int) tea.Cmd {
	return func() tea.Msg {
		positions, err := client.GetPositions(sessionKey, 0)
		if err != nil {
			return liveTelemetryLoadedMsg{err: err}
		}
		intervals, err := client.GetIntervals(sessionKey, 0)
		if err != nil {
			return liveTelemetryLoadedMsg{err: err}
		}
		return liveTelemetryLoadedMsg{positions: positions, intervals: intervals}
	}
}

func (m LiveModel) Update(msg tea.Msg) (LiveModel, tea.Cmd) {
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
	case liveSessionLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			m.loading = false
			return m, nil
		}
		m.session = msg.session
		if m.session != nil {
			return m, fetchLiveTelemetry(m.client, m.session.SessionKey)
		}
		m.loading = false
		return m, nil
	case tickLiveTelemetryMsg:
		if m.session != nil {
			return m, tea.Batch(fetchLiveTelemetry(m.client, m.session.SessionKey), tickLiveTelemetry())
		}
		return m, tickLiveTelemetry()
	case liveTelemetryLoadedMsg:
		m.loading = false
		if msg.err != nil {
			// Don't overwrite the screen on transient errors, just log to error field
			m.err = msg.err
			return m, nil
		}
		m.err = nil
		
		// Get latest positions and intervals per driver
		for _, p := range msg.positions {
			current, exists := m.positions[p.DriverNumber]
			if !exists || p.Date > current.Date {
				m.positions[p.DriverNumber] = p
			}
		}
		for _, i := range msg.intervals {
			current, exists := m.intervals[i.DriverNumber]
			if !exists || i.Date > current.Date {
				m.intervals[i.DriverNumber] = i
			}
		}
		return m, nil
	}
	return m, nil
}

func (m LiveModel) View() string {
	if m.loading {
		return fmt.Sprintf("\n  %s  Loading live telemetry...", m.spinner.View())
	}
	if m.err != nil && len(m.positions) == 0 {
		return styleError.Render(fmt.Sprintf("\n  Error: %v\n", m.err))
	}
	if m.session == nil {
		return styleMuted.Render("\n  No active session found.\n")
	}

	var sb strings.Builder
	titleStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red)).Bold(true)
	
	sb.WriteString("\n  " + titleStyle.Render(fmt.Sprintf("LIVE: %s", m.session.SessionName)) + "\n\n")

	if len(m.positions) == 0 {
		sb.WriteString(styleMuted.Render("  Waiting for telemetry data...\n"))
		sb.WriteString("\n\n" + helpBar("1-6 tabs", "q quit"))
		return sb.String()
	}

	// Sort drivers by position
	var drivers []int
	for d := range m.positions {
		drivers = append(drivers, d)
	}
	sort.Slice(drivers, func(i, j int) bool {
		return m.positions[drivers[i]].Position < m.positions[drivers[j]].Position
	})

	sb.WriteString(styleMuted.Render("  POS  NO   GAP        INT") + "\n")
	sb.WriteString("  " + strings.Repeat("─", 30) + "\n")

	for _, d := range drivers {
		pos := m.positions[d].Position
		interval := m.intervals[d]
		
		gapToLeader := "LAP"
		if interval.GapToLeader != nil {
			gapToLeader = fmt.Sprintf("+%.3fs", *interval.GapToLeader)
		}
		if pos == 1 {
			gapToLeader = "Leader"
		}

		gapToFront := "LAP"
		if interval.Interval != nil {
			gapToFront = fmt.Sprintf("+%.3fs", *interval.Interval)
		}
		if pos == 1 {
			gapToFront = "-"
		}

		row := fmt.Sprintf("  %-4d %-4d %-10s %-10s", pos, d, gapToLeader, gapToFront)
		sb.WriteString(row + "\n")
	}

	sb.WriteString("\n" + helpBar("1-6 tabs", "q quit"))
	return sb.String()
}
