package live

import (
	"encoding/json"
	"time"
)

// F1SignalRMessage is the top-level envelope from the official F1 SignalR feed.
type F1SignalRMessage struct {
	M []struct {
		A []json.RawMessage `json:"A"`
	} `json:"M"`
	R json.RawMessage `json:"R"`
}

// F1TimingLine is a single driver's timing row from TimingData.
type F1TimingLine struct {
	GapToLeader             interface{} `json:"GapToLeader"`
	IntervalToPositionAhead struct {
		Value interface{} `json:"Value"`
	} `json:"IntervalToPositionAhead"`
	Position     interface{} `json:"Position"`
	RacingNumber string      `json:"RacingNumber"`
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
	Sectors      json.RawMessage            `json:"Sectors"`
	Speeds       map[string]json.RawMessage `json:"Speeds"`
}

// F1DriverListEntry is driver metadata from the DriverList topic.
type F1DriverListEntry struct {
	RacingNumber  string `json:"RacingNumber"`
	BroadcastName string `json:"BroadcastName"`
	Tla           string `json:"Tla"`
	TeamName      string `json:"TeamName"`
	TeamColour    string `json:"TeamColour"`
	FirstName     string `json:"FirstName"`
	LastName      string `json:"LastName"`
}

// LiveTyreData holds current tyre compound and age for a driver.
type LiveTyreData struct {
	Compound string // SOFT, MEDIUM, HARD, INTERMEDIATE, WET
	New      bool
	Age      int // laps on current set
}

// LiveRCMessage is a parsed race control message.
type LiveRCMessage struct {
	Time     string // "15:04" formatted
	Category string // Flag, SafetyCar, Drs, Other
	Flag     string // GREEN, YELLOW, RED, etc.
	Message  string
	Lap      int
}

// LiveWeatherData holds session weather readings.
type LiveWeatherData struct {
	AirTemp   float64
	TrackTemp float64
	Humidity  float64
	WindSpeed float64
	WindDir   int
	Rainfall  bool
}

// LiveSessionMeta holds session and meeting metadata.
type LiveSessionMeta struct {
	MeetingName string
	CircuitName string
	SessionType string
	SessionName string
	Path        string
}

// LivePositionData is the latest raw F1 GPS position for one driver.
type LivePositionData struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Z      float64 `json:"z"`
	Status string  `json:"status"`
}

// LiveTelemetryData is the latest car telemetry for one driver.
type LiveTelemetryData struct {
	Speed    int `json:"Speed"`
	Throttle int `json:"Throttle"`
	Brake    int `json:"Brake"`
	DRS      int `json:"DRS"`
	NGear    int `json:"NGear"`
	RPM      int `json:"RPM"`
}

// LiveSectorData holds a single sector time and flags.
type LiveSectorData struct {
	Value           string
	PersonalFastest bool
	OverallFastest  bool
}

// LiveDriverData is the normalized timing state for one driver.
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

// LiveStintData is one stint in a driver's tyre history.
type LiveStintData struct {
	Compound string
	New      bool
	Laps     int
}

// LiveRadioCapture is one team radio audio clip from the live timing feed.
type LiveRadioCapture struct {
	Utc          string
	RacingNumber string
	Path         string
}

// LiveStreamData is an immutable snapshot of all live timing state.
type LiveStreamData struct {
	Drivers            map[string]LiveDriverData
	DriverInfo         map[string]F1DriverListEntry
	Tyres              map[string]LiveTyreData
	Telemetry          map[string]LiveTelemetryData
	RCMessages         []LiveRCMessage
	Weather            LiveWeatherData
	Session            LiveSessionMeta
	TeamRadio          []LiveRadioCapture
	SessionStatus      string
	TrackStatus        string // "1"=green "2"=yellow "4"=SC "5"=red "6"=VSC
	CurrentLap         int
	TotalLaps          int
	Clock              string    // "HH:MM:SS" remaining at ClockRefTime
	ClockRefTime       time.Time // UTC when Clock was accurate
	ClockExtrapolating bool      // true = actively counting down
	Stints             map[string][]LiveStintData
	Positions          map[string]LivePositionData `json:"-"`
	PositionUpdated    bool                        `json:"-"`
	SnapshotUpdated    bool                        `json:"-"`
}

// SessionStatusIsActive reports whether a raw F1 live timing SessionStatus
// value represents an actively running session.
func SessionStatusIsActive(status string) bool {
	switch normalizeSessionStatus(status) {
	case "started", "resumed":
		return true
	default:
		return false
	}
}

func normalizeSessionStatus(status string) string {
	out := make([]rune, 0, len(status))
	for _, r := range status {
		switch {
		case r >= 'A' && r <= 'Z':
			out = append(out, r+'a'-'A')
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			out = append(out, r)
		}
	}
	return string(out)
}
