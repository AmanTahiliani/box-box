package models

type Circuit struct {
	CircuitKey       int    `json:"circuit_key"`
	CircuitShortName string `json:"circuit_short_name"`
	CircuitType      string `json:"circuit_type"`
	CircuitInfoURL   string `json:"circuit_info_url"`
	CircuitImage     string `json:"circuit_image"`
}

type Meeting struct {
	MeetingKey          int32  `json:"meeting_key"`
	MeetingName         string `json:"meeting_name"`
	MeetingOfficialName string `json:"meeting_official_name"`
	Location            string `json:"location"`
	CountryKey          int    `json:"country_key"`
	CountryCode         string `json:"country_code"`
	CountryName         string `json:"country_name"`
	CountryFlag         string `json:"country_flag"`

	Circuit

	GMTOffset string `json:"gmt_offset"`
	DateStart string `json:"date_start"`
	DateEnd   string `json:"date_end"`
	Year      int    `json:"year"`
}

type Session struct {
	SessionKey  int    `json:"session_key"`
	SessionName string `json:"session_name"`
	SessionType string `json:"session_type"`

	CircuitKey int `json:"circuit_key"`

	MeetingKey int `json:"meeting_key"`

	DateStart string `json:"date_start"`
	DateEnd   string `json:"date_end"`
	GMTOffset string `json:"gmt_offset"`
}

// TyreCompound represents the type of tyre compound used.
type TyreCompound string

const (
	CompoundSoft         TyreCompound = "SOFT"
	CompoundMedium       TyreCompound = "MEDIUM"
	CompoundHard         TyreCompound = "HARD"
	CompoundIntermediate TyreCompound = "INTERMEDIATE"
	CompoundWet          TyreCompound = "WET"
	CompoundUnknown      TyreCompound = "UNKNOWN"
)

// Flag represents race control flag colours/types.
type Flag string

const (
	FlagGreen        Flag = "GREEN"
	FlagYellow       Flag = "YELLOW"
	FlagDoubleYellow Flag = "DOUBLE YELLOW"
	FlagRed          Flag = "RED"
	FlagBlue         Flag = "BLUE"
	FlagChequered    Flag = "CHEQUERED"
	FlagBlack        Flag = "BLACK"
	FlagBlackOrange  Flag = "BLACK AND ORANGE"
	FlagBlackWhite   Flag = "BLACK AND WHITE"
)

// RaceControlCategory classifies race control messages.
type RaceControlCategory string

const (
	CategoryFlag      RaceControlCategory = "Flag"
	CategorySafetyCar RaceControlCategory = "SafetyCar"
	CategoryDRS       RaceControlCategory = "Drs"
	CategoryOther     RaceControlCategory = "Other"
)

type Driver struct {
	BroadcastName string `json:"broadcast_name"`
	DriverNumber  int    `json:"driver_number"`
	FirstName     string `json:"first_name"`
	FullName      string `json:"full_name"`
	HeadshotURL   string `json:"headshot_url"`
	LastName      string `json:"last_name"`
	MeetingKey    int    `json:"meeting_key"`
	NameAcronym   string `json:"name_acronym"`
	SessionKey    int    `json:"session_key"`
	TeamColour    string `json:"team_colour"` // hex RRGGBB
	TeamName      string `json:"team_name"`
}

type ChampionshipDriver struct {
	DriverNumber    int     `json:"driver_number"`
	MeetingKey      int     `json:"meeting_key"`
	PointsCurrent   float64 `json:"points_current"`
	PointsStart     float64 `json:"points_start"`
	PositionCurrent int     `json:"position_current"`
	PositionStart   int     `json:"position_start"`
	SessionKey      int     `json:"session_key"`
}

type ChampionshipTeam struct {
	MeetingKey      int     `json:"meeting_key"`
	PointsCurrent   float64 `json:"points_current"`
	PointsStart     float64 `json:"points_start"`
	PositionCurrent int     `json:"position_current"`
	PositionStart   int     `json:"position_start"`
	SessionKey      int     `json:"session_key"`
	TeamName        string  `json:"team_name"`
}

type SessionResult struct {
	DNF          bool        `json:"dnf"`
	DNS          bool        `json:"dns"`
	DSQ          bool        `json:"dsq"`
	DriverNumber int         `json:"driver_number"`
	Duration     interface{} `json:"duration"`      // float64 or []float64 (qualifying)
	GapToLeader  interface{} `json:"gap_to_leader"` // float64, string "+N LAP(S)", or []float64
	NumberOfLaps int         `json:"number_of_laps"`
	MeetingKey   int         `json:"meeting_key"`
	Points       float64     `json:"points"`
	Position     int         `json:"position"`
	SessionKey   int         `json:"session_key"`
}

type StartingGrid struct {
	DriverNumber int     `json:"driver_number"`
	LapDuration  float64 `json:"lap_duration"` // qualifying lap time in seconds
	MeetingKey   int     `json:"meeting_key"`
	Position     int     `json:"position"`
	SessionKey   int     `json:"session_key"`
}

type Lap struct {
	DateStart       string   `json:"date_start"`
	DriverNumber    int      `json:"driver_number"`
	DurationSector1 *float64 `json:"duration_sector_1"`
	DurationSector2 *float64 `json:"duration_sector_2"`
	DurationSector3 *float64 `json:"duration_sector_3"`
	I1Speed         int      `json:"i1_speed"`
	I2Speed         int      `json:"i2_speed"`
	IsPitOutLap     bool     `json:"is_pit_out_lap"`
	LapDuration     *float64 `json:"lap_duration"`
	LapNumber       int      `json:"lap_number"`
	MeetingKey      int      `json:"meeting_key"`
	SegmentsSector1 []int    `json:"segments_sector_1"`
	SegmentsSector2 []int    `json:"segments_sector_2"`
	SegmentsSector3 []int    `json:"segments_sector_3"`
	SessionKey      int      `json:"session_key"`
	StSpeed         int      `json:"st_speed"` // speed trap
}

type Stint struct {
	Compound       TyreCompound `json:"compound"`
	DriverNumber   int          `json:"driver_number"`
	LapEnd         int          `json:"lap_end"`
	LapStart       int          `json:"lap_start"`
	MeetingKey     int          `json:"meeting_key"`
	SessionKey     int          `json:"session_key"`
	StintNumber    int          `json:"stint_number"`
	TyreAgeAtStart int          `json:"tyre_age_at_start"`
}

type Pit struct {
	Date         string  `json:"date"`
	DriverNumber int     `json:"driver_number"`
	LaneDuration float64 `json:"lane_duration"` // pit lane time (entry to exit)
	LapNumber    int     `json:"lap_number"`
	MeetingKey   int     `json:"meeting_key"`
	PitDuration  float64 `json:"pit_duration"`  // deprecated, use StopDuration
	SessionKey   int     `json:"session_key"`
	StopDuration float64 `json:"stop_duration"` // stationary time only
}

type Position struct {
	Date         string `json:"date"`
	DriverNumber int    `json:"driver_number"`
	MeetingKey   int    `json:"meeting_key"`
	Position     int    `json:"position"`
	SessionKey   int    `json:"session_key"`
}

type Interval struct {
	Date         string   `json:"date"`
	DriverNumber int      `json:"driver_number"`
	GapToLeader  *float64 `json:"gap_to_leader"` // null when leading
	Interval     *float64 `json:"interval"`       // null when leading
	MeetingKey   int      `json:"meeting_key"`
	SessionKey   int      `json:"session_key"`
}

type Overtake struct {
	Date                   string `json:"date"`
	MeetingKey             int    `json:"meeting_key"`
	OvertakenDriverNumber  int    `json:"overtaken_driver_number"`
	OvertakingDriverNumber int    `json:"overtaking_driver_number"`
	Position               int    `json:"position"`
	SessionKey             int    `json:"session_key"`
}

type RaceControl struct {
	Category        RaceControlCategory `json:"category"`
	Date            string              `json:"date"`
	DriverNumber    *int                `json:"driver_number"` // nil = all drivers
	Flag            Flag                `json:"flag"`
	LapNumber       *int                `json:"lap_number"`
	MeetingKey      int                 `json:"meeting_key"`
	Message         string              `json:"message"`
	QualifyingPhase *int                `json:"qualifying_phase"` // 1-3, nil if N/A
	Scope           string              `json:"scope"`            // "Track", "Driver", "Sector"
	Sector          *int                `json:"sector"`           // nil if track-wide
	SessionKey      int                 `json:"session_key"`
}

type Weather struct {
	AirTemperature   float64 `json:"air_temperature"`
	Date             string  `json:"date"`
	Humidity         float64 `json:"humidity"`
	MeetingKey       int     `json:"meeting_key"`
	Pressure         float64 `json:"pressure"`
	Rainfall         int     `json:"rainfall"` // 0 = dry, 1 = rain
	SessionKey       int     `json:"session_key"`
	TrackTemperature float64 `json:"track_temperature"`
	WindDirection    int     `json:"wind_direction"` // 0-359 degrees
	WindSpeed        float64 `json:"wind_speed"`     // m/s
}

type CarData struct {
	Brake        int    `json:"brake"`        // 0-100
	Date         string `json:"date"`
	DriverNumber int    `json:"driver_number"`
	DRS          int    `json:"drs"` // 0=off, 8=eligible, 10=open
	MeetingKey   int    `json:"meeting_key"`
	NGear        int    `json:"n_gear"` // 0-8
	RPM          int    `json:"rpm"`
	SessionKey   int    `json:"session_key"`
	Speed        int    `json:"speed"`    // km/h
	Throttle     int    `json:"throttle"` // 0-100
}

type Location struct {
	Date         string  `json:"date"`
	DriverNumber int     `json:"driver_number"`
	MeetingKey   int     `json:"meeting_key"`
	SessionKey   int     `json:"session_key"`
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
	Z            float64 `json:"z"`
}

type TeamRadio struct {
	Date         string `json:"date"`
	DriverNumber int    `json:"driver_number"`
	MeetingKey   int    `json:"meeting_key"`
	RecordingURL string `json:"recording_url"`
	SessionKey   int    `json:"session_key"`
}
