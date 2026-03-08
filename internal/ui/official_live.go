package ui

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/gorilla/websocket"
)

type F1SignalRMessage struct {
	M []struct {
		A []json.RawMessage `json:"A"`
	} `json:"M"`
	R json.RawMessage `json:"R"`
}

type F1TimingLine struct {
	GapToLeader             interface{} `json:"GapToLeader"`
	IntervalToPositionAhead struct {
		Value interface{} `json:"Value"`
	} `json:"IntervalToPositionAhead"`
	Position     string `json:"Position"`
	RacingNumber string `json:"RacingNumber"`
}

type F1DriverListEntry struct {
	RacingNumber string `json:"RacingNumber"`
	BroadcastName string `json:"BroadcastName"`
	Tla          string `json:"Tla"`
	TeamName     string `json:"TeamName"`
	TeamColour   string `json:"TeamColour"`
	FirstName    string `json:"FirstName"`
	LastName     string `json:"LastName"`
}

type LiveStreamData struct {
	Drivers    map[string]LiveDriverData
	DriverInfo map[string]F1DriverListEntry
}

type LiveDriverData struct {
	RacingNumber string
	Position     int
	GapToLeader  string
	Interval     string
}

func ConnectToF1LiveTiming(dataChan chan LiveStreamData) error {
	hubName := `[{"name":"Streaming"}]`
	negotiateURL := fmt.Sprintf("https://livetiming.formula1.com/signalr/negotiate?clientProtocol=1.5&connectionData=%s", url.QueryEscape(hubName))

	req, err := http.NewRequest("GET", negotiateURL, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}

	cookies := resp.Cookies()
	defer resp.Body.Close()

	var neg struct {
		ConnectionToken string `json:"ConnectionToken"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&neg); err != nil {
		return err
	}

	wsURL := fmt.Sprintf("wss://livetiming.formula1.com/signalr/connect?clientProtocol=1.5&transport=webSockets&connectionToken=%s&connectionData=%s",
		url.QueryEscape(neg.ConnectionToken),
		url.QueryEscape(hubName),
	)

	header := http.Header{}
	for _, cookie := range cookies {
		header.Add("Cookie", cookie.String())
	}
	header.Add("User-Agent", "BestHTTP")

	c, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		return err
	}

	subscribeMsg := []byte(`{"H":"Streaming","M":"Subscribe","A":[["Heartbeat","TimingData","DriverList"]],"I":1}`)
	err = c.WriteMessage(websocket.TextMessage, subscribeMsg)
	if err != nil {
		return err
	}

	go func() {
		defer c.Close()
		drivers := make(map[string]LiveDriverData)
		driverInfo := make(map[string]F1DriverListEntry)

		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("WS Read Error:", err)
				return
			}

			var parsed F1SignalRMessage
			if err := json.Unmarshal(message, &parsed); err != nil {
				continue
			}

			updated := false

			// Check full state payload (R)
			if len(parsed.R) > 2 {
				var rMap map[string]json.RawMessage
				if err := json.Unmarshal(parsed.R, &rMap); err == nil {
					if tdRaw, ok := rMap["TimingData"]; ok {
						var td struct {
							Lines map[string]json.RawMessage `json:"Lines"`
						}
						if json.Unmarshal(tdRaw, &td) == nil {
							for num, lineRaw := range td.Lines {
								var line F1TimingLine
								if json.Unmarshal(lineRaw, &line) == nil {
									updateDriver(drivers, num, line)
									updated = true
								}
							}
						}
					}
					if dlRaw, ok := rMap["DriverList"]; ok {
						var dlMap map[string]json.RawMessage
						if json.Unmarshal(dlRaw, &dlMap) == nil {
							for num, entryRaw := range dlMap {
								var entry F1DriverListEntry
								if json.Unmarshal(entryRaw, &entry) == nil && entry.Tla != "" {
									driverInfo[num] = entry
									updated = true
								}
							}
						}
					}
				}
			}

			// Check incremental feed (M)
			for _, m := range parsed.M {
				if len(m.A) > 1 {
					var topic string
					json.Unmarshal(m.A[0], &topic)
					switch topic {
					case "TimingData":
						var td struct {
							Lines map[string]json.RawMessage `json:"Lines"`
						}
						if err := json.Unmarshal(m.A[1], &td); err == nil {
							for num, lineRaw := range td.Lines {
								var line F1TimingLine
								if json.Unmarshal(lineRaw, &line) == nil {
									updateDriver(drivers, num, line)
									updated = true
								}
							}
						}
					case "DriverList":
						var dlMap map[string]json.RawMessage
						if err := json.Unmarshal(m.A[1], &dlMap); err == nil {
							for num, entryRaw := range dlMap {
								var entry F1DriverListEntry
								if json.Unmarshal(entryRaw, &entry) == nil && entry.Tla != "" {
									driverInfo[num] = entry
									updated = true
								}
							}
						}
					}
				}
			}

			if updated {
				// Send copies to avoid race conditions
				cpyDrivers := make(map[string]LiveDriverData)
				for k, v := range drivers {
					cpyDrivers[k] = v
				}
				cpyInfo := make(map[string]F1DriverListEntry)
				for k, v := range driverInfo {
					cpyInfo[k] = v
				}
				select {
				case dataChan <- LiveStreamData{Drivers: cpyDrivers, DriverInfo: cpyInfo}:
				default:
				}
			}
		}
	}()

	return nil
}

func updateDriver(drivers map[string]LiveDriverData, num string, line F1TimingLine) {
	d, exists := drivers[num]
	if !exists {
		d = LiveDriverData{RacingNumber: num}
		if line.RacingNumber != "" {
			d.RacingNumber = line.RacingNumber
		}
	}

	if line.Position != "" {
		fmt.Sscanf(line.Position, "%d", &d.Position)
	}
	if line.GapToLeader != nil {
		d.GapToLeader = fmt.Sprintf("%v", line.GapToLeader)
	}
	if line.IntervalToPositionAhead.Value != nil {
		d.Interval = fmt.Sprintf("%v", line.IntervalToPositionAhead.Value)
	}

	drivers[num] = d
}

// ----------------------------------------------------------------------------
// Model wrapper
// ----------------------------------------------------------------------------

type wsDataMsg LiveStreamData

func listenForWSData(sub chan LiveStreamData) tea.Cmd {
	return func() tea.Msg {
		return wsDataMsg(<-sub)
	}
}

func parseGap(val string) string {
	if val == "" {
		return ""
	}
	return val
}

type OfficialLiveModel struct {
	width      int
	height     int
	dataChan   chan LiveStreamData
	drivers    map[string]LiveDriverData
	driverInfo map[string]F1DriverListEntry
	err        error
}

func NewOfficialLiveModel() OfficialLiveModel {
	return OfficialLiveModel{
		dataChan:   make(chan LiveStreamData, 10),
		drivers:    make(map[string]LiveDriverData),
		driverInfo: make(map[string]F1DriverListEntry),
	}
}

func (m OfficialLiveModel) Init() tea.Cmd {
	err := ConnectToF1LiveTiming(m.dataChan)
	if err != nil {
		return func() tea.Msg { return err }
	}
	return listenForWSData(m.dataChan)
}

func (m OfficialLiveModel) Update(msg tea.Msg) (OfficialLiveModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil
	case error:
		m.err = msg
		return m, nil
	case wsDataMsg:
		m.drivers = msg.Drivers
		m.driverInfo = msg.DriverInfo
		return m, listenForWSData(m.dataChan)
	}
	return m, nil
}

func (m OfficialLiveModel) View() string {
	if m.err != nil {
		return fmt.Sprintf("\n  Error connecting to F1 live stream: %v", m.err)
	}
	if len(m.drivers) == 0 {
		return "\n  Connecting to Official F1 Live Timing Stream...\n"
	}

	var sb strings.Builder
	titleStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(colorF1Red)).Bold(true)
	sb.WriteString("\n  " + titleStyle.Render("LIVE TIMING") + "\n\n")

	var drivers []LiveDriverData
	for _, d := range m.drivers {
		if d.Position > 0 {
			drivers = append(drivers, d)
		}
	}

	sort.Slice(drivers, func(i, j int) bool {
		return drivers[i].Position < drivers[j].Position
	})

	// Header
	headerStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted))
	sb.WriteString(headerStyle.Render(fmt.Sprintf("  %-4s  %-4s %-4s %-16s %-12s %-12s", "POS", "NO", "TLA", "DRIVER", "GAP", "INT")) + "\n")
	sb.WriteString("  " + strings.Repeat("─", 58) + "\n")

	for _, d := range drivers {
		gap := parseGap(d.GapToLeader)
		intv := parseGap(d.Interval)
		if d.Position == 1 {
			gap = "LEADER"
			intv = ""
		}

		// Look up driver info
		info, hasInfo := m.driverInfo[d.RacingNumber]
		tla := d.RacingNumber
		name := ""
		teamColor := colorMuted
		if hasInfo {
			tla = info.Tla
			name = info.BroadcastName
			if info.TeamColour != "" {
				teamColor = "#" + info.TeamColour
			} else {
				teamColor = teamColorFromName(info.TeamName)
			}
		}

		colorBar := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")
		posStr := fmt.Sprintf("%-4d", d.Position)
		noStr := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Bold(true).Render(fmt.Sprintf("%-4s", d.RacingNumber))
		tlaStr := lipgloss.NewStyle().Bold(true).Render(fmt.Sprintf("%-4s", tla))

		nameStr := styleMuted.Render(fmt.Sprintf("%-16s", name))
		gapStr := fmt.Sprintf("%-12s", gap)
		intvStr := fmt.Sprintf("%-12s", intv)

		sb.WriteString(fmt.Sprintf("  %s %s %s %s %s %s %s\n", colorBar, posStr, noStr, tlaStr, nameStr, gapStr, intvStr))
	}

	sb.WriteString("\n" + helpBar("1-6 tabs", "q quit"))
	return sb.String()
}
