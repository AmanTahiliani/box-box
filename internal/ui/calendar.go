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

type CalendarModel struct {
	client   *api.OpenF1Client
	meetings []models.Meeting
	loading  bool
	stale    bool
	err      error
	spinner  spinner.Model
	year     int
	width    int
	height   int

	cursor int
	scroll int
}

func NewCalendarModel(client *api.OpenF1Client, year int) CalendarModel {
	s := spinner.New()
	s.Spinner = spinner.MiniDot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))

	return CalendarModel{
		client:  client,
		loading: true,
		spinner: s,
		year:    year,
	}
}

func fetchMeetings(client *api.OpenF1Client, year int) tea.Cmd {
	return func() tea.Msg {
		meetings, err := client.GetMeetingsForYear(year)
		return meetingsLoadedMsg{meetings: meetings, err: err}
	}
}

func (m CalendarModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		fetchMeetings(m.client, m.year),
	)
}

func (m CalendarModel) Update(msg tea.Msg) (CalendarModel, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case spinner.TickMsg:
		if m.loading {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	case meetingsLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			m.loading = false
			return m, nil
		}
		m.meetings = msg.meetings
		m.loading = false
		if m.client.LastResponseWasStale() {
			m.stale = true
		}
		// Auto-scroll to next upcoming race
		m.cursor = m.findNextRaceIndex()
		m.ensureCursorVisible()

	case tea.KeyMsg:
		switch {
		case matchKey(msg, GlobalKeys.Retry):
			if m.err != nil {
				m.err = nil
				m.stale = false
				m.loading = true
				return m, tea.Batch(m.spinner.Tick, fetchMeetings(m.client, m.year))
			}
		case matchKey(msg, GlobalKeys.Up):
			if m.cursor > 0 {
				m.cursor--
				m.ensureCursorVisible()
			}
		case matchKey(msg, GlobalKeys.Down):
			if m.cursor < len(m.meetings)-1 {
				m.cursor++
				m.ensureCursorVisible()
			}
		case matchKey(msg, GlobalKeys.GoTop):
			m.cursor = 0
			m.scroll = 0
		case matchKey(msg, GlobalKeys.GoBottom):
			if len(m.meetings) > 0 {
				m.cursor = len(m.meetings) - 1
				m.ensureCursorVisible()
			}
		case matchKey(msg, GlobalKeys.HalfUp):
			half := m.visibleRows() / 2
			m.cursor -= half
			if m.cursor < 0 {
				m.cursor = 0
			}
			m.ensureCursorVisible()
		case matchKey(msg, GlobalKeys.HalfDown):
			half := m.visibleRows() / 2
			m.cursor += half
			if m.cursor >= len(m.meetings) {
				m.cursor = len(m.meetings) - 1
			}
			m.ensureCursorVisible()
		case matchKey(msg, GlobalKeys.Enter):
			if len(m.meetings) > 0 && m.cursor >= 0 && m.cursor < len(m.meetings) {
				return m, func() tea.Msg {
					return meetingSelectedMsg{meeting: m.meetings[m.cursor]}
				}
			}
		}
	}
	return m, tea.Batch(cmds...)
}

func (m CalendarModel) visibleRows() int {
	rows := m.height - 10
	if rows < 5 {
		rows = 5
	}
	return rows
}

func (m *CalendarModel) ensureCursorVisible() {
	visible := m.visibleRows()
	if m.cursor < m.scroll {
		m.scroll = m.cursor
	}
	if m.cursor >= m.scroll+visible {
		m.scroll = m.cursor - visible + 1
	}
}

func (m CalendarModel) findNextRaceIndex() int {
	now := time.Now()

	// First: return the index of a meeting currently underway (started but not ended).
	for i, meeting := range m.meetings {
		start, err := time.Parse(time.RFC3339, meeting.DateStart)
		if err != nil {
			start, _ = time.Parse("2006-01-02", meeting.DateStart[:min(len(meeting.DateStart), 10)])
		}
		end, err2 := time.Parse(time.RFC3339, meeting.DateEnd)
		if err2 != nil {
			end, _ = time.Parse("2006-01-02", meeting.DateEnd[:min(len(meeting.DateEnd), 10)])
			end = end.Add(24 * time.Hour)
		}
		if now.After(start.Local()) && now.Before(end.Local()) {
			return i
		}
	}

	// Second: return the next upcoming meeting (start is in the future).
	for i, meeting := range m.meetings {
		start, err := time.Parse(time.RFC3339, meeting.DateStart)
		if err != nil {
			start, err = time.Parse("2006-01-02", meeting.DateStart[:min(len(meeting.DateStart), 10)])
			if err != nil {
				continue
			}
		}
		if start.After(now) {
			return i
		}
	}
	return max(0, len(m.meetings)-1)
}

func (m CalendarModel) View() string {
	if m.loading {
		return fmt.Sprintf("\n  %s  Loading %d calendar...", m.spinner.View(), m.year)
	}
	if m.err != nil {
		return renderErrorView(m.err)
	}
	if len(m.meetings) == 0 {
		return styleMuted.Render(fmt.Sprintf("\n  No meetings found for %d.\n", m.year))
	}

	var sb strings.Builder

	if m.stale {
		sb.WriteString(renderStaleBanner())
	}

	// Title
	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorF1Red)).
		Render(fmt.Sprintf("  FORMULA 1 %d RACE CALENDAR", m.year))
	sb.WriteString(title + "\n\n")

	// Custom rendered list (no bubbles/table - gives us more control)
	now := time.Now()
	nextIdx := m.findNextRaceIndex()
	visible := m.visibleRows()

	endIdx := m.scroll + visible
	if endIdx > len(m.meetings) {
		endIdx = len(m.meetings)
	}

	w := m.width
	if w < 40 {
		w = 40
	}
	compact := w < 90
	wide := w >= 120

	// Responsive column widths
	gpWidth := 30
	circuitWidth := 22
	countryWidth := 18
	if compact {
		gpWidth = min(24, w-30)
		circuitWidth = 0 // hide circuit in compact mode
		countryWidth = 14
	} else if wide {
		gpWidth = 34
		circuitWidth = 26
	}

	// Header
	var header string
	if compact {
		header = fmt.Sprintf("  %s  %s  %s  %s  %s",
			padRight("RD", 3),
			padRight("S", 1),
			padRight("GRAND PRIX", gpWidth),
			padRight("COUNTRY", countryWidth),
			padRight("DATES", 14),
		)
	} else {
		header = fmt.Sprintf("  %s  %s  %s  %s  %s  %s",
			padRight("RD", 3),
			padRight("S", 1),
			padRight("GRAND PRIX", gpWidth),
			padRight("CIRCUIT", circuitWidth),
			padRight("COUNTRY", countryWidth),
			padRight("DATES", 14),
		)
	}
	sb.WriteString(lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorMuted)).
		Bold(true).
		Render(header) + "\n")
	sb.WriteString("  " + divider(min(w-6, lipgloss.Width(header))) + "\n")

	for i := m.scroll; i < endIdx; i++ {
		meeting := m.meetings[i]
		isNext := (i == nextIdx)
		status := meetingStatus(meeting, now, isNext)
		dates := formatMeetingDates(meeting)
		flag := countryFlag(meeting.CountryCode)

		// Round number with special styling
		roundNum := fmt.Sprintf("R%d", i+1)
		if i+1 < 10 {
			roundNum = fmt.Sprintf("R%d ", i+1)
		}

		// Style round number based on status
		var roundStyle lipgloss.Style
		if isNext {
			roundStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red)).Bold(true)
		} else {
			roundStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted))
		}

		// flag is 2 regional-indicator runes but renders as 2 terminal columns (double-width).
		// Reserve 3 columns for "🇬🇧 " (2 cols for emoji + 1 for space) so country name width
		// is countryWidth-3 runes, keeping the whole field at countryWidth visible columns.
		countryField := padRight(flag+" "+truncate(meeting.CountryName, countryWidth-3), countryWidth)

		var row string
		if compact {
			row = fmt.Sprintf("  %s  %s  %s  %s  %s",
				roundStyle.Render(padRight(roundNum, 3)),
				padRightVisible(status, 1), // status icon is 1 visible column; no extra padding needed
				padRight(truncate(meeting.MeetingName, gpWidth), gpWidth),
				countryField,
				styleMuted.Render(dates),
			)
		} else {
			row = fmt.Sprintf("  %s  %s  %s  %s  %s  %s",
				roundStyle.Render(padRight(roundNum, 3)),
				padRightVisible(status, 1), // status icon is 1 visible column; no extra padding needed
				padRight(truncate(meeting.MeetingName, gpWidth), gpWidth),
				padRight(truncate(meeting.CircuitShortName, circuitWidth), circuitWidth),
				countryField,
				styleMuted.Render(dates),
			)
		}

		if i == m.cursor {
			// Highlight the entire row
			row = styleSelected.Render(row)
		} else if isNext {
			// Subtle highlight for next race
			row = lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite)).Bold(true).Render(row)
		}

		sb.WriteString(row + "\n")
	}

	// Scroll indicator
	if len(m.meetings) > visible {
		sb.WriteString(styleMuted.Render(fmt.Sprintf("\n  Showing %d-%d of %d races", m.scroll+1, endIdx, len(m.meetings))) + "\n")
	}

	sb.WriteString("\n")
	sb.WriteString(helpBar("y season", "j/k navigate", "g/G top/bottom", "^d/^u page", "enter select", "q quit"))
	return sb.String()
}

func formatMeetingDates(m models.Meeting) string {
	start, err1 := time.Parse(time.RFC3339, m.DateStart)
	end, err2 := time.Parse(time.RFC3339, m.DateEnd)
	if err1 != nil {
		if len(m.DateStart) >= 10 {
			start, _ = time.Parse("2006-01-02", m.DateStart[:10])
		}
	} else {
		start = start.Local()
	}
	if err2 != nil {
		if len(m.DateEnd) >= 10 {
			end, _ = time.Parse("2006-01-02", m.DateEnd[:10])
		}
	} else {
		end = end.Local()
	}

	if start.Month() == end.Month() {
		return fmt.Sprintf("%s %d-%d", start.Format("Jan"), start.Day(), end.Day())
	}
	return fmt.Sprintf("%s %d - %s %d", start.Format("Jan"), start.Day(), end.Format("Jan"), end.Day())
}
