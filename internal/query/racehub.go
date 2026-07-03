package query

import (
	"database/sql"
	"errors"

	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/store"
)

// Service assembles store-backed read models.
type Service struct {
	store *store.Store
}

// NewService creates a query service over a domain store.
func NewService(st *store.Store) *Service {
	return &Service{store: st}
}

// EnrichedResult is a session result with driver identity fields.
type EnrichedResult struct {
	models.SessionResult
	NameAcronym string `json:"name_acronym"`
	FullName    string `json:"full_name"`
	TeamName    string `json:"team_name"`
	TeamColour  string `json:"team_colour"`
}

// EnrichedGrid is a starting grid row with driver identity fields.
type EnrichedGrid struct {
	models.StartingGrid
	NameAcronym string `json:"name_acronym"`
	FullName    string `json:"full_name"`
	TeamName    string `json:"team_name"`
	TeamColour  string `json:"team_colour"`
}

// RaceHub is the local-first Race Hub read model for one session.
type RaceHub struct {
	Source       string                 `json:"source"`
	SessionKey   int                    `json:"session_key"`
	Datasets     map[string]DatasetInfo `json:"datasets"`
	Meeting      *models.Meeting        `json:"meeting,omitempty"`
	Session      *models.Session        `json:"session,omitempty"`
	Drivers      []models.Driver        `json:"drivers"`
	Results      []EnrichedResult       `json:"results"`
	StartingGrid []EnrichedGrid         `json:"starting_grid"`
	Stints       []models.Stint         `json:"stints"`
	PitStops     []models.Pit           `json:"pit_stops"`
	Positions    []models.Position      `json:"positions"`
	RaceControl  []models.RaceControl   `json:"race_control"`
	Weather      []models.Weather       `json:"weather"`
	Laps         []models.Lap           `json:"laps"`
}

// GetRaceHub loads ingested Race Hub datasets for a session from the local store.
func (s *Service) GetRaceHub(sessionKey int) (RaceHub, error) {
	hub := RaceHub{
		SessionKey: sessionKey,
		Datasets: map[string]DatasetInfo{
			"meeting":       missingDataset(),
			"session":       missingDataset(),
			"drivers":       missingDataset(),
			"results":       missingDataset(),
			"starting_grid": missingDataset(),
			"stints":        missingDataset(),
			"pit_stops":     missingDataset(),
			"positions":     missingDataset(),
			"race_control":  missingDataset(),
			"weather":       missingDataset(),
			"laps":          missingDataset(),
		},
		Drivers:      []models.Driver{},
		Results:      []EnrichedResult{},
		StartingGrid: []EnrichedGrid{},
		Stints:       []models.Stint{},
		PitStops:     []models.Pit{},
		Positions:    []models.Position{},
		RaceControl:  []models.RaceControl{},
		Weather:      []models.Weather{},
		Laps:         []models.Lap{},
	}

	sess, err := s.store.GetSession(sessionKey)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			hub.Source = ResponseSourceNone
			return hub, nil
		}
		return RaceHub{}, err
	}

	sessionModel := sessionToModel(sess)
	hub.Session = &sessionModel
	hub.Datasets["session"] = availableLocal(1)

	meeting, err := s.store.GetMeeting(sess.MeetingKey)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return RaceHub{}, err
		}
	} else {
		meetingModel := meetingToModel(meeting)
		hub.Meeting = &meetingModel
		hub.Datasets["meeting"] = availableLocal(1)
	}

	if sess.IsCancelled || (hub.Meeting != nil && hub.Meeting.IsCancelled) {
		hub.Source = ResponseSourceCancelled
		hub.Datasets = cancelledDatasets()
		return hub, nil
	}

	driverLinks, err := s.store.ListSessionDrivers(sessionKey)
	if err != nil {
		return RaceHub{}, err
	}
	if len(driverLinks) > 0 {
		drivers := make([]models.Driver, 0, len(driverLinks))
		for _, link := range driverLinks {
			d, err := s.store.GetDriver(link.DriverNumber)
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				return RaceHub{}, err
			}
			drivers = append(drivers, driverToModel(sessionKey, sess.MeetingKey, link, d))
		}
		hub.Drivers = drivers
		hub.Datasets["drivers"] = availableLocal(len(drivers))
	}

	driverByNumber := make(map[int]models.Driver, len(hub.Drivers))
	for _, d := range hub.Drivers {
		driverByNumber[d.DriverNumber] = d
	}

	results, err := s.store.ListSessionResults(sessionKey)
	if err != nil {
		return RaceHub{}, err
	}
	if len(results) > 0 {
		enriched := make([]EnrichedResult, 0, len(results))
		for _, r := range results {
			e := EnrichedResult{SessionResult: resultToModel(r)}
			if d, ok := driverByNumber[r.DriverNumber]; ok {
				e.NameAcronym = d.NameAcronym
				e.FullName = d.FullName
				e.TeamName = d.TeamName
				e.TeamColour = d.TeamColour
			}
			enriched = append(enriched, e)
		}
		hub.Results = enriched
		hub.Datasets["results"] = availableLocal(len(enriched))
	}

	grid, err := s.store.ListStartingGrid(sessionKey)
	if err != nil {
		return RaceHub{}, err
	}
	if len(grid) > 0 {
		enriched := make([]EnrichedGrid, 0, len(grid))
		for _, g := range grid {
			e := EnrichedGrid{StartingGrid: gridToModel(g)}
			if d, ok := driverByNumber[g.DriverNumber]; ok {
				e.NameAcronym = d.NameAcronym
				e.FullName = d.FullName
				e.TeamName = d.TeamName
				e.TeamColour = d.TeamColour
			}
			enriched = append(enriched, e)
		}
		hub.StartingGrid = enriched
		hub.Datasets["starting_grid"] = availableLocal(len(enriched))
	} else if !isGridExpected(sessionModel.SessionType, sessionModel.SessionName) {
		hub.Datasets["starting_grid"] = skippedNA()
	}

	stints, err := s.store.ListStints(sessionKey)
	if err != nil {
		return RaceHub{}, err
	}
	if len(stints) > 0 {
		hub.Stints = make([]models.Stint, 0, len(stints))
		for _, st := range stints {
			hub.Stints = append(hub.Stints, stintToModel(st))
		}
		hub.Datasets["stints"] = availableLocal(len(hub.Stints))
	}

	pitStops, err := s.store.ListPitStops(sessionKey)
	if err != nil {
		return RaceHub{}, err
	}
	if len(pitStops) > 0 {
		hub.PitStops = make([]models.Pit, 0, len(pitStops))
		for _, p := range pitStops {
			hub.PitStops = append(hub.PitStops, pitStopToModel(p))
		}
		hub.Datasets["pit_stops"] = availableLocal(len(hub.PitStops))
	}

	positions, err := s.store.ListPositionSamples(sessionKey)
	if err != nil {
		return RaceHub{}, err
	}
	if len(positions) > 0 {
		hub.Positions = make([]models.Position, 0, len(positions))
		for _, p := range positions {
			hub.Positions = append(hub.Positions, positionToModel(p))
		}
		hub.Datasets["positions"] = availableLocal(len(hub.Positions))
	}

	raceControl, err := s.store.ListRaceControlMessages(sessionKey)
	if err != nil {
		return RaceHub{}, err
	}
	if len(raceControl) > 0 {
		hub.RaceControl = make([]models.RaceControl, 0, len(raceControl))
		for _, rc := range raceControl {
			hub.RaceControl = append(hub.RaceControl, raceControlToModel(rc))
		}
		hub.Datasets["race_control"] = availableLocal(len(hub.RaceControl))
	}

	weather, err := s.store.ListWeatherSamples(sessionKey)
	if err != nil {
		return RaceHub{}, err
	}
	if len(weather) > 0 {
		hub.Weather = make([]models.Weather, 0, len(weather))
		for _, w := range weather {
			hub.Weather = append(hub.Weather, weatherToModel(w))
		}
		hub.Datasets["weather"] = availableLocal(len(hub.Weather))
	}

	laps, err := s.store.ListLaps(sessionKey)
	if err != nil {
		return RaceHub{}, err
	}
	if len(laps) > 0 {
		hub.Laps = make([]models.Lap, 0, len(laps))
		for _, l := range laps {
			hub.Laps = append(hub.Laps, lapToModel(l))
		}
		hub.Datasets["laps"] = availableLocal(len(hub.Laps))
	}

	hub.Source = responseSource(hub.Datasets)
	return hub, nil
}
