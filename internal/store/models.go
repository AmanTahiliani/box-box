package store

import "time"

// RawPayload stores a fetched source payload with provenance metadata.
type RawPayload struct {
	ID             int64
	Source         string
	Endpoint       string
	RequestKey     string
	MeetingKey     *int
	SessionKey     *int
	Payload        string
	PayloadHash    string
	FetchedAt      time.Time
	ProvenanceJSON string
}

// IngestionRun tracks a scoped ingestion attempt.
type IngestionRun struct {
	ID          int64
	ScopeType   string
	ScopeKey    string
	StartedAt   time.Time
	FinishedAt  *time.Time
	Status      string
	Refresh     bool
	SummaryJSON string
}

// NewsSource stores RSS/Atom feed metadata for local-first briefing reads.
type NewsSource struct {
	Source    string
	Name      string
	FeedURL   string
	Category  string
	Enabled   bool
	FetchedAt *time.Time
	ExpiresAt *time.Time
	UpdatedAt time.Time
}

// NewsItem stores a normalized feed item deduplicated by URL.
type NewsItem struct {
	URL           string
	Source        string
	Title         string
	PublishedAt   *time.Time
	Summary       string
	Category      string
	FetchedAt     time.Time
	OGImageURL    string
	OGDescription string
	ReadAt        *time.Time
}

// Meeting is a race weekend record.
type Meeting struct {
	MeetingKey          int
	MeetingName         string
	MeetingOfficialName string
	Location            string
	CountryCode         string
	CountryName         string
	CircuitKey          int
	CircuitShortName    string
	GMTOffset           string
	DateStart           string
	DateEnd             string
	Year                int
	IsCancelled         bool
	UpdatedAt           time.Time
}

// Session is a session within a meeting.
type Session struct {
	SessionKey  int
	MeetingKey  int
	SessionName string
	SessionType string
	CircuitKey  int
	DateStart   string
	DateEnd     string
	GMTOffset   string
	IsCancelled bool
	UpdatedAt   time.Time
}

// Driver is a driver identity record.
type Driver struct {
	DriverNumber  int
	BroadcastName string
	FirstName     string
	FullName      string
	LastName      string
	NameAcronym   string
	HeadshotURL   string
	TeamName      string
	TeamColour    string
	UpdatedAt     time.Time
}

// SessionDriver links a driver to a session with session-specific team info.
type SessionDriver struct {
	SessionKey    int
	DriverNumber  int
	MeetingKey    int
	BroadcastName string
	FirstName     string
	FullName      string
	LastName      string
	NameAcronym   string
	HeadshotURL   string
	TeamName      string
	TeamColour    string
}

// SessionResult is a final classification row for a session.
type SessionResult struct {
	SessionKey      int
	DriverNumber    int
	MeetingKey      int
	Position        int
	Points          float64
	NumberOfLaps    int
	DurationJSON    string
	GapToLeaderJSON string
	DNF             bool
	DNS             bool
	DSQ             bool
}

// StartingGridEntry is a starting grid position for a session.
type StartingGridEntry struct {
	SessionKey   int
	DriverNumber int
	MeetingKey   int
	Position     int
	LapDuration  float64
}

// Stint is a tyre stint for a driver in a session.
type Stint struct {
	SessionKey     int
	DriverNumber   int
	MeetingKey     int
	StintNumber    int
	Compound       string
	LapStart       int
	LapEnd         int
	TyreAgeAtStart int
}

// PitStop is a pit stop event for a driver in a session.
type PitStop struct {
	SessionKey   int
	DriverNumber int
	MeetingKey   int
	LapNumber    int
	Date         string
	PitDuration  float64
	LaneDuration float64
	StopDuration float64
}

// PositionSample is a position update for a driver in a session.
type PositionSample struct {
	SessionKey   int
	DriverNumber int
	MeetingKey   int
	Date         string
	Position     int
}

// RaceControlMessage is a race control message for a session.
type RaceControlMessage struct {
	SessionKey      int
	MeetingKey      int
	Date            string
	Category        string
	Flag            string
	Message         string
	Scope           string
	DriverNumber    *int
	LapNumber       *int
	Sector          *int
	QualifyingPhase *int
}

// WeatherSample is a weather reading for a session.
type WeatherSample struct {
	SessionKey       int
	MeetingKey       int
	Date             string
	AirTemperature   float64
	TrackTemperature float64
	Humidity         float64
	Pressure         float64
	Rainfall         int
	WindDirection    int
	WindSpeed        float64
}

// Lap is a completed lap for a driver in a session.
type Lap struct {
	SessionKey      int
	DriverNumber    int
	MeetingKey      int
	LapNumber       int
	DateStart       string
	LapDuration     float64
	IsPitOutLap     bool
	DurationSector1 float64
	DurationSector2 float64
	DurationSector3 float64
}
