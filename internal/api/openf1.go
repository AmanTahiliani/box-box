package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/AmanTahiliani/box-box/internal/models"
)

// get performs a GET request and returns the response body, or an error if the
// status code is not 200 OK.
func (c *OpenF1Client) get(url string) (io.ReadCloser, error) {
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("openf1 API returned status %d for %s", resp.StatusCode, url)
	}
	return resp.Body, nil
}

func (c *OpenF1Client) GetMeetingsForYear(year int) ([]models.Meeting, error) {
	if year < 2023 {
		return nil, errors.New("Invalid year: " + strconv.Itoa(year) + ". Year must be 2023 or later.")
	}
	body, err := c.get(fmt.Sprintf("%s/v1/meetings?year=%d", c.url, year))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Meeting
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetSessionsForMeeting(meetingKey int) ([]models.Session, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/sessions?meeting_key=%d", c.url, meetingKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Session
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetDriversForSession(sessionKey int) ([]models.Driver, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/drivers?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Driver
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetDriver(sessionKey, driverNumber int) (*models.Driver, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/drivers?session_key=%d&driver_number=%d", c.url, sessionKey, driverNumber))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Driver
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	if len(result) == 0 {
		return nil, nil
	}
	return &result[0], nil
}

func (c *OpenF1Client) GetDriverChampionship(sessionKey int) ([]models.ChampionshipDriver, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/championship_drivers?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.ChampionshipDriver
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetTeamChampionship(sessionKey int) ([]models.ChampionshipTeam, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/championship_teams?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.ChampionshipTeam
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetLatestDriverChampionship returns championship standings for the most recent
// race session. Note: requires the caller to supply a recent race session_key;
// the OpenF1 API does not support a "latest" shortcut for this endpoint.
func (c *OpenF1Client) GetLatestDriverChampionship() ([]models.ChampionshipDriver, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/championship_drivers?session_key=latest", c.url))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.ChampionshipDriver
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetLatestTeamChampionship() ([]models.ChampionshipTeam, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/championship_teams?session_key=latest", c.url))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.ChampionshipTeam
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetSessionResult(sessionKey int) ([]models.SessionResult, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/session_result?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.SessionResult
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetStartingGrid(sessionKey int) ([]models.StartingGrid, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/starting_grid?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.StartingGrid
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetLapsForSession(sessionKey int) ([]models.Lap, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/laps?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Lap
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetLapsForDriver(sessionKey, driverNumber int) ([]models.Lap, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/laps?session_key=%d&driver_number=%d", c.url, sessionKey, driverNumber))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Lap
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetStintsForSession(sessionKey int) ([]models.Stint, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/stints?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Stint
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetPitStopsForSession(sessionKey int) ([]models.Pit, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/pit?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Pit
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetOvertakesForSession(sessionKey int) ([]models.Overtake, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/overtakes?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Overtake
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetPositions(sessionKey, driverNumber int) ([]models.Position, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/position?session_key=%d&driver_number=%d", c.url, sessionKey, driverNumber))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Position
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetIntervals(sessionKey, driverNumber int) ([]models.Interval, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/intervals?session_key=%d&driver_number=%d", c.url, sessionKey, driverNumber))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Interval
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetRaceControl(sessionKey int) ([]models.RaceControl, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/race_control?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.RaceControl
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetWeather(sessionKey int) ([]models.Weather, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/weather?session_key=%d", c.url, sessionKey))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Weather
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetCarData(sessionKey, driverNumber int) ([]models.CarData, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/car_data?session_key=%d&driver_number=%d", c.url, sessionKey, driverNumber))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.CarData
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetLocation(sessionKey, driverNumber int) ([]models.Location, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/location?session_key=%d&driver_number=%d", c.url, sessionKey, driverNumber))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.Location
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *OpenF1Client) GetTeamRadio(sessionKey, driverNumber int) ([]models.TeamRadio, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/team_radio?session_key=%d&driver_number=%d", c.url, sessionKey, driverNumber))
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var result []models.TeamRadio
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}
