package ui

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ---------------------------------------------------------------------------
// Track Map model
// ---------------------------------------------------------------------------

// trackPoint is a normalized (col, row) point in the terminal canvas.
type trackPoint struct {
	col, row int
}

// TrackMapModel renders an ASCII track outline with live car positions.
type TrackMapModel struct {
	client *api.OpenF1Client

	width  int
	height int

	// Resolved session key used to fetch live location data.
	sessionKey int
	// circuitKey identifies the physical circuit for cached track outline lookups.
	// It is stable across sessions and years for the same track.
	circuitKey int

	// Track outline (normalized points from driver 1's path)
	outline []trackPoint
	// Bounds of the raw coordinate space (filled during normalization)
	rawMinX, rawMaxX float64
	rawMinY, rawMaxY float64

	// Car positions: driver number → latest location
	carPositions map[int]models.Location
	// Driver info from OfficialLiveModel (injected on each render)
	driverInfo map[string]F1DriverListEntry

	// State machine
	loadingSession bool // true while resolving the active session key
	loadingOutline bool
	loadingCars    bool
	outlineReady   bool
	err            error

	spinner spinner.Model
}

func NewTrackMapModel(client *api.OpenF1Client) TrackMapModel {
	sp := spinner.New()
	sp.Spinner = spinner.Points
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red))
	return TrackMapModel{
		client:       client,
		spinner:      sp,
		carPositions: make(map[int]models.Location),
		driverInfo:   make(map[string]F1DriverListEntry),
	}
}

// HasSession returns true if a session key is already set.
func (m TrackMapModel) HasSession() bool {
	return m.sessionKey != 0
}

// FetchActiveSession fetches the currently active session from OpenF1 and sets it.
func (m *TrackMapModel) FetchActiveSession(client *api.OpenF1Client) (TrackMapModel, tea.Cmd) {
	year := time.Now().Year()
	m.loadingSession = true
	m.err = nil
	cmd := tea.Batch(m.fetchActiveSession(client, year), m.spinner.Tick)
	return *m, cmd
}

func (m *TrackMapModel) fetchActiveSession(client *api.OpenF1Client, year int) tea.Cmd {
	return func() tea.Msg {
		meetings, err := client.GetMeetingsForYear(year)
		if err != nil {
			return trackOutlineLoadedMsg{err: err}
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
			return trackOutlineLoadedMsg{err: fmt.Errorf("no active weekend found")}
		}

		sessions, err := client.GetSessionsForMeeting(int(currentMtg.MeetingKey))
		if err != nil {
			return trackOutlineLoadedMsg{err: err}
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

		if activeSess == nil {
			return trackOutlineLoadedMsg{err: fmt.Errorf("no active session found")}
		}

		return sessionKeyMsg{
			sessionKey: activeSess.SessionKey,
			circuitKey: currentMtg.CircuitKey,
		}
	}
}

type sessionKeyMsg struct {
	sessionKey int
	circuitKey int
}

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

type trackOutlineLoadedMsg struct {
	locations []models.Location
	err       error
}

type trackCarsLoadedMsg struct {
	locations []models.Location
	err       error
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

// fetchTrackOutline downloads location data for a single reference driver
// (driver 1 by convention, then any driver if 1 is absent) to build the
// track outline for the given session.
//
// It first checks the persistent track outline cache keyed by circuitKey.
// If a stored outline exists for this season it is used directly, which means
// the track map works even during a live-session API lockout on the free tier.
func fetchTrackOutline(client *api.OpenF1Client, sessionKey, circuitKey int) tea.Cmd {
	return func() tea.Msg {
		year := time.Now().Year()

		// Check the pre-fetched outline cache before hitting the API.
		if circuitKey != 0 {
			if locs, ok := client.Cache().GetTrackOutline(circuitKey, year); ok && len(locs) >= 50 {
				return trackOutlineLoadedMsg{locations: locs}
			}
		}

		// Fall back to a live API fetch.
		candidates := []int{1, 11, 44, 16, 55, 4, 14, 63, 81, 24}
		for _, dn := range candidates {
			locs, err := client.GetLocation(sessionKey, dn)
			if err == nil && len(locs) > 50 {
				// Opportunistically save to the track outline cache for next time.
				if circuitKey != 0 {
					_ = client.Cache().SetTrackOutline(circuitKey, year, locs)
				}
				return trackOutlineLoadedMsg{locations: locs}
			}
		}
		return trackOutlineLoadedMsg{err: fmt.Errorf("no location data available for session %d", sessionKey)}
	}
}

// fetchAllCarPositions downloads the most recent location for every driver
// (using the live session key stored in the model). We fetch all 20 drivers
// concurrently and keep only the last location per driver.
func fetchAllCarPositions(client *api.OpenF1Client, sessionKey int) tea.Cmd {
	return func() tea.Msg {
		locs, err := client.GetLocation(sessionKey, 0)
		if err != nil {
			return trackCarsLoadedMsg{err: err}
		}
		return trackCarsLoadedMsg{locations: locs}
	}
}

// tickTrackMap schedules a periodic car-position refresh.
func tickTrackMap() tea.Cmd {
	return tea.Tick(5*time.Second, func(_ time.Time) tea.Msg {
		return trackMapTickMsg{}
	})
}

type trackMapTickMsg struct{}

// ---------------------------------------------------------------------------
// Init / Update / View
// ---------------------------------------------------------------------------

func (m TrackMapModel) Init() tea.Cmd {
	return m.spinner.Tick
}

// SetSessionKey wires the track map to a specific session. If the session
// differs from the one already loaded, it triggers a fresh outline fetch.
// circuitKey is used to look up the pre-cached track outline for this circuit.
func (m TrackMapModel) SetSessionKey(sessionKey, circuitKey int) (TrackMapModel, tea.Cmd) {
	if sessionKey == m.sessionKey && m.outlineReady {
		return m, nil
	}
	m.sessionKey = sessionKey
	m.circuitKey = circuitKey
	m.loadingOutline = true
	m.outlineReady = false
	m.outline = nil
	m.carPositions = make(map[int]models.Location)
	m.err = nil
	return m, tea.Batch(fetchTrackOutline(m.client, sessionKey, circuitKey), m.spinner.Tick)
}

// InjectDriverInfo forwards the latest DriverInfo map from OfficialLiveModel
// so car markers can be team-coloured.
func (m *TrackMapModel) InjectDriverInfo(info map[string]F1DriverListEntry) {
	m.driverInfo = info
}

func (m TrackMapModel) Update(msg tea.Msg) (TrackMapModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case spinner.TickMsg:
		if m.loadingSession || m.loadingOutline || m.loadingCars {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	case trackOutlineLoadedMsg:
		m.loadingSession = false
		m.loadingOutline = false
		if msg.err != nil {
			m.err = msg.err
			return m, nil
		}
		m.buildOutline(msg.locations)
		m.outlineReady = true
		// Start fetching car positions
		m.loadingCars = true
		return m, tea.Batch(fetchAllCarPositions(m.client, m.sessionKey), tickTrackMap())

	case trackCarsLoadedMsg:
		m.loadingCars = false
		if msg.err != nil {
			// Soft error — keep the outline, show empty cars
			return m, nil
		}
		// Keep only the latest location per driver
		latest := make(map[int]models.Location)
		for _, loc := range msg.locations {
			existing, ok := latest[loc.DriverNumber]
			if !ok || loc.Date > existing.Date {
				latest[loc.DriverNumber] = loc
			}
		}
		m.carPositions = latest
		return m, nil

	case sessionKeyMsg:
		m.loadingSession = false
		if msg.sessionKey != m.sessionKey || msg.circuitKey != m.circuitKey {
			m.sessionKey = msg.sessionKey
			m.circuitKey = msg.circuitKey
			m.loadingOutline = true
			m.outlineReady = false
			m.outline = nil
			m.carPositions = make(map[int]models.Location)
			m.err = nil
			return m, tea.Batch(fetchTrackOutline(m.client, msg.sessionKey, msg.circuitKey), m.spinner.Tick)
		}
		return m, nil

	case trackMapTickMsg:
		if m.outlineReady && m.sessionKey != 0 {
			m.loadingCars = true
			return m, fetchAllCarPositions(m.client, m.sessionKey)
		}
		return m, tickTrackMap()

	case wsDataMsg:
		// When live WS data arrives, update driver info if we can.
		// (TrackMapModel.InjectDriverInfo is called from app.go on each wsDataMsg)
		return m, nil
	}
	return m, nil
}

func (m TrackMapModel) View() string {
	if m.loadingSession {
		return fmt.Sprintf("\n  %s  Resolving active session...\n", m.spinner.View())
	}
	if m.loadingOutline {
		return fmt.Sprintf("\n  %s  Building track outline...\n", m.spinner.View())
	}
	if m.err != nil {
		return renderErrorView(m.err)
	}
	if !m.outlineReady {
		return "\n  " + styleMuted.Render("No active session found. Press 7 again once a session is underway.") + "\n"
	}
	return m.renderMap()
}

// ---------------------------------------------------------------------------
// Track outline builder
// ---------------------------------------------------------------------------

// buildOutline computes a set of normalized terminal-space (col, row) points
// from raw X/Y location data.
func (m *TrackMapModel) buildOutline(locs []models.Location) {
	if len(locs) == 0 {
		return
	}

	// Find bounding box of raw coordinates
	m.rawMinX, m.rawMaxX = locs[0].X, locs[0].X
	m.rawMinY, m.rawMaxY = locs[0].Y, locs[0].Y
	for _, l := range locs {
		if l.X < m.rawMinX {
			m.rawMinX = l.X
		}
		if l.X > m.rawMaxX {
			m.rawMaxX = l.X
		}
		if l.Y < m.rawMinY {
			m.rawMinY = l.Y
		}
		if l.Y > m.rawMaxY {
			m.rawMaxY = l.Y
		}
	}

	// Use a step-down approach to avoid over-sampling: only add a new point
	// if it's sufficiently different from the previous one (in normalised space).
	// We normalize to a 60×24 grid first, then de-duplicate.
	const gridW, gridH = 60, 22
	seen := make(map[trackPoint]struct{})
	var pts []trackPoint

	for _, l := range locs {
		tp := m.rawToGrid(l.X, l.Y, gridW, gridH)
		if _, dup := seen[tp]; dup {
			continue
		}
		seen[tp] = struct{}{}
		pts = append(pts, tp)
	}

	m.outline = pts
}

// rawToGrid converts raw X/Y to (col, row) in a canvas of gridW×gridH.
// Terminal characters are roughly 2× taller than wide, so we compress the
// X dimension by a factor of 0.5 to preserve the circuit's visual aspect ratio.
func (m *TrackMapModel) rawToGrid(x, y float64, gridW, gridH int) trackPoint {
	rangeX := m.rawMaxX - m.rawMinX
	rangeY := m.rawMaxY - m.rawMinY
	if rangeX == 0 {
		rangeX = 1
	}
	if rangeY == 0 {
		rangeY = 1
	}

	// Apply 0.5× X compression for terminal aspect ratio
	normX := (x - m.rawMinX) / rangeX
	normY := (y - m.rawMinY) / rangeY

	col := int(normX * float64(gridW-1) * 0.5)     // compress horizontal
	row := gridH - 1 - int(normY*float64(gridH-1)) // flip Y (screen rows go down)
	return trackPoint{col: clampInt(col, 0, gridW-1), row: clampInt(row, 0, gridH-1)}
}

// rawToCanvas converts raw X/Y to (col, row) for the actual render canvas size.
func (m *TrackMapModel) rawToCanvas(x, y float64, canvasW, canvasH int) trackPoint {
	rangeX := m.rawMaxX - m.rawMinX
	rangeY := m.rawMaxY - m.rawMinY
	if rangeX == 0 {
		rangeX = 1
	}
	if rangeY == 0 {
		rangeY = 1
	}

	normX := (x - m.rawMinX) / rangeX
	normY := (y - m.rawMinY) / rangeY

	// Margins
	marginH := 2
	marginV := 1
	drawW := canvasW - marginH*2
	drawH := canvasH - marginV*2

	col := marginH + int(normX*float64(drawW-1)*0.5)
	row := marginV + (drawH - 1 - int(normY*float64(drawH-1)))
	return trackPoint{
		col: clampInt(col, marginH, marginH+drawW-1),
		row: clampInt(row, marginV, marginV+drawH-1),
	}
}

// ---------------------------------------------------------------------------
// Map renderer
// ---------------------------------------------------------------------------

func (m TrackMapModel) renderMap() string {
	w := m.width
	if w < 40 {
		w = 40
	}
	h := m.height
	if h < 20 {
		h = 20
	}

	// Reserve space for header (3 lines) + help bar (1 line)
	const headerLines = 4
	canvasW := min(w-2, 80) // cap width for readability
	canvasH := h - headerLines - 2
	if canvasH < 10 {
		canvasH = 10
	}

	// Allocate canvas grid
	grid := make([][]rune, canvasH)
	colorGrid := make([][]string, canvasH)
	for r := range grid {
		grid[r] = make([]rune, canvasW)
		colorGrid[r] = make([]string, canvasW)
		for c := range grid[r] {
			grid[r][c] = ' '
		}
	}

	// Draw track outline using '·' dots
	for _, loc := range m.outline {
		// Re-normalize outline points from the 60×22 grid to the canvas
		// by converting back through raw fraction space.
		normCol := float64(loc.col) / (30.0) // gridW/2 for the 0.5 compression
		normRow := float64(22-1-loc.row) / float64(22-1)

		rawX := m.rawMinX + normCol*(m.rawMaxX-m.rawMinX)
		rawY := m.rawMinY + normRow*(m.rawMaxY-m.rawMinY)

		tp := m.rawToCanvas(rawX, rawY, canvasW, canvasH)
		if tp.row >= 0 && tp.row < canvasH && tp.col >= 0 && tp.col < canvasW {
			if grid[tp.row][tp.col] == ' ' {
				grid[tp.row][tp.col] = '·'
				colorGrid[tp.row][tp.col] = colorSurface2
			}
		}
	}

	// Place car markers
	type carPlacement struct {
		tp    trackPoint
		dn    int
		color string
		tla   string
	}
	var placements []carPlacement

	// Sort driver numbers for deterministic overdraw
	var dnums []int
	for dn := range m.carPositions {
		dnums = append(dnums, dn)
	}
	sort.Ints(dnums)

	for _, dn := range dnums {
		loc := m.carPositions[dn]
		tp := m.rawToCanvas(loc.X, loc.Y, canvasW, canvasH)

		numStr := fmt.Sprintf("%d", dn)
		teamColor := colorMuted
		tla := numStr

		if info, ok := m.driverInfo[numStr]; ok {
			if info.Tla != "" {
				tla = info.Tla
			}
			if info.TeamColour != "" {
				teamColor = "#" + info.TeamColour
			} else if info.TeamName != "" {
				teamColor = teamColorFromName(info.TeamName)
			}
		}

		placements = append(placements, carPlacement{tp, dn, teamColor, tla})
	}

	// Draw car glyphs — use '●' at the car's point, then try to fit TLA inline
	for _, cp := range placements {
		r, c := cp.tp.row, cp.tp.col
		if r < 0 || r >= canvasH || c < 0 || c >= canvasW {
			continue
		}
		grid[r][c] = '●'
		colorGrid[r][c] = cp.color
		// Write TLA to the right of the marker if space allows
		for i, ch := range cp.tla {
			nc := c + 1 + i
			if nc >= canvasW {
				break
			}
			grid[r][nc] = ch
			colorGrid[r][nc] = cp.color
		}
	}

	// Render grid to string
	var sb strings.Builder

	// Header
	title := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorF1Red)).Render("🗺  TRACK MAP")
	driverCount := fmt.Sprintf("%d cars tracked", len(m.carPositions))
	if len(m.carPositions) == 0 {
		driverCount = "waiting for car positions..."
	}
	sb.WriteString("\n  " + title + "  " + styleMuted.Render(driverCount) + "\n")
	sb.WriteString("  " + divider(min(w-4, canvasW)) + "\n")

	// Canvas border top
	borderStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(colorBorder))
	sb.WriteString("  " + borderStyle.Render("╭"+strings.Repeat("─", canvasW)+"╮") + "\n")

	for r := 0; r < canvasH; r++ {
		sb.WriteString("  " + borderStyle.Render("│"))
		for c := 0; c < canvasW; c++ {
			ch := grid[r][c]
			color := colorGrid[r][c]
			if color != "" {
				sb.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(color)).Render(string(ch)))
			} else {
				sb.WriteRune(ch)
			}
		}
		sb.WriteString(borderStyle.Render("│") + "\n")
	}

	sb.WriteString("  " + borderStyle.Render("╰"+strings.Repeat("─", canvasW)+"╯") + "\n")
	sb.WriteString("\n")
	sb.WriteString(helpBar("1-7 tabs", "q quit"))

	return sb.String()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// distanceSq returns the squared Euclidean distance between two points.
func distanceSq(x1, y1, x2, y2 float64) float64 {
	dx, dy := x2-x1, y2-y1
	return dx*dx + dy*dy
}

// nearestOutlinePoint finds the outline point closest to (x, y) in raw space.
// Returns math.MaxFloat64 if outline is empty.
func (m *TrackMapModel) nearestOutlineDistance(x, y float64) float64 {
	if len(m.outline) == 0 {
		return math.MaxFloat64
	}
	minDist := math.MaxFloat64
	rangeX := m.rawMaxX - m.rawMinX
	rangeY := m.rawMaxY - m.rawMinY
	if rangeX == 0 {
		rangeX = 1
	}
	if rangeY == 0 {
		rangeY = 1
	}
	// Convert outline back to raw for distance calculation
	for _, tp := range m.outline {
		nx := float64(tp.col) / 30.0
		ny := float64(22-1-tp.row) / float64(22-1)
		rx := m.rawMinX + nx*rangeX
		ry := m.rawMinY + ny*rangeY
		d := distanceSq(x, y, rx, ry)
		if d < minDist {
			minDist = d
		}
	}
	return math.Sqrt(minDist)
}
