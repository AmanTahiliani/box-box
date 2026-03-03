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
	err      error
	spinner  spinner.Model
	cursor   int
	year     int
	width    int
	height   int
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
	switch msg := msg.(type) {
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
		// Auto-scroll to next upcoming race
		m.cursor = m.findNextRaceIndex()

	case tea.KeyMsg:
		switch {
		case matchKey(msg, GlobalKeys.Up):
			if m.cursor > 0 {
				m.cursor--
			}
		case matchKey(msg, GlobalKeys.Down):
			if m.cursor < len(m.meetings)-1 {
				m.cursor++
			}
		case matchKey(msg, GlobalKeys.Enter):
			if len(m.meetings) > 0 && m.cursor < len(m.meetings) {
				return m, func() tea.Msg {
					return meetingSelectedMsg{meeting: m.meetings[m.cursor]}
				}
			}
		}
	}
	return m, nil
}

func (m CalendarModel) findNextRaceIndex() int {
	now := time.Now()
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
		return fmt.Sprintf("\n  %s  Loading %d calendar…", m.spinner.View(), m.year)
	}
	if m.err != nil {
		return styleError.Render(fmt.Sprintf("\n  Error: %v", m.err))
	}
	if len(m.meetings) == 0 {
		return styleMuted.Render(fmt.Sprintf("\n  No meetings found for %d.", m.year))
	}

	const (
		wRound   = 3
		wName    = 28
		wCircuit = 20
		wCountry = 16
		wDates   = 20
		wStatus  = 3
	)

	header := styleBold.Render(
		padRight("Rd", wRound) + " " +
			padRight("Grand Prix", wName) + " " +
			padRight("Circuit", wCircuit) + " " +
			padRight("Country", wCountry) + " " +
			padRight("Dates", wDates) + " " +
			padRight("", wStatus),
	)

	var rows []string
	rows = append(rows, header)

	now := time.Now()
	nextIdx := m.findNextRaceIndex()

	for i, meeting := range m.meetings {
		isNext := (i == nextIdx)
		status := meetingStatus(meeting, now, isNext)

		dates := formatMeetingDates(meeting)
		flag := countryFlag(meeting.CountryCode)

		country := flag + " " + truncate(meeting.CountryName, wCountry-3)

		row := fmt.Sprintf("%s %s %s %s %s %s",
			padLeft(fmt.Sprintf("%d", i+1), wRound),
			padRight(truncate(meeting.MeetingName, wName), wName),
			padRight(truncate(meeting.CircuitShortName, wCircuit), wCircuit),
			padRight(country, wCountry),
			padRight(dates, wDates),
			status,
		)

		if i == m.cursor {
			row = styleSelected.Render(row)
		} else if isNext {
			row = styleNext.Render(row)
		} else {
			// Mute past races
			end, err := time.Parse(time.RFC3339, meeting.DateEnd)
			if err != nil {
				end, _ = time.Parse("2006-01-02", meeting.DateEnd[:min(len(meeting.DateEnd), 10)])
				end = end.Add(24 * time.Hour)
			}
			if end.Before(now) && i != m.cursor {
				row = stylePast.Render(row)
			}
		}

		rows = append(rows, row)
	}

	var sb strings.Builder
	sb.WriteString(styleBold.Render(fmt.Sprintf(" Season: %d", m.year)) + "\n\n")
	sb.WriteString(strings.Join(rows, "\n"))
	sb.WriteString("\n\n")
	sb.WriteString(helpBar("y season", "j/k navigate", "enter select race", "q quit"))
	return sb.String()
}

func formatMeetingDates(m models.Meeting) string {
	start, err1 := time.Parse(time.RFC3339, m.DateStart)
	end, err2 := time.Parse(time.RFC3339, m.DateEnd)
	if err1 != nil {
		if len(m.DateStart) >= 10 {
			start, _ = time.Parse("2006-01-02", m.DateStart[:10])
		}
	}
	if err2 != nil {
		if len(m.DateEnd) >= 10 {
			end, _ = time.Parse("2006-01-02", m.DateEnd[:10])
		}
	}

	if start.Month() == end.Month() {
		return fmt.Sprintf("%s %d–%d", start.Format("Jan"), start.Day(), end.Day())
	}
	return fmt.Sprintf("%s %d – %s %d", start.Format("Jan"), start.Day(), end.Format("Jan"), end.Day())
}
