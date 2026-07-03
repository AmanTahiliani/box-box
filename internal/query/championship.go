package query

import (
	"database/sql"
	"errors"
	"sort"
	"strings"

	"github.com/AmanTahiliani/box-box/internal/models"
)

// ChampionshipRace is the local data needed by the web championship hub for one GP.
type ChampionshipRace struct {
	Meeting        models.Meeting
	RaceSessionKey int
	Results        []models.SessionResult
	Grid           []models.StartingGrid
}

// ChampionshipInputs are local-first inputs for the championship hub aggregation.
type ChampionshipInputs struct {
	Races     []ChampionshipRace
	Champ     []models.ChampionshipDriver
	Teams     []models.ChampionshipTeam
	DriverMap map[int]models.Driver
}

// GetChampionshipInputs derives championship hub inputs from ingested season data.
func (s *Service) GetChampionshipInputs(year int) (ChampionshipInputs, error) {
	meetings, err := s.ListMeetingsByYear(year)
	if err != nil {
		return ChampionshipInputs{}, err
	}

	inputs := ChampionshipInputs{
		Races:     []ChampionshipRace{},
		Champ:     []models.ChampionshipDriver{},
		Teams:     []models.ChampionshipTeam{},
		DriverMap: map[int]models.Driver{},
	}

	pointsByDriver := map[int]float64{}
	pointsByTeam := map[string]float64{}
	latestSessionKey := 0
	latestMeetingKey := 0

	for _, meeting := range meetings {
		sessions, err := s.ListSessionsByMeeting(int(meeting.MeetingKey))
		if err != nil {
			return ChampionshipInputs{}, err
		}

		raceKey := 0
		for _, sess := range sessions {
			if strings.EqualFold(sess.SessionName, "Race") {
				raceKey = sess.SessionKey
				break
			}
		}
		if raceKey == 0 {
			continue
		}

		results, err := s.store.ListSessionResults(raceKey)
		if err != nil {
			return ChampionshipInputs{}, err
		}
		grid, err := s.store.ListStartingGrid(raceKey)
		if err != nil {
			return ChampionshipInputs{}, err
		}

		race := ChampionshipRace{
			Meeting:        meeting,
			RaceSessionKey: raceKey,
			Results:        make([]models.SessionResult, 0, len(results)),
			Grid:           make([]models.StartingGrid, 0, len(grid)),
		}
		for _, result := range results {
			race.Results = append(race.Results, resultToModel(result))
		}
		for _, entry := range grid {
			race.Grid = append(race.Grid, gridToModel(entry))
		}
		inputs.Races = append(inputs.Races, race)

		if len(results) == 0 {
			continue
		}

		latestSessionKey = raceKey
		latestMeetingKey = int(meeting.MeetingKey)
		drivers, err := s.driversForSession(raceKey)
		if err != nil {
			return ChampionshipInputs{}, err
		}
		for _, d := range drivers {
			inputs.DriverMap[d.DriverNumber] = d
		}

		for _, result := range results {
			pointsByDriver[result.DriverNumber] += result.Points
			team := inputs.DriverMap[result.DriverNumber].TeamName
			if team != "" {
				pointsByTeam[team] += result.Points
			}
		}
	}

	inputs.Champ = derivedDriverStandings(pointsByDriver, latestMeetingKey, latestSessionKey)
	inputs.Teams = derivedTeamStandings(pointsByTeam, latestMeetingKey, latestSessionKey)
	return inputs, nil
}

func (s *Service) driversForSession(sessionKey int) ([]models.Driver, error) {
	sess, err := s.store.GetSession(sessionKey)
	if err != nil {
		return nil, err
	}
	links, err := s.store.ListSessionDrivers(sessionKey)
	if err != nil {
		return nil, err
	}
	drivers := make([]models.Driver, 0, len(links))
	for _, link := range links {
		d, err := s.store.GetDriver(link.DriverNumber)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		drivers = append(drivers, driverToModel(sessionKey, sess.MeetingKey, link, d))
	}
	return drivers, nil
}

func derivedDriverStandings(points map[int]float64, meetingKey, sessionKey int) []models.ChampionshipDriver {
	drivers := make([]models.ChampionshipDriver, 0, len(points))
	for num, pts := range points {
		drivers = append(drivers, models.ChampionshipDriver{
			DriverNumber:  num,
			MeetingKey:    meetingKey,
			PointsCurrent: pts,
			SessionKey:    sessionKey,
		})
	}
	sort.Slice(drivers, func(i, j int) bool {
		if drivers[i].PointsCurrent == drivers[j].PointsCurrent {
			return drivers[i].DriverNumber < drivers[j].DriverNumber
		}
		return drivers[i].PointsCurrent > drivers[j].PointsCurrent
	})
	for i := range drivers {
		drivers[i].PositionCurrent = i + 1
	}
	return drivers
}

func derivedTeamStandings(points map[string]float64, meetingKey, sessionKey int) []models.ChampionshipTeam {
	teams := make([]models.ChampionshipTeam, 0, len(points))
	for name, pts := range points {
		teams = append(teams, models.ChampionshipTeam{
			TeamName:      name,
			MeetingKey:    meetingKey,
			PointsCurrent: pts,
			SessionKey:    sessionKey,
		})
	}
	sort.Slice(teams, func(i, j int) bool {
		if teams[i].PointsCurrent == teams[j].PointsCurrent {
			return teams[i].TeamName < teams[j].TeamName
		}
		return teams[i].PointsCurrent > teams[j].PointsCurrent
	})
	for i := range teams {
		teams[i].PositionCurrent = i + 1
	}
	return teams
}
