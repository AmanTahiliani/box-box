package ui

import (
	"fmt"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type RaceDetailModel struct {
	client  *api.OpenF1Client
	meeting *models.Meeting

	sessions []models.Session
	results  []models.SessionResult
	drivers  map[int]models.Driver
	rcMsgs   []models.RaceControl
	weather  []models.Weather

	selectedSession *models.Session
	sessionCursor   int

	loadingSessions bool
	loadingResults  bool
	errSessions     error
	errResults      error

	spinner  spinner.Model
	rcView   viewport.Model
	rcReady  bool

	width  int
	height int
}

func NewRaceDetailModel(client *api.OpenF1Client) RaceDetailModel {
	s := spinner.New()
	s.Spinner = spinner.MiniDot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))
	return RaceDetailModel{
		client:  client,
		spinner: s,
		drivers: make(map[int]models.Driver),
	}
}

func (m RaceDetailModel) Init() tea.Cmd {
	return m.spinner.Tick
}

func fetchSessions(client *api.OpenF1Client, meetingKey int) tea.Cmd {
	return func() tea.Msg {
		sessions, err := client.GetSessionsForMeeting(meetingKey)
		return sessionsLoadedMsg{sessions: sessions, err: err}
	}
}

func fetchSessionData(client *api.OpenF1Client, sessionKey int) tea.Cmd {
	return tea.Batch(
		func() tea.Msg {
			results, err := client.GetSessionResult(sessionKey)
			return sessionResultsLoadedMsg{results: results, err: err}
		},
		func() tea.Msg {
			drivers, err := client.GetDriversForSession(sessionKey)
			return sessionDriversLoadedMsg{drivers: drivers, err: err}
		},
		func() tea.Msg {
			msgs, err := client.GetRaceControl(sessionKey)
			return raceControlLoadedMsg{messages: msgs, err: err}
		},
		func() tea.Msg {
			weather, err := client.GetWeather(sessionKey)
			return weatherLoadedMsg{weather: weather, err: err}
		},
	)
}

func (m RaceDetailModel) Update(msg tea.Msg) (RaceDetailModel, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case spinner.TickMsg:
		if m.loadingSessions || m.loadingResults {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			cmds = append(cmds, cmd)
		}

	case meetingSelectedMsg:
		m.meeting = &msg.meeting
		m.sessions = nil
		m.results = nil
		m.rcMsgs = nil
		m.weather = nil
		m.selectedSession = nil
		m.sessionCursor = 0
		m.loadingSessions = true
		m.loadingResults = false
		m.errSessions = nil
		m.errResults = nil
		m.rcReady = false
		cmds = append(cmds, fetchSessions(m.client, int(msg.meeting.MeetingKey)), m.spinner.Tick)

	case sessionsLoadedMsg:
		m.loadingSessions = false
		if msg.err != nil {
			m.errSessions = msg.err
			return m, nil
		}
		m.sessions = msg.sessions
		// Auto-select Race session if available
		for i, s := range m.sessions {
			if s.SessionName == "Race" {
				m.sessionCursor = i
				break
			}
		}

	case sessionResultsLoadedMsg:
		if msg.err != nil {
			m.errResults = msg.err
			m.loadingResults = false
			return m, nil
		}
		m.results = msg.results
		if !m.loadingResults {
			// Both results and drivers may arrive in any order
		}
		m.checkResultsLoaded()

	case sessionDriversLoadedMsg:
		if msg.err == nil {
			for _, d := range msg.drivers {
				m.drivers[d.DriverNumber] = d
			}
		}
		m.checkResultsLoaded()

	case raceControlLoadedMsg:
		if msg.err == nil {
			m.rcMsgs = msg.messages
			m.updateRCViewport()
		}

	case weatherLoadedMsg:
		if msg.err == nil {
			m.weather = msg.weather
		}

	case tea.KeyMsg:
		switch {
		case matchKey(msg, GlobalKeys.Up):
			if m.sessionCursor > 0 {
				m.sessionCursor--
			}
		case matchKey(msg, GlobalKeys.Down):
			if m.sessionCursor < len(m.sessions)-1 {
				m.sessionCursor++
			}
		case matchKey(msg, GlobalKeys.Enter):
			if len(m.sessions) > 0 && m.sessionCursor < len(m.sessions) {
				sess := m.sessions[m.sessionCursor]
				m.selectedSession = &sess
				m.loadingResults = true
				m.results = nil
				m.rcMsgs = nil
				m.weather = nil
				m.drivers = make(map[int]models.Driver)
				cmds = append(cmds, fetchSessionData(m.client, sess.SessionKey))
			}
		case matchKey(msg, RaceDetailKeys.ScrollUp):
			m.rcView.LineUp(3)
		case matchKey(msg, RaceDetailKeys.ScrollDown):
			m.rcView.LineDown(3)
		}
	}

	if m.rcReady {
		var cmd tea.Cmd
		m.rcView, cmd = m.rcView.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m *RaceDetailModel) checkResultsLoaded() {
	// Mark done once results arrive (drivers may still be loading but we show what we have)
	if m.results != nil {
		m.loadingResults = false
	}
}

func (m *RaceDetailModel) updateRCViewport() {
	content := m.renderRaceControlContent()
	if m.rcReady {
		m.rcView.SetContent(content)
		m.rcView.GotoBottom()
	}
}

func (m *RaceDetailModel) initViewport(w, h int) {
	m.rcView = viewport.New(w, h)
	m.rcReady = true
	m.updateRCViewport()
}

func (m RaceDetailModel) View() string {
	if m.meeting == nil {
		return styleMuted.Render("\n  Select a race from the Calendar tab (press 2).\n\n" +
			helpBar("2 calendar", "q quit"))
	}

	// Title
	title := styleBold.Render(m.meeting.MeetingOfficialName)
	dates := formatMeetingDates(*m.meeting)
	subtitle := styleMuted.Render(fmt.Sprintf("%s · %s · %s", m.meeting.Location, m.meeting.CountryName, dates))

	header := lipgloss.JoinVertical(lipgloss.Left, title, subtitle) + "\n\n"

	// Two-panel layout
	leftWidth := int(float64(m.width) * 0.55)
	rightWidth := m.width - leftWidth - 4

	left := m.renderLeft(leftWidth)
	right := m.renderRight(rightWidth)

	panels := lipgloss.JoinHorizontal(lipgloss.Top,
		stylePanelBorder.Width(leftWidth).Render(left),
		stylePanelBorder.Width(rightWidth).Render(right),
	)

	help := helpBar("j/k sessions", "enter load session", "K/J scroll RC", "b back to calendar", "q quit")
	return header + panels + "\n" + help
}

func (m RaceDetailModel) renderLeft(width int) string {
	var sb strings.Builder

	// Session list
	sb.WriteString(styleHeader.Render("Sessions") + "\n")
	if m.loadingSessions {
		sb.WriteString(fmt.Sprintf("  %s Loading sessions…\n", m.spinner.View()))
	} else if m.errSessions != nil {
		sb.WriteString(styleError.Render(fmt.Sprintf("  Error: %v\n", m.errSessions)))
	} else {
		for i, sess := range m.sessions {
			var start string
			if len(sess.DateStart) >= 10 {
				t, err := time.Parse(time.RFC3339, sess.DateStart)
				if err == nil {
					start = t.Format("Mon Jan 2")
				} else {
					start = sess.DateStart[:10]
				}
			}
			row := fmt.Sprintf(" %-12s %s", sess.SessionName, start)
			if i == m.sessionCursor {
				row = styleSelected.Render(row)
			} else if m.selectedSession != nil && m.selectedSession.SessionKey == sess.SessionKey {
				row = styleDeltaUp.Render(row)
			}
			sb.WriteString(row + "\n")
		}
	}

	sb.WriteString("\n" + styleHeader.Render("Results") + "\n")

	if m.loadingResults {
		sb.WriteString(fmt.Sprintf("  %s Loading results…\n", m.spinner.View()))
	} else if m.errResults != nil {
		sb.WriteString(styleError.Render(fmt.Sprintf("  Error: %v\n", m.errResults)))
	} else if m.selectedSession == nil {
		sb.WriteString(styleMuted.Render("  Press Enter to load session results.\n"))
	} else if len(m.results) == 0 {
		sb.WriteString(styleMuted.Render("  No results available.\n"))
	} else {
		sb.WriteString(m.renderResults(width - 4))
	}

	return sb.String()
}

func (m RaceDetailModel) renderResults(width int) string {
	isRace := m.selectedSession != nil && m.selectedSession.SessionType == "Race"

	const (
		wPos  = 3
		wDRV  = 4
		wTeam = 16
		wLaps = 4
		wGap  = 12
		wPts  = 4
	)

	var header string
	if isRace {
		header = styleBold.Render(
			padLeft("Pos", wPos) + " " +
				padRight("DRV", wDRV) + " " +
				padRight("Team", wTeam) + " " +
				padLeft("Laps", wLaps) + " " +
				padLeft("Gap", wGap) + " " +
				padLeft("Pts", wPts),
		)
	} else {
		header = styleBold.Render(
			padLeft("Pos", wPos) + " " +
				padRight("DRV", wDRV) + " " +
				padRight("Team", wTeam) + " " +
				padLeft("Time", wGap),
		)
	}

	var rows []string
	rows = append(rows, header)

	for _, r := range m.results {
		d := m.drivers[r.DriverNumber]
		acronym := d.NameAcronym
		if acronym == "" {
			acronym = fmt.Sprintf("#%d", r.DriverNumber)
		}
		teamName := d.TeamName
		teamColor := d.TeamColour

		teamStr := hexToStyle(teamColor).Render(padRight(truncate(teamName, wTeam), wTeam))

		var row string
		pos := fmt.Sprintf("%d", r.Position)
		if r.DNF {
			pos = "DNF"
		} else if r.DNS {
			pos = "DNS"
		} else if r.DSQ {
			pos = "DSQ"
		}

		if isRace {
			row = fmt.Sprintf("%s %s %s %s %s %s",
				padLeft(pos, wPos),
				padRight(acronym, wDRV),
				teamStr,
				padLeft(fmt.Sprintf("%d", r.NumberOfLaps), wLaps),
				padLeft(formatGap(r.GapToLeader), wGap),
				padLeft(fmt.Sprintf("%.0f", r.Points), wPts),
			)
		} else {
			row = fmt.Sprintf("%s %s %s %s",
				padLeft(pos, wPos),
				padRight(acronym, wDRV),
				teamStr,
				padLeft(formatDuration(r.Duration), wGap),
			)
		}

		if r.DNF || r.DNS || r.DSQ {
			row = styleMuted.Render(row)
		}
		rows = append(rows, row)
	}

	return strings.Join(rows, "\n")
}

func (m RaceDetailModel) renderRight(width int) string {
	var sb strings.Builder

	// Race control
	sb.WriteString(styleHeader.Render("Race Control") + "\n")
	if !m.rcReady || m.selectedSession == nil {
		sb.WriteString(styleMuted.Render("  No session selected.\n"))
	} else {
		sb.WriteString(m.rcView.View() + "\n")
	}

	// Weather strip
	sb.WriteString("\n" + styleHeader.Render("Weather") + "\n")
	sb.WriteString(m.renderWeather(width))

	return sb.String()
}

func (m RaceDetailModel) renderRaceControlContent() string {
	if len(m.rcMsgs) == 0 {
		return styleMuted.Render("  No race control messages.")
	}

	var lines []string
	for _, rc := range m.rcMsgs {
		t := "--:--"
		if len(rc.Date) >= 16 {
			pt, err := time.Parse(time.RFC3339, rc.Date)
			if err == nil {
				t = pt.Format("15:04")
			} else {
				t = rc.Date[11:16]
			}
		}

		var flagStyle lipgloss.Style
		switch rc.Flag {
		case models.FlagGreen:
			flagStyle = styleFlagGreen
		case models.FlagYellow, models.FlagDoubleYellow:
			flagStyle = styleFlagYellow
		case models.FlagRed:
			flagStyle = styleFlagRed
		case models.FlagBlue:
			flagStyle = styleFlagBlue
		default:
			flagStyle = styleMuted
		}

		prefix := flagStyle.Render(fmt.Sprintf("[%s]", t))
		lines = append(lines, fmt.Sprintf("%s %s", prefix, rc.Message))
	}

	return strings.Join(lines, "\n")
}

func (m RaceDetailModel) renderWeather(width int) string {
	if len(m.weather) == 0 {
		return styleMuted.Render("  No weather data.")
	}

	// Use the latest weather snapshot
	w := m.weather[len(m.weather)-1]

	rain := "Dry"
	if w.Rainfall > 0 {
		rain = styleFlagBlue.Render("Rain")
	}

	return fmt.Sprintf("  Air: %.1f°C  Track: %.1f°C  %s  Humidity: %.0f%%  Wind: %s %.1fm/s",
		w.AirTemperature, w.TrackTemperature, rain,
		w.Humidity, windArrow(w.WindDirection), w.WindSpeed)
}

// SetSize updates the model's dimensions and initialises the race control viewport.
func (m *RaceDetailModel) SetSize(w, h int) {
	m.width = w
	m.height = h
	// Right panel, minus header/weather/borders
	rightWidth := int(float64(w)*0.45) - 6
	rcHeight := h - 12 // approximate: title + sessions + header + weather + help
	if rcHeight < 3 {
		rcHeight = 3
	}
	if !m.rcReady {
		m.initViewport(rightWidth, rcHeight)
	} else {
		m.rcView.Width = rightWidth
		m.rcView.Height = rcHeight
	}
}
