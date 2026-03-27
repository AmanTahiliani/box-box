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

	sessions  []models.Session
	results   []models.SessionResult
	drivers   map[int]models.Driver
	rcMsgs    []models.RaceControl
	weather   []models.Weather
	overtakes []models.Overtake

	selectedSession *models.Session
	sessionCursor   int
	resultsCursor   int
	resultsScroll   int

	loadingSessions  bool
	loadingResults   bool
	driversLoaded    bool
	secondaryLoading bool
	errSessions      error
	errResults       error

	spinner spinner.Model
	rcView  viewport.Model
	rcReady bool

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

// fetchSessionData fetches primary data (results + drivers) for a session.
// Secondary data (race control, weather, overtakes) is loaded after primary data arrives.
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
	)
}

// fetchSecondaryData fetches lower-priority data (race control, weather, overtakes).
func fetchSecondaryData(client *api.OpenF1Client, sessionKey int) tea.Cmd {
	return tea.Batch(
		func() tea.Msg {
			msgs, err := client.GetRaceControl(sessionKey)
			return raceControlLoadedMsg{messages: msgs, err: err}
		},
		func() tea.Msg {
			weather, err := client.GetWeather(sessionKey)
			return weatherLoadedMsg{weather: weather, err: err}
		},
		func() tea.Msg {
			overtakes, err := client.GetOvertakesForSession(sessionKey)
			return overtakesLoadedMsg{overtakes: overtakes, err: err}
		},
	)
}

func (m RaceDetailModel) Update(msg tea.Msg) (RaceDetailModel, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		// handled by SetSize from app.go

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
		m.overtakes = nil
		m.selectedSession = nil
		m.sessionCursor = 0
		m.resultsCursor = 0
		m.resultsScroll = 0
		m.loadingSessions = true
		m.loadingResults = false
		m.driversLoaded = false
		m.secondaryLoading = false
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
		// Auto-select the Race session and load its data
		raceIdx := -1
		for i, s := range m.sessions {
			if s.SessionName == "Race" {
				raceIdx = i
				break
			}
		}
		if raceIdx >= 0 {
			m.sessionCursor = raceIdx
			sess := m.sessions[raceIdx]
			m.selectedSession = &sess
			m.loadingResults = true
			m.driversLoaded = false
			m.secondaryLoading = false
			m.results = nil
			m.rcMsgs = nil
			m.weather = nil
			m.drivers = make(map[int]models.Driver)
			cmds = append(cmds, m.spinner.Tick, fetchSessionData(m.client, sess.SessionKey))
		} else if len(m.sessions) > 0 {
			// Fallback: select last session
			lastIdx := len(m.sessions) - 1
			m.sessionCursor = lastIdx
			sess := m.sessions[lastIdx]
			m.selectedSession = &sess
			m.loadingResults = true
			m.driversLoaded = false
			m.secondaryLoading = false
			m.drivers = make(map[int]models.Driver)
			cmds = append(cmds, m.spinner.Tick, fetchSessionData(m.client, sess.SessionKey))
		}

	case sessionResultsLoadedMsg:
		if msg.err != nil {
			m.errResults = msg.err
			m.loadingResults = false
			return m, nil
		}
		m.results = msg.results
		m.resultsCursor = 0
		m.resultsScroll = 0
		if cmd := m.checkPrimaryLoaded(); cmd != nil {
			cmds = append(cmds, cmd)
		}

	case sessionDriversLoadedMsg:
		if msg.err == nil {
			for _, d := range msg.drivers {
				m.drivers[d.DriverNumber] = d
			}
		}
		m.driversLoaded = true
		if cmd := m.checkPrimaryLoaded(); cmd != nil {
			cmds = append(cmds, cmd)
		}

	case loadSecondaryDataMsg:
		// Only load secondary data if it's still for the currently selected session
		if m.selectedSession != nil && m.selectedSession.SessionKey == msg.sessionKey {
			cmds = append(cmds, fetchSecondaryData(m.client, msg.sessionKey))
		}

	case raceControlLoadedMsg:
		if msg.err == nil {
			m.rcMsgs = msg.messages
			m.updateRCViewport()
		}

	case weatherLoadedMsg:
		if msg.err == nil {
			m.weather = msg.weather
		}

	case overtakesLoadedMsg:
		if msg.err == nil {
			m.overtakes = msg.overtakes
		}

	case tea.KeyMsg:
		switch {
		case matchKey(msg, GlobalKeys.Retry):
			if m.errSessions != nil && m.meeting != nil {
				m.errSessions = nil
				m.loadingSessions = true
				cmds = append(cmds, m.spinner.Tick, fetchSessions(m.client, int(m.meeting.MeetingKey)))
			} else if m.errResults != nil && m.selectedSession != nil {
				m.errResults = nil
				m.loadingResults = true
				m.driversLoaded = false
				m.secondaryLoading = false
				cmds = append(cmds, m.spinner.Tick, fetchSessionData(m.client, m.selectedSession.SessionKey))
			}
		case matchKey(msg, GlobalKeys.Up):
			if m.results != nil && m.resultsCursor > 0 {
				m.resultsCursor--
				m.ensureResultsVisible()
			}
		case matchKey(msg, GlobalKeys.Down):
			if m.results != nil && m.resultsCursor < len(m.results)-1 {
				m.resultsCursor++
				m.ensureResultsVisible()
			}
		case matchKey(msg, GlobalKeys.GoTop):
			if m.results != nil {
				m.resultsCursor = 0
				m.resultsScroll = 0
			}
		case matchKey(msg, GlobalKeys.GoBottom):
			if m.results != nil && len(m.results) > 0 {
				m.resultsCursor = len(m.results) - 1
				m.ensureResultsVisible()
			}
		case matchKey(msg, GlobalKeys.HalfUp):
			if m.results != nil {
				half := m.resultsVisibleRows() / 2
				m.resultsCursor -= half
				if m.resultsCursor < 0 {
					m.resultsCursor = 0
				}
				m.ensureResultsVisible()
			}
		case matchKey(msg, GlobalKeys.HalfDown):
			if m.results != nil {
				half := m.resultsVisibleRows() / 2
				m.resultsCursor += half
				if m.resultsCursor >= len(m.results) {
					m.resultsCursor = len(m.results) - 1
				}
				m.ensureResultsVisible()
			}
		case matchKey(msg, GlobalKeys.Enter):
			if len(m.sessions) > 0 && m.sessionCursor < len(m.sessions) {
				sess := m.sessions[m.sessionCursor]
				m.selectedSession = &sess
				m.loadingResults = true
				m.driversLoaded = false
				m.secondaryLoading = false
				m.errResults = nil
				m.results = nil
				m.rcMsgs = nil
				m.weather = nil
				m.overtakes = nil
				m.resultsCursor = 0
				m.resultsScroll = 0
				m.drivers = make(map[int]models.Driver)
				cmds = append(cmds, m.spinner.Tick, fetchSessionData(m.client, sess.SessionKey))
			}
		case matchKey(msg, RaceDetailKeys.ScrollUp):
			m.rcView.LineUp(3)
		case matchKey(msg, RaceDetailKeys.ScrollDown):
			m.rcView.LineDown(3)
		case matchKey(msg, RaceDetailKeys.PrevSession):
			if m.sessionCursor > 0 {
				m.sessionCursor--
				sess := m.sessions[m.sessionCursor]
				if m.selectedSession == nil || m.selectedSession.SessionKey != sess.SessionKey {
					m.selectedSession = &sess
					m.loadingResults = true
					m.driversLoaded = false
					m.secondaryLoading = false
					m.errResults = nil
					m.results = nil
					m.rcMsgs = nil
					m.weather = nil
					m.overtakes = nil
					m.resultsCursor = 0
					m.resultsScroll = 0
					m.drivers = make(map[int]models.Driver)
					cmds = append(cmds, m.spinner.Tick, fetchSessionData(m.client, sess.SessionKey))
				}
			}
		case matchKey(msg, RaceDetailKeys.NextSession):
			if m.sessionCursor < len(m.sessions)-1 {
				m.sessionCursor++
				sess := m.sessions[m.sessionCursor]
				if m.selectedSession == nil || m.selectedSession.SessionKey != sess.SessionKey {
					m.selectedSession = &sess
					m.loadingResults = true
					m.driversLoaded = false
					m.secondaryLoading = false
					m.errResults = nil
					m.results = nil
					m.rcMsgs = nil
					m.weather = nil
					m.overtakes = nil
					m.resultsCursor = 0
					m.resultsScroll = 0
					m.drivers = make(map[int]models.Driver)
					cmds = append(cmds, m.spinner.Tick, fetchSessionData(m.client, sess.SessionKey))
				}
			}
		}
	}

	if m.rcReady {
		var cmd tea.Cmd
		m.rcView, cmd = m.rcView.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

// checkPrimaryLoaded checks if both results and drivers have arrived.
// If so, marks loading complete and returns a command to trigger secondary data loading.
func (m *RaceDetailModel) checkPrimaryLoaded() tea.Cmd {
	if m.results != nil && m.driversLoaded {
		m.loadingResults = false
		if m.selectedSession != nil && !m.secondaryLoading {
			m.secondaryLoading = true
			return func() tea.Msg {
				return loadSecondaryDataMsg{sessionKey: m.selectedSession.SessionKey}
			}
		}
	}
	return nil
}

func (m RaceDetailModel) resultsVisibleRows() int {
	rows := m.height - 18
	if rows < 5 {
		rows = 5
	}
	return rows
}

func (m *RaceDetailModel) ensureResultsVisible() {
	visible := m.resultsVisibleRows()
	if m.resultsCursor < m.resultsScroll {
		m.resultsScroll = m.resultsCursor
	}
	if m.resultsCursor >= m.resultsScroll+visible {
		m.resultsScroll = m.resultsCursor - visible + 1
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
		return styleMuted.Render("\n  Select a race from the Calendar tab (press 2).\n\n") +
			helpBar("2 calendar", "q quit")
	}

	w := m.width
	if w < 40 {
		w = 40
	}
	compact := w < 100

	var sb strings.Builder

	// Race title header
	flag := countryFlag(m.meeting.CountryCode)
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorF1Red))

	if compact {
		sb.WriteString(titleStyle.Render(fmt.Sprintf("  %s %s", flag, m.meeting.MeetingName)) + "\n")
	} else {
		sb.WriteString(titleStyle.Render(fmt.Sprintf("  %s %s", flag, m.meeting.MeetingOfficialName)) + "\n")
	}

	dates := formatMeetingDates(*m.meeting)
	subtitle := fmt.Sprintf("  %s  %s  %s",
		styleMuted.Render(m.meeting.Location),
		styleMuted.Render("·"),
		styleMuted.Render(dates))
	sb.WriteString(subtitle + "\n\n")

	// Session selector pills
	sb.WriteString(m.renderSessionPills())
	sb.WriteString("\n\n")

	if compact {
		// Single column layout for narrow terminals
		sb.WriteString(m.renderResults(w - 4))
		sb.WriteString("\n")
		sb.WriteString(m.renderWeatherCard(w - 4))
		sb.WriteString("\n")
		sb.WriteString(m.renderOvertakes(w - 4))
		sb.WriteString("\n")
		sb.WriteString(styleSectionTitle.Render("RACE CONTROL") + "\n")
		if !m.rcReady || m.selectedSession == nil {
			sb.WriteString(styleMuted.Render("  No session selected.\n"))
		} else {
			// Show limited RC messages inline
			lines := strings.Split(m.renderRaceControlContent(), "\n")
			maxRC := 8
			if len(lines) > maxRC {
				lines = lines[len(lines)-maxRC:]
			}
			sb.WriteString(strings.Join(lines, "\n") + "\n")
			if len(m.rcMsgs) > maxRC {
				sb.WriteString(styleMuted.Render(fmt.Sprintf("  ... %d more messages (K/J scroll)", len(m.rcMsgs)-maxRC)) + "\n")
			}
		}
	} else {
		// Two-panel layout
		leftWidth := int(float64(w) * 0.55)
		rightWidth := w - leftWidth - 6

		left := m.renderResults(leftWidth)
		right := m.renderRightPanel(rightWidth)

		panels := lipgloss.JoinHorizontal(lipgloss.Top,
			stylePanelBorder.Width(leftWidth).Render(left),
			stylePanelBorder.Width(rightWidth).Render(right),
		)

		sb.WriteString(panels + "\n")
	}

	sb.WriteString(helpBar("[/] sessions", "j/k results", "g/G top/bottom", "K/J scroll RC", "b back", "q quit"))
	return sb.String()
}

func (m RaceDetailModel) renderSessionPills() string {
	if m.loadingSessions {
		return fmt.Sprintf("  %s Loading sessions...", m.spinner.View())
	}
	if m.errSessions != nil {
		return renderErrorView(m.errSessions)
	}

	var pills []string
	for i, sess := range m.sessions {
		// Format date
		var dateStr string
		if len(sess.DateStart) >= 10 {
			t, err := time.Parse(time.RFC3339, sess.DateStart)
			if err == nil {
				dateStr = t.Local().Format("Mon 2")
			} else {
				dateStr = sess.DateStart[:10]
			}
		}

		label := fmt.Sprintf("%s %s", sess.SessionName, dateStr)

		if m.selectedSession != nil && m.selectedSession.SessionKey == sess.SessionKey {
			pills = append(pills, styleSessionActive.Render(label))
		} else if i == m.sessionCursor {
			pills = append(pills, styleSessionCursor.Render(label))
		} else {
			pills = append(pills, styleSessionInactive.Render(label))
		}
	}

	return "  " + strings.Join(pills, " ")
}

func (m RaceDetailModel) renderResults(width int) string {
	var sb strings.Builder

	sb.WriteString(styleSectionTitle.Render("RESULTS") + "\n")

	if m.loadingResults {
		sb.WriteString(fmt.Sprintf("  %s Loading results...\n", m.spinner.View()))
		return sb.String()
	}
	if m.errResults != nil {
		sb.WriteString(renderErrorView(m.errResults))
		return sb.String()
	}
	if m.selectedSession == nil {
		sb.WriteString(styleMuted.Render("  Use [ ] to select a session.\n"))
		return sb.String()
	}
	if len(m.results) == 0 {
		sb.WriteString(styleMuted.Render("  No results available.\n"))
		return sb.String()
	}

	isRace := m.selectedSession.SessionType == "Race"
	compact := width < 55

	// Responsive team name width
	teamWidth := 16
	if width >= 70 {
		teamWidth = 20
	} else if compact {
		teamWidth = 10
	}

	// Column header
	var header string
	if isRace {
		if compact {
			header = fmt.Sprintf("  %s  %s  %s  %s  %s",
				padRight("P", 3),
				padRight("", 1),
				padRight("DRV", 4),
				padLeft("GAP", 10),
				padLeft("PTS", 4),
			)
		} else {
			header = fmt.Sprintf("  %s  %s  %s  %s  %s  %s  %s",
				padRight("P", 3),
				padRight("", 1),
				padRight("DRV", 4),
				padRight("TEAM", teamWidth),
				padLeft("LAPS", 4),
				padLeft("GAP", 12),
				padLeft("PTS", 4),
			)
		}
	} else {
		if compact {
			header = fmt.Sprintf("  %s  %s  %s  %s",
				padRight("P", 3),
				padRight("", 1),
				padRight("DRV", 4),
				padLeft("TIME", 12),
			)
		} else {
			header = fmt.Sprintf("  %s  %s  %s  %s  %s",
				padRight("P", 3),
				padRight("", 1),
				padRight("DRV", 4),
				padRight("TEAM", teamWidth),
				padLeft("TIME", 12),
			)
		}
	}
	sb.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted)).Bold(true).Render(header) + "\n")
	sb.WriteString("  " + divider(min(width-4, lipgloss.Width(header))) + "\n")

	visible := m.resultsVisibleRows()
	endIdx := m.resultsScroll + visible
	if endIdx > len(m.results) {
		endIdx = len(m.results)
	}

	for i := m.resultsScroll; i < endIdx; i++ {
		r := m.results[i]
		d := m.drivers[r.DriverNumber]
		acronym := d.NameAcronym
		if acronym == "" {
			acronym = fmt.Sprintf("#%d", r.DriverNumber)
		}

		teamColor := colorMuted
		if d.TeamColour != "" {
			teamColor = "#" + d.TeamColour
		} else if d.TeamName != "" {
			teamColor = teamColorFromName(d.TeamName)
		}

		colorBar := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")

		// Position with status
		var pos string
		if r.DNF {
			pos = styleDNF.Render("DNF")
		} else if r.DNS {
			pos = styleDNF.Render("DNS")
		} else if r.DSQ {
			pos = styleDNF.Render("DSQ")
		} else {
			pos = renderPosition(r.Position)
		}

		var row string
		if isRace {
			gap := formatGap(r.GapToLeader)
			var gapStyled string
			if gap == "LEADER" {
				gapStyled = styleLeader.Render("LEADER")
			} else {
				gapStyled = styleGap.Render(gap)
			}

			if compact {
				row = fmt.Sprintf("  %s  %s  %s  %s  %s",
					padRightVisible(pos, 3),
					colorBar,
					padRight(acronym, 4),
					padLeftVisible(gapStyled, 10),
					padLeft(fmt.Sprintf("%.0f", r.Points), 4),
				)
			} else {
				row = fmt.Sprintf("  %s  %s  %s  %s  %s  %s  %s",
					padRightVisible(pos, 3),
					colorBar,
					padRight(acronym, 4),
					padRight(truncate(d.TeamName, teamWidth), teamWidth),
					padLeft(fmt.Sprintf("%d", r.NumberOfLaps), 4),
					padLeftVisible(gapStyled, 12),
					padLeft(fmt.Sprintf("%.0f", r.Points), 4),
				)
			}
		} else {
			dur := formatDuration(r.Duration)
			if compact {
				row = fmt.Sprintf("  %s  %s  %s  %s",
					padRightVisible(pos, 3),
					colorBar,
					padRight(acronym, 4),
					padLeft(dur, 12),
				)
			} else {
				row = fmt.Sprintf("  %s  %s  %s  %s  %s",
					padRightVisible(pos, 3),
					colorBar,
					padRight(acronym, 4),
					padRight(truncate(d.TeamName, teamWidth), teamWidth),
					padLeft(dur, 12),
				)
			}
		}

		if i == m.resultsCursor {
			row = styleSelected.Render(row)
		}
		sb.WriteString(row + "\n")
	}

	return sb.String()
}

func (m RaceDetailModel) renderRightPanel(width int) string {
	var sb strings.Builder

	// Weather card at the top
	sb.WriteString(m.renderWeatherCard(width))
	sb.WriteString("\n")

	// Overtakes summary
	sb.WriteString(m.renderOvertakes(width))
	sb.WriteString("\n")

	// Race control
	sb.WriteString(styleSectionTitle.Render("RACE CONTROL") + "\n")
	if !m.rcReady || m.selectedSession == nil {
		sb.WriteString(styleMuted.Render("  No session selected.\n"))
	} else {
		sb.WriteString(m.rcView.View() + "\n")
	}

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

		// Category-specific icon and styling
		var prefix string
		switch rc.Category {
		case models.CategorySafetyCar:
			prefix = styleSafetyCar.Render(fmt.Sprintf("  ⚠ [%s]", t))
		case models.CategoryDRS:
			prefix = styleDRS.Render(fmt.Sprintf("  ▸ [%s]", t))
		default:
			// Flag-based coloring
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
			case models.FlagChequered:
				flagStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite)).Bold(true)
			default:
				flagStyle = styleMuted
			}

			icon := "  "
			switch rc.Flag {
			case models.FlagGreen:
				icon = "🟢"
			case models.FlagYellow:
				icon = "🟡"
			case models.FlagDoubleYellow:
				icon = "🟡"
			case models.FlagRed:
				icon = "🔴"
			case models.FlagBlue:
				icon = "🔵"
			case models.FlagChequered:
				icon = "🏁"
			default:
				icon = "  "
			}
			prefix = flagStyle.Render(fmt.Sprintf("  %s [%s]", icon, t))
		}

		lines = append(lines, fmt.Sprintf("%s %s", prefix, rc.Message))
	}

	return strings.Join(lines, "\n")
}

func (m RaceDetailModel) renderWeatherCard(width int) string {
	var sb strings.Builder
	sb.WriteString(styleSectionTitle.Render("WEATHER") + "\n")

	if len(m.weather) == 0 {
		sb.WriteString(styleMuted.Render("  No weather data.\n"))
		return sb.String()
	}

	w := m.weather[len(m.weather)-1]

	// Weather conditions
	var condStr string
	if w.Rainfall > 0 {
		condStr = styleRain.Render("🌧 Rain")
	} else {
		condStr = styleDry.Render("☀ Dry")
	}

	sb.WriteString(fmt.Sprintf("  %s  %s %s  %s %s  %s %s  %s %s%.1fm/s\n",
		condStr,
		styleWeatherLabel.Render("Air:"),
		styleWeatherValue.Render(fmt.Sprintf("%.1f°C", w.AirTemperature)),
		styleWeatherLabel.Render("Track:"),
		styleWeatherValue.Render(fmt.Sprintf("%.1f°C", w.TrackTemperature)),
		styleWeatherLabel.Render("Humidity:"),
		styleWeatherValue.Render(fmt.Sprintf("%.0f%%", w.Humidity)),
		styleWeatherLabel.Render("Wind:"),
		styleWeatherValue.Render(windArrow(w.WindDirection)+" "),
		w.WindSpeed,
	))

	return sb.String()
}

func (m *RaceDetailModel) SetSize(w, h int) {
	m.width = w
	m.height = h
	if w < 40 {
		w = 40
	}
	compact := w < 100
	var rightWidth, rcHeight int
	if compact {
		rightWidth = w - 6
		rcHeight = 8
	} else {
		rightWidth = int(float64(w)*0.45) - 8
		rcHeight = h - 14
	}
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

// renderOvertakes renders the overtakes summary section.
func (m RaceDetailModel) renderOvertakes(width int) string {
	var sb strings.Builder
	sb.WriteString(styleSectionTitle.Render("OVERTAKES") + "\n")

	if len(m.overtakes) == 0 {
		sb.WriteString(styleMuted.Render("  No overtake data.\n"))
		return sb.String()
	}

	// Total count
	sb.WriteString(fmt.Sprintf("  %s %s\n",
		styleWeatherLabel.Render("Total:"),
		lipgloss.NewStyle().Foreground(lipgloss.Color(colorYellow)).Bold(true).Render(fmt.Sprintf("%d", len(m.overtakes))),
	))

	// Tally: which drivers overtook the most?
	type driverOvertakes struct {
		driverNum  int
		overtaking int // times this driver overtook someone
		overtaken  int // times this driver was overtaken
	}
	stats := make(map[int]*driverOvertakes)
	for _, o := range m.overtakes {
		if _, ok := stats[o.OvertakingDriverNumber]; !ok {
			stats[o.OvertakingDriverNumber] = &driverOvertakes{driverNum: o.OvertakingDriverNumber}
		}
		stats[o.OvertakingDriverNumber].overtaking++

		if _, ok := stats[o.OvertakenDriverNumber]; !ok {
			stats[o.OvertakenDriverNumber] = &driverOvertakes{driverNum: o.OvertakenDriverNumber}
		}
		stats[o.OvertakenDriverNumber].overtaken++
	}

	// Find top overtakers (sorted by most overtakes made)
	type rankedDriver struct {
		driverNum  int
		overtaking int
		overtaken  int
	}
	var ranked []rankedDriver
	for _, s := range stats {
		ranked = append(ranked, rankedDriver{driverNum: s.driverNum, overtaking: s.overtaking, overtaken: s.overtaken})
	}

	// Sort by overtaking count descending
	for i := 0; i < len(ranked); i++ {
		for j := i + 1; j < len(ranked); j++ {
			if ranked[j].overtaking > ranked[i].overtaking {
				ranked[i], ranked[j] = ranked[j], ranked[i]
			}
		}
	}

	// Show top 5 overtakers
	maxShow := 5
	if len(ranked) < maxShow {
		maxShow = len(ranked)
	}
	for i := 0; i < maxShow; i++ {
		r := ranked[i]
		d := m.drivers[r.driverNum]
		acronym := d.NameAcronym
		if acronym == "" {
			acronym = fmt.Sprintf("#%d", r.driverNum)
		}

		teamColor := colorMuted
		if d.TeamColour != "" {
			teamColor = "#" + d.TeamColour
		} else if d.TeamName != "" {
			teamColor = teamColorFromName(d.TeamName)
		}

		colorBar := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")

		overtakingStr := lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorGreen)).Bold(true).
			Render(fmt.Sprintf("+%d", r.overtaking))
		overtakenStr := lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorF1Red)).
			Render(fmt.Sprintf("-%d", r.overtaken))

		sb.WriteString(fmt.Sprintf("  %s %s  %s %s\n",
			colorBar,
			padRight(acronym, 4),
			overtakingStr,
			overtakenStr,
		))
	}

	return sb.String()
}
