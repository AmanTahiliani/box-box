package ui

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/gorilla/websocket"
)

// ---------------------------------------------------------------------------
// SignalR protocol types
// ---------------------------------------------------------------------------

type F1SignalRMessage struct {
	M []struct {
		A []json.RawMessage `json:"A"`
	} `json:"M"`
	R json.RawMessage `json:"R"`
}

// ---------------------------------------------------------------------------
// Data types from the WebSocket feed
// ---------------------------------------------------------------------------

type F1TimingLine struct {
	GapToLeader             interface{} `json:"GapToLeader"`
	IntervalToPositionAhead struct {
		Value interface{} `json:"Value"`
	} `json:"IntervalToPositionAhead"`
	Position     interface{} `json:"Position"`
	RacingNumber string     `json:"RacingNumber"`
	LastLapTime  struct {
		Value           string `json:"Value"`
		PersonalFastest bool   `json:"PersonalFastest"`
		OverallFastest  bool   `json:"OverallFastest"`
	} `json:"LastLapTime"`
	BestLapTime struct {
		Value           string `json:"Value"`
		PersonalFastest bool   `json:"PersonalFastest"`
		OverallFastest  bool   `json:"OverallFastest"`
		Lap             int    `json:"Lap"`
	} `json:"BestLapTime"`
	InPit        interface{}                `json:"InPit"`
	PitOut       interface{}                `json:"PitOut"`
	Retired      interface{}                `json:"Retired"`
	KnockedOut   interface{}                `json:"KnockedOut"`
	Cutoff       interface{}                `json:"Cutoff"`
	NumberOfLaps interface{}                `json:"NumberOfLaps"`
	Sectors      map[string]json.RawMessage `json:"Sectors"`
	Speeds       map[string]json.RawMessage `json:"Speeds"`
}

type F1DriverListEntry struct {
	RacingNumber  string `json:"RacingNumber"`
	BroadcastName string `json:"BroadcastName"`
	Tla           string `json:"Tla"`
	TeamName      string `json:"TeamName"`
	TeamColour    string `json:"TeamColour"`
	FirstName     string `json:"FirstName"`
	LastName      string `json:"LastName"`
}

type LiveTyreData struct {
	Compound string // SOFT, MEDIUM, HARD, INTERMEDIATE, WET
	New      bool
	Age      int // laps on current set
}

type LiveRCMessage struct {
	Time     string // "15:04" formatted
	Category string // Flag, SafetyCar, Drs, Other
	Flag     string // GREEN, YELLOW, RED, etc.
	Message  string
	Lap      int
}

type LiveWeatherData struct {
	AirTemp   float64
	TrackTemp float64
	Humidity  float64
	WindSpeed float64
	WindDir   int
	Rainfall  bool
}

type LiveSessionMeta struct {
	MeetingName string
	CircuitName string
	SessionType string
	SessionName string
}

type LiveSectorData struct {
	Value           string
	PersonalFastest bool
	OverallFastest  bool
}

type LiveDriverData struct {
	RacingNumber string
	Position     int
	PrevPosition int
	GapToLeader  string
	Interval     string
	LastLapTime  string
	LastLapPB    bool // personal best
	LastLapOB    bool // overall best
	BestLapTime  string
	BestLapPB    bool // just set a new personal best
	BestLapOB    bool // overall fastest in session
	BestLapNum   int  // lap number when best was set
	InPit        bool
	PitOut       bool
	Retired      bool
	KnockedOut   bool // eliminated in qualifying
	Cutoff       bool // currently in elimination zone (danger zone)
	OnFlyingLap  bool // currently running a timed lap (derived from sector state)
	NumberOfLaps int
	SpeedTrap    string // fastest recorded speed at speed trap
	Sectors      [3]LiveSectorData
}

type LiveStintData struct {
	Compound string
	New      bool
	Laps     int
}

type LiveStreamData struct {
	Drivers            map[string]LiveDriverData
	DriverInfo         map[string]F1DriverListEntry
	Tyres              map[string]LiveTyreData
	RCMessages         []LiveRCMessage
	Weather            LiveWeatherData
	Session            LiveSessionMeta
	TrackStatus        string // "1"=green "2"=yellow "4"=SC "5"=red "6"=VSC
	CurrentLap         int
	TotalLaps          int
	Clock              string    // "HH:MM:SS" remaining at ClockRefTime
	ClockRefTime       time.Time // UTC when Clock was accurate
	ClockExtrapolating bool      // true = actively counting down
	Stints             map[string][]LiveStintData
}

// ---------------------------------------------------------------------------
// WebSocket connection & parsing
// ---------------------------------------------------------------------------

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

	// Subscribe to all desired topics
	subscribeMsg := []byte(`{"H":"Streaming","M":"Subscribe","A":[["Heartbeat","TimingData","DriverList","LapCount","ExtrapolatedClock","TrackStatus","RaceControlMessages","WeatherData","SessionInfo","CurrentTyres","TimingAppData","TimingStats"]],"I":1}`)
	err = c.WriteMessage(websocket.TextMessage, subscribeMsg)
	if err != nil {
		return err
	}

	go func() {
		defer c.Close()
		drivers := make(map[string]LiveDriverData)
		driverInfo := make(map[string]F1DriverListEntry)
		tyres := make(map[string]LiveTyreData)
		stints := make(map[string][]LiveStintData)
		var rcMessages []LiveRCMessage
		var weather LiveWeatherData
		var session LiveSessionMeta
		var trackStatus string
		var currentLap, totalLaps int
		var clock string
		var clockRefTime time.Time
		var clockExtrapolating bool

		sendUpdate := func() {
			cpyDrivers := make(map[string]LiveDriverData)
			for k, v := range drivers {
				cpyDrivers[k] = v
			}
			cpyInfo := make(map[string]F1DriverListEntry)
			for k, v := range driverInfo {
				cpyInfo[k] = v
			}
			cpyTyres := make(map[string]LiveTyreData)
			for k, v := range tyres {
				cpyTyres[k] = v
			}
			cpyRC := make([]LiveRCMessage, len(rcMessages))
			copy(cpyRC, rcMessages)
			cpyStints := make(map[string][]LiveStintData)
			for k, v := range stints {
				s := make([]LiveStintData, len(v))
				copy(s, v)
				cpyStints[k] = s
			}

			select {
			case dataChan <- LiveStreamData{
				Drivers:            cpyDrivers,
				DriverInfo:         cpyInfo,
				Tyres:              cpyTyres,
				RCMessages:         cpyRC,
				Weather:            weather,
				Session:            session,
				TrackStatus:        trackStatus,
				CurrentLap:         currentLap,
				TotalLaps:          totalLaps,
				Clock:              clock,
				ClockRefTime:       clockRefTime,
				ClockExtrapolating: clockExtrapolating,
				Stints:             cpyStints,
			}:
			default:
			}
		}

		// processTopic handles a single topic's JSON payload (shared by R and M paths)
		processTopic := func(topic string, data json.RawMessage) bool {
			updated := false
			switch topic {
			case "TimingData":
				var td struct {
					Lines map[string]json.RawMessage `json:"Lines"`
				}
				if json.Unmarshal(data, &td) == nil {
					for num, lineRaw := range td.Lines {
						// Debug: dump first driver's raw JSON to see field types
						if num == "1" || num == "81" || num == "44" {
							log.Printf("[DEBUG TimingData] driver=%s raw=%s", num, string(lineRaw))
						}
						var line F1TimingLine
						if json.Unmarshal(lineRaw, &line) == nil {
							updateDriver(drivers, num, line)
							updated = true
						}
					}
				}
			case "DriverList":
				var dlMap map[string]json.RawMessage
				if json.Unmarshal(data, &dlMap) == nil {
					for num, entryRaw := range dlMap {
						var entry F1DriverListEntry
						if json.Unmarshal(entryRaw, &entry) == nil && entry.Tla != "" {
							driverInfo[num] = entry
							updated = true
						}
					}
				}
			case "LapCount":
				var lc struct {
					CurrentLap json.Number `json:"CurrentLap"`
					TotalLaps  json.Number `json:"TotalLaps"`
				}
				if json.Unmarshal(data, &lc) == nil {
					if v, err := lc.CurrentLap.Int64(); err == nil {
						currentLap = int(v)
					}
					if v, err := lc.TotalLaps.Int64(); err == nil {
						totalLaps = int(v)
					}
					updated = true
				}
			case "ExtrapolatedClock":
				var ec struct {
					Remaining    string `json:"Remaining"`
					Utc          string `json:"Utc"`
					Extrapolating bool   `json:"Extrapolating"`
				}
				if json.Unmarshal(data, &ec) == nil && ec.Remaining != "" {
					clock = ec.Remaining
					clockExtrapolating = ec.Extrapolating
					if ec.Utc != "" {
						// Try RFC3339 first, then with milliseconds
						if t, err := time.Parse(time.RFC3339, ec.Utc); err == nil {
							clockRefTime = t
						} else if t, err := time.Parse("2006-01-02T15:04:05.999Z", ec.Utc); err == nil {
							clockRefTime = t
						} else {
							clockRefTime = time.Now()
						}
					} else {
						clockRefTime = time.Now()
					}
					updated = true
				}
			case "TrackStatus":
				var ts struct {
					Status  string `json:"Status"`
					Message string `json:"Message"`
				}
				if json.Unmarshal(data, &ts) == nil && ts.Status != "" {
					trackStatus = ts.Status
					updated = true
				}
			case "RaceControlMessages":
				var rcm struct {
					Messages map[string]json.RawMessage `json:"Messages"`
				}
				if json.Unmarshal(data, &rcm) == nil {
					for _, msgRaw := range rcm.Messages {
						var msg struct {
							Utc      string `json:"Utc"`
							Category string `json:"Category"`
							Flag     string `json:"Flag"`
							Message  string `json:"Message"`
							Lap      int    `json:"Lap"`
						}
						if json.Unmarshal(msgRaw, &msg) == nil && msg.Message != "" {
							t := ""
							if len(msg.Utc) >= 19 {
								t = msg.Utc[11:16]
							}
							rcMessages = append(rcMessages, LiveRCMessage{
								Time:     t,
								Category: msg.Category,
								Flag:     msg.Flag,
								Message:  msg.Message,
								Lap:      msg.Lap,
							})
							updated = true
						}
					}
				}
			case "WeatherData":
				var wd struct {
					AirTemp       json.Number `json:"AirTemp"`
					TrackTemp     json.Number `json:"TrackTemp"`
					Humidity      json.Number `json:"Humidity"`
					WindSpeed     json.Number `json:"WindSpeed"`
					WindDirection json.Number `json:"WindDirection"`
					Rainfall      json.Number `json:"Rainfall"`
				}
				if json.Unmarshal(data, &wd) == nil {
					if v, err := wd.AirTemp.Float64(); err == nil {
						weather.AirTemp = v
					}
					if v, err := wd.TrackTemp.Float64(); err == nil {
						weather.TrackTemp = v
					}
					if v, err := wd.Humidity.Float64(); err == nil {
						weather.Humidity = v
					}
					if v, err := wd.WindSpeed.Float64(); err == nil {
						weather.WindSpeed = v
					}
					if v, err := wd.WindDirection.Int64(); err == nil {
						weather.WindDir = int(v)
					}
					if v, err := wd.Rainfall.Float64(); err == nil {
						weather.Rainfall = v > 0
					}
					updated = true
				}
			case "SessionInfo":
				var si struct {
					Meeting struct {
						Name string `json:"Name"`
					} `json:"Meeting"`
					Name string `json:"Name"`
					Type string `json:"Type"`
				}
				if json.Unmarshal(data, &si) == nil {
					if si.Meeting.Name != "" {
						session.MeetingName = si.Meeting.Name
					}
					if si.Name != "" {
						session.SessionName = si.Name
					}
					if si.Type != "" {
						session.SessionType = si.Type
					}
					updated = true
				}
			case "CurrentTyres":
				var ct map[string]json.RawMessage
				if json.Unmarshal(data, &ct) == nil {
					for num, raw := range ct {
						if num == "_kf" {
							continue
						}
						var td struct {
							Compound string `json:"Compound"`
							New      string `json:"New"`
						}
						if json.Unmarshal(raw, &td) == nil && td.Compound != "" {
							tyres[num] = LiveTyreData{
								Compound: td.Compound,
								New:      td.New == "true" || td.New == "True",
							}
							updated = true
						}
					}
				}
			case "TimingAppData":
				var tad struct {
					Lines map[string]json.RawMessage `json:"Lines"`
				}
				if json.Unmarshal(data, &tad) == nil {
					for num, lineRaw := range tad.Lines {
						var line struct {
							Stints map[string]json.RawMessage `json:"Stints"`
						}
						if json.Unmarshal(lineRaw, &line) == nil && line.Stints != nil {
							var driverStints []LiveStintData
							for _, sRaw := range line.Stints {
								var st struct {
									Compound  string `json:"Compound"`
									New       string `json:"New"`
									TotalLaps int    `json:"TotalLaps"`
								}
								if json.Unmarshal(sRaw, &st) == nil && st.Compound != "" {
									driverStints = append(driverStints, LiveStintData{
										Compound: st.Compound,
										New:      st.New == "true" || st.New == "True",
										Laps:     st.TotalLaps,
									})
								}
							}
							if len(driverStints) > 0 {
								stints[num] = driverStints
								// Always sync tyre from latest stint
								lastStint := driverStints[len(driverStints)-1]
								t := tyres[num]
								t.Age = lastStint.Laps
								if t.Compound == "" && lastStint.Compound != "" {
									t.Compound = lastStint.Compound
									t.New = lastStint.New
								}
								tyres[num] = t
								updated = true
							}
						}
					}
				}
			case "TimingStats":
				var ts struct {
					Lines map[string]json.RawMessage `json:"Lines"`
				}
				if json.Unmarshal(data, &ts) == nil {
					for num, lineRaw := range ts.Lines {
						var line struct {
							PersonalBestLapTime struct {
								Value string `json:"Value"`
							} `json:"PersonalBestLapTime"`
						}
						if json.Unmarshal(lineRaw, &line) == nil {
							if d, ok := drivers[num]; ok && line.PersonalBestLapTime.Value != "" {
								d.BestLapTime = line.PersonalBestLapTime.Value
								drivers[num] = d
								updated = true
							}
						}
					}
				}
			}
			return updated
		}

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

			// Full state payload (R)
			if len(parsed.R) > 2 {
				var rMap map[string]json.RawMessage
				if err := json.Unmarshal(parsed.R, &rMap); err == nil {
					for topic, data := range rMap {
						if processTopic(topic, data) {
							updated = true
						}
					}
				}
			}

			// Incremental feed (M)
			for _, m := range parsed.M {
				if len(m.A) > 1 {
					var topic string
					json.Unmarshal(m.A[0], &topic)
					if processTopic(topic, m.A[1]) {
						updated = true
					}
				}
			}

			if updated {
				sendUpdate()
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

	if line.Position != nil {
		var newPos int
		switch v := line.Position.(type) {
		case string:
			fmt.Sscanf(v, "%d", &newPos)
		case float64:
			newPos = int(v)
		}
		if newPos > 0 && newPos != d.Position {
			d.PrevPosition = d.Position
			d.Position = newPos
		}
	}
	if line.GapToLeader != nil {
		if s := extractStringVal(line.GapToLeader); s != "" {
			d.GapToLeader = s
		}
	}
	if line.IntervalToPositionAhead.Value != nil {
		if s := extractStringVal(line.IntervalToPositionAhead.Value); s != "" {
			d.Interval = s
		}
	}
	if line.LastLapTime.Value != "" {
		d.LastLapTime = line.LastLapTime.Value
		d.LastLapPB = line.LastLapTime.PersonalFastest
		d.LastLapOB = line.LastLapTime.OverallFastest
	}
	if line.BestLapTime.Value != "" {
		d.BestLapTime = line.BestLapTime.Value
		d.BestLapPB = line.BestLapTime.PersonalFastest
		d.BestLapOB = line.BestLapTime.OverallFastest
		if line.BestLapTime.Lap > 0 {
			d.BestLapNum = line.BestLapTime.Lap
		}
	}
	if line.InPit != nil {
		d.InPit = toBool(line.InPit)
	}
	if line.PitOut != nil {
		d.PitOut = toBool(line.PitOut)
	}
	if line.Retired != nil {
		d.Retired = toBool(line.Retired)
	}
	if line.KnockedOut != nil {
		d.KnockedOut = toBool(line.KnockedOut)
	}
	if line.Cutoff != nil {
		d.Cutoff = toBool(line.Cutoff)
	}
	if line.NumberOfLaps != nil {
		if v, ok := toInt(line.NumberOfLaps); ok {
			d.NumberOfLaps = v
		}
	}

	// Parse speed trap (ST = highest speed on track)
	if st, ok := line.Speeds["ST"]; ok {
		var sp struct {
			Value string `json:"Value"`
		}
		if json.Unmarshal(st, &sp) == nil && sp.Value != "" {
			d.SpeedTrap = sp.Value
		}
	}

	// Parse sector times — handle empty Value as a sector clear (new lap starting)
	for idx, sRaw := range line.Sectors {
		i := 0
		fmt.Sscanf(idx, "%d", &i)
		if i >= 0 && i < 3 {
			var sec struct {
				Value           string `json:"Value"`
				PersonalFastest bool   `json:"PersonalFastest"`
				OverallFastest  bool   `json:"OverallFastest"`
			}
			if json.Unmarshal(sRaw, &sec) == nil {
				if sec.Value == "" {
					d.Sectors[i] = LiveSectorData{} // clear = new lap starting
				} else {
					d.Sectors[i] = LiveSectorData{
						Value:           sec.Value,
						PersonalFastest: sec.PersonalFastest,
						OverallFastest:  sec.OverallFastest,
					}
				}
			}
		}
	}

	// Derive: driver is on a flying lap if S1 or S2 populated but S3 not yet
	d.OnFlyingLap = !d.InPit && !d.Retired &&
		(d.Sectors[0].Value != "" || d.Sectors[1].Value != "") &&
		d.Sectors[2].Value == ""

	drivers[num] = d
}

// extractStringVal extracts a string from a timing value that may arrive as a
// plain string, a float64, or a {"Value": "..."} object from the SignalR feed.
func extractStringVal(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case float64:
		if val == 0 {
			return ""
		}
		return fmt.Sprintf("+%.3f", val)
	case map[string]interface{}:
		if s, ok := val["Value"].(string); ok {
			return s
		}
	}
	return ""
}

func toBool(v interface{}) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val == "true" || val == "True"
	}
	return false
}

func toInt(v interface{}) (int, bool) {
	switch val := v.(type) {
	case float64:
		return int(val), true
	case json.Number:
		if i, err := val.Int64(); err == nil {
			return int(i), true
		}
	case string:
		var i int
		if _, err := fmt.Sscanf(val, "%d", &i); err == nil {
			return i, true
		}
	}
	return 0, false
}

// ---------------------------------------------------------------------------
// Model wrapper
// ---------------------------------------------------------------------------

type wsDataMsg LiveStreamData

func listenForWSData(sub chan LiveStreamData) tea.Cmd {
	return func() tea.Msg {
		return wsDataMsg(<-sub)
	}
}

type clockTickMsg time.Time

func clockTick() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return clockTickMsg(t)
	})
}

func parseGap(val string) string {
	return val
}

// compoundAbbrevStyle returns the single-letter abbreviation and lipgloss style for a tyre compound string.
func compoundAbbrevStyle(compound string) (string, lipgloss.Style) {
	switch {
	case strings.Contains(compound, "SOFT") || compound == "C4" || compound == "C5":
		return "S", lipgloss.NewStyle().Foreground(lipgloss.Color(colorSoft)).Bold(true)
	case strings.Contains(compound, "MEDIUM") || compound == "C3":
		return "M", lipgloss.NewStyle().Foreground(lipgloss.Color(colorMedium)).Bold(true)
	case strings.Contains(compound, "HARD") || compound == "C1" || compound == "C2":
		return "H", lipgloss.NewStyle().Foreground(lipgloss.Color(colorHard)).Bold(true)
	case strings.Contains(compound, "INTER"):
		return "I", lipgloss.NewStyle().Foreground(lipgloss.Color(colorInter)).Bold(true)
	case strings.Contains(compound, "WET"):
		return "W", lipgloss.NewStyle().Foreground(lipgloss.Color(colorWet)).Bold(true)
	default:
		abbrev := "?"
		if compound != "" {
			abbrev = string([]rune(compound)[0])
		}
		return abbrev, styleMuted
	}
}

// parseHHMMSS parses "H:MM:SS" or "HH:MM:SS" into a time.Duration.
func parseHHMMSS(s string) (time.Duration, error) {
	var h, m, sec int
	_, err := fmt.Sscanf(s, "%d:%d:%d", &h, &m, &sec)
	if err != nil {
		return 0, err
	}
	return time.Duration(h)*time.Hour + time.Duration(m)*time.Minute + time.Duration(sec)*time.Second, nil
}

type OfficialLiveModel struct {
	width  int
	height int

	dataChan    chan LiveStreamData
	drivers     map[string]LiveDriverData
	driverInfo  map[string]F1DriverListEntry
	tyres       map[string]LiveTyreData
	rcMessages  []LiveRCMessage
	weather     LiveWeatherData
	session     LiveSessionMeta
	trackStatus        string
	currentLap         int
	totalLaps          int
	clock              string
	clockRefTime       time.Time
	clockExtrapolating bool
	stints             map[string][]LiveStintData
	err                error

	// UI state
	cursor         int
	scroll         int
	showSectors    bool
	expandedDriver string // racing number, "" if none
	showRC         bool   // compact mode RC overlay toggle

	rcView  viewport.Model
	rcReady bool
}

func NewOfficialLiveModel() OfficialLiveModel {
	return OfficialLiveModel{
		dataChan:   make(chan LiveStreamData, 10),
		drivers:    make(map[string]LiveDriverData),
		driverInfo: make(map[string]F1DriverListEntry),
		tyres:      make(map[string]LiveTyreData),
		stints:     make(map[string][]LiveStintData),
	}
}

func (m OfficialLiveModel) Init() tea.Cmd {
	err := ConnectToF1LiveTiming(m.dataChan)
	if err != nil {
		return func() tea.Msg { return err }
	}
	return tea.Batch(listenForWSData(m.dataChan), clockTick())
}

// displayClock returns the session clock, counting down locally between feed updates.
func (m OfficialLiveModel) displayClock() string {
	if m.clock == "" {
		return ""
	}
	if !m.clockExtrapolating || m.clockRefTime.IsZero() {
		return m.clock
	}
	remaining, err := parseHHMMSS(m.clock)
	if err != nil {
		return m.clock
	}
	elapsed := time.Since(m.clockRefTime)
	actual := remaining - elapsed
	if actual < 0 {
		actual = 0
	}
	h := int(actual.Hours())
	mnt := int(actual.Minutes()) % 60
	sec := int(actual.Seconds()) % 60
	return fmt.Sprintf("%02d:%02d:%02d", h, mnt, sec)
}

func (m OfficialLiveModel) sortedDrivers() []LiveDriverData {
	// Merge timing data with driver list so all known drivers appear,
	// even those who have not set a lap time yet (Position == 0).
	merged := make(map[string]LiveDriverData, len(m.drivers)+len(m.driverInfo))
	for num, d := range m.drivers {
		merged[num] = d
	}
	for num := range m.driverInfo {
		if _, exists := merged[num]; !exists {
			merged[num] = LiveDriverData{RacingNumber: num}
		}
	}

	var positioned, unpositioned []LiveDriverData
	for _, d := range merged {
		if d.Position > 0 {
			positioned = append(positioned, d)
		} else {
			unpositioned = append(unpositioned, d)
		}
	}

	sort.Slice(positioned, func(i, j int) bool {
		return positioned[i].Position < positioned[j].Position
	})
	sort.Slice(unpositioned, func(i, j int) bool {
		var ni, nj int
		fmt.Sscanf(unpositioned[i].RacingNumber, "%d", &ni)
		fmt.Sscanf(unpositioned[j].RacingNumber, "%d", &nj)
		return ni < nj
	})

	return append(positioned, unpositioned...)
}

// isPracticeOrQuali returns true for Free Practice, Qualifying, and Sprint Qualifying.
// In these sessions the timing tower shows BEST lap time as the primary column.
func (m OfficialLiveModel) isPracticeOrQuali() bool {
	t := strings.ToLower(m.session.SessionType)
	return strings.Contains(t, "practice") ||
		strings.Contains(t, "qualifying") ||
		strings.Contains(t, "sprint") ||
		t == "fp1" || t == "fp2" || t == "fp3" ||
		t == "q" || t == "sq"
}

// overallBestLapTime returns the string of the overall fastest BestLapTime across all drivers.
// Uses lexicographic comparison which is valid for M:SS.mmm formatted times.
func (m OfficialLiveModel) overallBestLapTime() string {
	best := ""
	for _, d := range m.drivers {
		if d.BestLapTime == "" {
			continue
		}
		if best == "" || d.BestLapTime < best {
			best = d.BestLapTime
		}
	}
	return best
}

func (m OfficialLiveModel) visibleRows() int {
	rows := m.height - 8
	if m.trackStatus != "" && m.trackStatus != "1" {
		rows--
	}
	if rows < 5 {
		rows = 5
	}
	return rows
}

func (m *OfficialLiveModel) ensureVisible() {
	visible := m.visibleRows()
	if m.cursor < m.scroll {
		m.scroll = m.cursor
	}
	if m.cursor >= m.scroll+visible {
		m.scroll = m.cursor - visible + 1
	}
}

func (m *OfficialLiveModel) SetSize(w, h int) {
	m.width = w
	m.height = h

	if w >= 100 {
		rcWidth := int(float64(w)*0.4) - 4
		rcHeight := h - 12
		if rcHeight < 3 {
			rcHeight = 3
		}
		if !m.rcReady {
			m.rcView = viewport.New(rcWidth, rcHeight)
			m.rcReady = true
		} else {
			m.rcView.Width = rcWidth
			m.rcView.Height = rcHeight
		}
		m.updateRCViewport()
	}
}

func (m *OfficialLiveModel) updateRCViewport() {
	if !m.rcReady {
		return
	}
	m.rcView.SetContent(m.renderRCContent())
	m.rcView.GotoBottom()
}

func (m OfficialLiveModel) Update(msg tea.Msg) (OfficialLiveModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.SetSize(msg.Width, msg.Height)
		return m, nil
	case error:
		m.err = msg
		return m, nil
	case clockTickMsg:
		// Re-render every second so the local countdown stays smooth
		return m, clockTick()
	case wsDataMsg:
		m.drivers = msg.Drivers
		m.driverInfo = msg.DriverInfo
		m.tyres = msg.Tyres
		m.rcMessages = msg.RCMessages
		m.weather = msg.Weather
		m.session = msg.Session
		m.trackStatus = msg.TrackStatus
		m.currentLap = msg.CurrentLap
		m.totalLaps = msg.TotalLaps
		m.clock = msg.Clock
		m.clockRefTime = msg.ClockRefTime
		m.clockExtrapolating = msg.ClockExtrapolating
		m.stints = msg.Stints
		m.updateRCViewport()
		return m, listenForWSData(m.dataChan)
	case tea.KeyMsg:
		drivers := m.sortedDrivers()
		switch {
		case matchKey(msg, GlobalKeys.Up):
			if m.cursor > 0 {
				m.cursor--
				m.ensureVisible()
			}
		case matchKey(msg, GlobalKeys.Down):
			if m.cursor < len(drivers)-1 {
				m.cursor++
				m.ensureVisible()
			}
		case matchKey(msg, GlobalKeys.GoTop):
			m.cursor = 0
			m.scroll = 0
		case matchKey(msg, GlobalKeys.GoBottom):
			if len(drivers) > 0 {
				m.cursor = len(drivers) - 1
				m.ensureVisible()
			}
		case matchKey(msg, GlobalKeys.HalfUp):
			half := m.visibleRows() / 2
			m.cursor -= half
			if m.cursor < 0 {
				m.cursor = 0
			}
			m.ensureVisible()
		case matchKey(msg, GlobalKeys.HalfDown):
			half := m.visibleRows() / 2
			m.cursor += half
			if m.cursor >= len(drivers) && len(drivers) > 0 {
				m.cursor = len(drivers) - 1
			}
			m.ensureVisible()
		case matchKey(msg, LiveKeys.ToggleSectors):
			m.showSectors = !m.showSectors
		case matchKey(msg, LiveKeys.ToggleRC):
			if m.width < 100 {
				m.showRC = !m.showRC
			}
		case matchKey(msg, LiveKeys.ExpandDriver):
			if len(drivers) > 0 && m.cursor < len(drivers) {
				m.expandedDriver = drivers[m.cursor].RacingNumber
			}
		case matchKey(msg, LiveKeys.Collapse):
			m.expandedDriver = ""
		case matchKey(msg, LiveKeys.ScrollRCUp):
			if m.rcReady {
				m.rcView.LineUp(3)
			}
		case matchKey(msg, LiveKeys.ScrollRCDown):
			if m.rcReady {
				m.rcView.LineDown(3)
			}
		}
	}

	if m.rcReady {
		var cmd tea.Cmd
		m.rcView, cmd = m.rcView.Update(msg)
		if cmd != nil {
			return m, cmd
		}
	}

	return m, nil
}

// ---------------------------------------------------------------------------
// View rendering
// ---------------------------------------------------------------------------

func (m OfficialLiveModel) View() string {
	if m.err != nil {
		return fmt.Sprintf("\n  Error connecting to F1 live stream: %v\n\n%s",
			m.err, helpBar("1-6 tabs", "q quit"))
	}
	if len(m.drivers) == 0 {
		return "\n  Connecting to Official F1 Live Timing Stream...\n"
	}

	w := m.width
	if w < 40 {
		w = 40
	}

	var sb strings.Builder
	sb.WriteString(m.renderLiveHeader(w))
	sb.WriteString(m.renderTrackStatusBanner(w))

	wide := w >= 100
	if wide {
		leftWidth := int(float64(w) * 0.6)
		rightWidth := w - leftWidth - 4

		panels := lipgloss.JoinHorizontal(lipgloss.Top,
			m.renderTimingTower(leftWidth),
			"  ",
			m.renderRightPanel(rightWidth),
		)
		sb.WriteString(panels)
	} else {
		if m.showRC {
			sb.WriteString(m.renderRCContent())
		} else {
			sb.WriteString(m.renderTimingTower(w - 2))
		}
	}

	sb.WriteString("\n")
	if wide {
		sb.WriteString(helpBar("j/k scroll", "enter detail", "s sectors", "K/J race ctrl", "1-6 tabs", "q quit"))
	} else {
		sb.WriteString(helpBar("j/k scroll", "enter detail", "s sectors", "r toggle RC", "1-6 tabs", "q quit"))
	}

	return sb.String()
}

func (m OfficialLiveModel) renderLiveHeader(w int) string {
	var sb strings.Builder

	// Prefer specific session name (e.g. "FP1", "Q3") over generic type
	sessionType := m.session.SessionName
	if sessionType == "" {
		sessionType = m.session.SessionType
	}
	if sessionType == "" {
		sessionType = "LIVE"
	}

	var badgeStyle lipgloss.Style
	switch m.trackStatus {
	case "2":
		badgeStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorF1Black)).Background(lipgloss.Color(colorYellow))
	case "4", "6":
		badgeStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorF1Black)).Background(lipgloss.Color(colorOrange))
	case "5":
		badgeStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorWhite)).Background(lipgloss.Color(colorF1Red))
	default:
		badgeStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorWhite)).Background(lipgloss.Color(colorGreen))
	}
	badge := badgeStyle.Padding(0, 1).Render(strings.ToUpper(sessionType))

	parts := []string{badge}

	if m.session.MeetingName != "" {
		parts = append(parts, styleBold.Render(m.session.MeetingName))
	}

	if m.totalLaps > 0 && m.currentLap > 0 {
		barWidth := 12
		filled := int(float64(m.currentLap) / float64(m.totalLaps) * float64(barWidth))
		if filled > barWidth {
			filled = barWidth
		}
		bar := stylePointsBarFilled.Render(strings.Repeat("█", filled)) +
			stylePointsBarEmpty.Render(strings.Repeat("░", barWidth-filled))
		parts = append(parts, fmt.Sprintf("Lap %s %s",
			styleBold.Render(fmt.Sprintf("%d/%d", m.currentLap, m.totalLaps)), bar))
	}

	if label := m.trackStatusLabel(); label != "" {
		parts = append(parts, label)
	}

	if clk := m.displayClock(); clk != "" {
		parts = append(parts, styleCountdown.Render(clk))
	}

	sb.WriteString("\n  " + strings.Join(parts, "  ") + "\n")

	// Weather mini-line
	if m.weather.AirTemp > 0 || m.weather.TrackTemp > 0 {
		var condStr string
		if m.weather.Rainfall {
			condStr = styleRain.Render("🌧 Rain")
		} else {
			condStr = styleDry.Render("☀ Dry")
		}
		sb.WriteString(styleMuted.Render(fmt.Sprintf("  %s  Air %s  Track %s  💧%s  %s%.1fm/s",
			condStr,
			styleWeatherValue.Render(fmt.Sprintf("%.0f°", m.weather.AirTemp)),
			styleWeatherValue.Render(fmt.Sprintf("%.0f°", m.weather.TrackTemp)),
			styleWeatherValue.Render(fmt.Sprintf("%.0f%%", m.weather.Humidity)),
			styleWeatherValue.Render(windArrow(m.weather.WindDir)+" "),
			m.weather.WindSpeed,
		)) + "\n")
	}

	return sb.String()
}

func (m OfficialLiveModel) trackStatusLabel() string {
	switch m.trackStatus {
	case "1":
		return styleFlagGreen.Render("🟢 GREEN")
	case "2":
		return styleFlagYellow.Render("🟡 YELLOW")
	case "4":
		return styleSafetyCar.Render("⚠ SAFETY CAR")
	case "5":
		return styleFlagRed.Render("🔴 RED FLAG")
	case "6":
		return styleSafetyCar.Render("⚠ VSC")
	default:
		return ""
	}
}

func (m OfficialLiveModel) renderTrackStatusBanner(w int) string {
	if m.trackStatus == "" || m.trackStatus == "1" {
		return ""
	}

	var bannerStyle lipgloss.Style
	var text string
	switch m.trackStatus {
	case "2":
		bannerStyle = lipgloss.NewStyle().Background(lipgloss.Color(colorYellow)).Foreground(lipgloss.Color(colorF1Black)).Bold(true)
		text = "  🟡 YELLOW FLAG"
	case "4":
		bannerStyle = lipgloss.NewStyle().Background(lipgloss.Color(colorOrange)).Foreground(lipgloss.Color(colorWhite)).Bold(true)
		text = "  ⚠ SAFETY CAR DEPLOYED"
	case "5":
		bannerStyle = lipgloss.NewStyle().Background(lipgloss.Color(colorF1Red)).Foreground(lipgloss.Color(colorWhite)).Bold(true)
		text = "  🔴 RED FLAG — SESSION STOPPED"
	case "6":
		bannerStyle = lipgloss.NewStyle().Background(lipgloss.Color(colorOrange)).Foreground(lipgloss.Color(colorWhite)).Bold(true)
		text = "  ⚠ VIRTUAL SAFETY CAR"
	default:
		return ""
	}

	padded := text + strings.Repeat(" ", max(0, w-lipgloss.Width(text)))
	return bannerStyle.Render(padded) + "\n"
}

func (m OfficialLiveModel) renderTimingTower(w int) string {
	var sb strings.Builder
	drivers := m.sortedDrivers()

	fpq := m.isPracticeOrQuali()
	var header string
	if m.showSectors {
		timeLabel := "LAST"
		if fpq {
			timeLabel = "BEST"
		}
		header = fmt.Sprintf("  %s %s  %s  %s  %s  %s  %s  %s  %s  %s",
			padRight("P", 3), padRight("Δ", 2), padRight("", 1), padRight("TLA", 4),
			padRight("TYRE", 5), padRight(timeLabel, 10),
			padRight("S1", 8), padRight("S2", 8), padRight("S3", 8),
			padRight("GAP", 10))
	} else if fpq {
		header = fmt.Sprintf("  %s %s  %s  %s  %s %s %s  %s  %s  %s",
			padRight("P", 3), padRight("Δ", 2), padRight("", 1), padRight("TLA", 4),
			padRight("TYRE", 5), padRight("AGE", 3), padRight("", 1),
			padRight("BEST", 10), padRight("LAST", 10), padRight("GAP", 10))
	} else {
		header = fmt.Sprintf("  %s %s  %s  %s  %s %s  %s  %s  %s",
			padRight("P", 3), padRight("Δ", 2), padRight("", 1), padRight("TLA", 4),
			padRight("TYRE", 5), padRight("AGE", 3), padRight("LAST", 10),
			padRight("GAP", 10), padRight("INT", 10))
	}
	sb.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted)).Bold(true).Render(header) + "\n")
	sb.WriteString("  " + divider(min(w-4, lipgloss.Width(header))) + "\n")

	visible := m.visibleRows()
	endIdx := m.scroll + visible
	if endIdx > len(drivers) {
		endIdx = len(drivers)
	}

	overallBest := m.overallBestLapTime()
	for i := m.scroll; i < endIdx; i++ {
		sb.WriteString(m.renderDriverRow(drivers[i], i, fpq, overallBest) + "\n")
	}

	if len(drivers) > visible {
		sb.WriteString(styleMuted.Render(fmt.Sprintf("  [%d-%d of %d]", m.scroll+1, endIdx, len(drivers))) + "\n")
	}

	return sb.String()
}

func (m OfficialLiveModel) renderDriverRow(d LiveDriverData, idx int, fpq bool, overallBest string) string {
	info, hasInfo := m.driverInfo[d.RacingNumber]
	tla := d.RacingNumber
	teamColor := colorMuted
	if hasInfo {
		tla = info.Tla
		if info.TeamColour != "" {
			teamColor = "#" + info.TeamColour
		} else {
			teamColor = teamColorFromName(info.TeamName)
		}
	}

	posStr := padRightVisible(renderPosition(d.Position), 3)

	deltaStr := padRightVisible(styleDeltaEqual.Render("─"), 2)
	if d.PrevPosition > 0 && d.PrevPosition != d.Position {
		deltaStr = renderDelta(d.Position, d.PrevPosition)
	}

	colorBar := lipgloss.NewStyle().Foreground(lipgloss.Color(teamColor)).Render("┃")

	// In qualifying, dim knocked-out drivers
	tlaStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(teamColor))
	if d.KnockedOut {
		tlaStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorMuted))
	}
	tlaStr := tlaStyle.Render(padRight(tla, 4))
	tyreStr := m.renderTyreIndicator(d.RacingNumber)

	if d.Retired {
		row := fmt.Sprintf("  %s %s  %s  %s  %s  %s",
			posStr, deltaStr, colorBar, tlaStr,
			styleDNF.Render("RET"), styleMuted.Render("Retired"))
		if idx == m.cursor {
			return styleSelected.Render(row)
		}
		if d.KnockedOut {
			return styleMuted.Render(row)
		}
		return row
	}

	if d.InPit {
		row := fmt.Sprintf("  %s %s  %s  %s  %s  %s  %s",
			posStr, deltaStr, colorBar, tlaStr, tyreStr,
			styleSafetyCar.Render(padRight("PIT", 10)),
			m.renderGapStr(d, fpq))
		if idx == m.cursor {
			return styleSelected.Render(row)
		}
		return row
	}

	// Last lap time coloring
	lastLapRaw := d.LastLapTime
	lastLap := padRight(lastLapRaw, 10)
	if lastLapRaw != "" {
		if d.LastLapOB {
			lastLap = padRightVisible(stylePurple.Render(lastLapRaw), 10)
		} else if d.LastLapPB {
			lastLap = padRightVisible(lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen)).Render(lastLapRaw), 10)
		}
	}

	var row string
	if m.showSectors {
		timeCol := lastLap
		if fpq {
			timeCol = m.renderBestLapTime(d, overallBest)
		}
		row = fmt.Sprintf("  %s %s  %s  %s  %s  %s  %s  %s  %s  %s",
			posStr, deltaStr, colorBar, tlaStr, tyreStr,
			timeCol,
			m.renderSector(d.Sectors[0]),
			m.renderSector(d.Sectors[1]),
			m.renderSector(d.Sectors[2]),
			m.renderGapStr(d, fpq))
	} else if fpq {
		// FP / Qualifying: show BEST lap as primary, LAST as secondary
		bestLap := m.renderBestLapTime(d, overallBest)
		flyingIndicator := " "
		if d.OnFlyingLap {
			flyingIndicator = lipgloss.NewStyle().Foreground(lipgloss.Color(colorYellow)).Render("◎")
		}
		row = fmt.Sprintf("  %s %s  %s  %s  %s %s %s  %s  %s  %s",
			posStr, deltaStr, colorBar, tlaStr, tyreStr,
			m.renderTyreAge(d.RacingNumber),
			flyingIndicator,
			bestLap,
			lastLap,
			m.renderGapStr(d, fpq))
		// Highlight danger zone (cutoff) in qualifying
		if d.Cutoff && idx != m.cursor {
			row = lipgloss.NewStyle().Foreground(lipgloss.Color(colorOrange)).Render(row)
		}
	} else {
		// Race mode: LAST + GAP + INT
		row = fmt.Sprintf("  %s %s  %s  %s  %s %s  %s  %s  %s",
			posStr, deltaStr, colorBar, tlaStr, tyreStr,
			m.renderTyreAge(d.RacingNumber),
			lastLap,
			m.renderGapStr(d, fpq),
			m.renderIntvStr(d))
	}

	if idx == m.cursor {
		return styleSelected.Render(row)
	}
	if d.KnockedOut {
		return styleMuted.Render(row)
	}
	return row
}

// renderBestLapTime renders a driver's session best lap time with appropriate coloring.
func (m OfficialLiveModel) renderBestLapTime(d LiveDriverData, overallBest string) string {
	if d.BestLapTime == "" {
		return padRightVisible(styleMuted.Render("no time"), 10)
	}
	isOverallBest := overallBest != "" && d.BestLapTime == overallBest
	if isOverallBest || d.BestLapOB {
		return padRightVisible(stylePurple.Render(d.BestLapTime), 10)
	}
	if d.BestLapPB {
		return padRightVisible(lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen)).Render(d.BestLapTime), 10)
	}
	return padRightVisible(styleBold.Render(d.BestLapTime), 10)
}

func (m OfficialLiveModel) renderGapStr(d LiveDriverData, fpq bool) string {
	if d.Position == 1 {
		if fpq {
			return padRightVisible(styleLeader.Render("P1"), 10)
		}
		return padRightVisible(styleLeader.Render("LEADER"), 10)
	}
	if g := parseGap(d.GapToLeader); g != "" {
		return padRightVisible(styleGap.Render(g), 10)
	}
	return padRight("", 10)
}

func (m OfficialLiveModel) renderIntvStr(d LiveDriverData) string {
	if d.Position == 1 {
		return padRight("", 10)
	}
	if iv := parseGap(d.Interval); iv != "" {
		return padRightVisible(styleGap.Render(iv), 10)
	}
	return padRight("", 10)
}

func (m OfficialLiveModel) renderTyreIndicator(num string) string {
	tyre, ok := m.tyres[num]
	if !ok {
		return padRight("  ?", 5)
	}

	compound := strings.ToUpper(tyre.Compound)
	abbrev, style := compoundAbbrevStyle(compound)

	newMark := " "
	if tyre.New {
		newMark = style.Render("*")
	}
	return padRightVisible(style.Render("●")+" "+abbrev+newMark, 5)
}

func (m OfficialLiveModel) renderTyreAge(num string) string {
	tyre, ok := m.tyres[num]
	if !ok {
		return padRight("", 3)
	}

	ageStr := fmt.Sprintf("%d", tyre.Age)
	compound := strings.ToUpper(tyre.Compound)
	isOld := (strings.Contains(compound, "SOFT") && tyre.Age > 25) ||
		(strings.Contains(compound, "MEDIUM") && tyre.Age > 35) ||
		(strings.Contains(compound, "HARD") && tyre.Age > 45)

	if isOld {
		return padRightVisible(lipgloss.NewStyle().Foreground(lipgloss.Color(colorOrange)).Render(ageStr), 3)
	}
	return padRightVisible(styleMuted.Render(ageStr), 3)
}

func (m OfficialLiveModel) renderSector(s LiveSectorData) string {
	if s.Value == "" {
		return padRight("", 8)
	}
	if s.OverallFastest {
		return padRightVisible(stylePurple.Render(s.Value), 8)
	}
	if s.PersonalFastest {
		return padRightVisible(lipgloss.NewStyle().Foreground(lipgloss.Color(colorGreen)).Render(s.Value), 8)
	}
	return padRight(s.Value, 8)
}

func (m OfficialLiveModel) renderRCContent() string {
	if len(m.rcMessages) == 0 {
		return styleMuted.Render("  No race control messages.")
	}

	var lines []string
	for _, rc := range m.rcMessages {
		lapStr := ""
		if rc.Lap > 0 {
			lapStr = styleMuted.Render(fmt.Sprintf("L%d ", rc.Lap))
		}

		var prefix string
		switch rc.Category {
		case "SafetyCar":
			prefix = styleSafetyCar.Render(fmt.Sprintf("  ⚠ [%s] %s", rc.Time, lapStr))
		case "Drs":
			prefix = styleDRS.Render(fmt.Sprintf("  ▸ [%s] %s", rc.Time, lapStr))
		default:
			icon := "  "
			var flagStyle lipgloss.Style
			switch rc.Flag {
			case "GREEN":
				icon, flagStyle = "🟢", styleFlagGreen
			case "YELLOW", "DOUBLE YELLOW":
				icon, flagStyle = "🟡", styleFlagYellow
			case "RED":
				icon, flagStyle = "🔴", styleFlagRed
			case "BLUE":
				icon, flagStyle = "🔵", styleFlagBlue
			case "CHEQUERED":
				icon = "🏁"
				flagStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(colorWhite)).Bold(true)
			default:
				flagStyle = styleMuted
			}
			prefix = flagStyle.Render(fmt.Sprintf("  %s [%s] %s", icon, rc.Time, lapStr))
		}

		lines = append(lines, fmt.Sprintf("%s%s", prefix, rc.Message))
	}

	return strings.Join(lines, "\n")
}

func (m OfficialLiveModel) renderRightPanel(w int) string {
	var sb strings.Builder

	sb.WriteString(styleSectionTitle.Render("RACE CONTROL") + "\n")
	if m.rcReady {
		sb.WriteString(m.rcView.View() + "\n")
	} else {
		lines := strings.Split(m.renderRCContent(), "\n")
		if len(lines) > 10 {
			lines = lines[len(lines)-10:]
		}
		sb.WriteString(strings.Join(lines, "\n") + "\n")
	}

	if m.expandedDriver != "" {
		sb.WriteString("\n" + divider(w) + "\n")
		sb.WriteString(m.renderDriverDetail(w))
	}

	return sb.String()
}

func (m OfficialLiveModel) renderDriverDetail(w int) string {
	num := m.expandedDriver
	d, ok := m.drivers[num]
	if !ok {
		return ""
	}
	info, hasInfo := m.driverInfo[num]

	var sb strings.Builder

	name := fmt.Sprintf("#%s", num)
	team := ""
	teamColor := colorMuted
	if hasInfo {
		name = fmt.Sprintf("%s %s #%s", info.FirstName, info.LastName, num)
		team = info.TeamName
		if info.TeamColour != "" {
			teamColor = "#" + info.TeamColour
		} else {
			teamColor = teamColorFromName(info.TeamName)
		}
	}

	nameStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(teamColor))
	sb.WriteString("  " + nameStyle.Render(name))
	if team != "" {
		sb.WriteString("  " + styleMuted.Render(team))
	}
	sb.WriteString("\n")

	// Stint timeline
	if driverStints, ok := m.stints[num]; ok && len(driverStints) > 0 {
		sb.WriteString("  ")
		for i, st := range driverStints {
			compound := strings.ToUpper(st.Compound)
			abbrev, style := compoundAbbrevStyle(compound)
			newMark := ""
			if st.New {
				newMark = "*"
			}
			if i > 0 {
				sb.WriteString(styleMuted.Render(" → "))
			}
			sb.WriteString(style.Render(fmt.Sprintf("%s(%d%s)", abbrev, st.Laps, newMark)))
		}
		sb.WriteString("\n")
	}

	if d.BestLapTime != "" {
		sb.WriteString(styleMuted.Render("  Best: ") + styleBold.Render(d.BestLapTime))
		if d.BestLapOB || d.LastLapOB {
			sb.WriteString("  " + stylePurple.Render("FL"))
		}
		if d.BestLapNum > 0 {
			sb.WriteString(styleMuted.Render(fmt.Sprintf(" (L%d)", d.BestLapNum)))
		}
		sb.WriteString("\n")
	}

	if d.SpeedTrap != "" {
		sb.WriteString(styleMuted.Render("  Speed: ") + styleWeatherValue.Render(d.SpeedTrap+"km/h") + "\n")
	}

	sb.WriteString(fmt.Sprintf("  %s P%d  %s %d laps\n",
		styleMuted.Render("Pos:"), d.Position,
		styleMuted.Render("Laps:"), d.NumberOfLaps))

	return sb.String()
}
