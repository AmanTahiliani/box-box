package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/AmanTahiliani/box-box/internal/models"
)

// get performs a GET request and returns the response body, or an error if the
// status code is not 200 OK. It checks a local file cache before making the request.
func (c *OpenF1Client) get(url string) (io.ReadCloser, error) {
	if cachedData, ok := c.cache.Get(url); ok {
		return io.NopCloser(bytes.NewReader(cachedData)), nil
	}

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openf1 API returned status %d for %s", resp.StatusCode, url)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Save to cache (ignoring errors as cache is not critical)
	_ = c.cache.Set(url, data)

	return io.NopCloser(bytes.NewReader(data)), nil
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

// getLatestRaceSessionKey returns the session_key of the most recent Race session
// by fetching sessions filtered to session_name=Race and returning the last one.
func (c *OpenF1Client) getLatestRaceSessionKey() (int, error) {
	body, err := c.get(fmt.Sprintf("%s/v1/sessions?session_name=Race", c.url))
	if err != nil {
		return 0, err
	}
	defer body.Close()

	var sessions []models.Session
	if err := json.NewDecoder(body).Decode(&sessions); err != nil {
		return 0, err
	}
	if len(sessions) == 0 {
		return 0, errors.New("no Race sessions found")
	}
	return sessions[len(sessions)-1].SessionKey, nil
}

// getLatestRaceSessionKeyForYear returns the session_key of the most recent Race session
// for a specific year.
func (c *OpenF1Client) getLatestRaceSessionKeyForYear(year int) (int, error) {
	// The OpenF1 API doesn't support a direct year filter on sessions yet (verified by docs/common patterns)
	// so we'll fetch meetings for that year first, then find the latest session.
	// Actually, session endpoint does support year filter according to some versions of docs.
	// Let's try year filter first as it's more efficient.
	body, err := c.get(fmt.Sprintf("%s/v1/sessions?session_name=Race&year=%d", c.url, year))
	if err != nil {
		return 0, err
	}
	defer body.Close()

	var sessions []models.Session
	if err := json.NewDecoder(body).Decode(&sessions); err != nil {
		return 0, err
	}
	if len(sessions) == 0 {
		return 0, fmt.Errorf("no Race sessions found for year %d", year)
	}
	return sessions[len(sessions)-1].SessionKey, nil
}

// GetLatestDriverChampionship returns championship standings for the most recent
// Race session. It resolves the latest session key automatically.
func (c *OpenF1Client) GetLatestDriverChampionship() ([]models.ChampionshipDriver, error) {
	sessionKey, err := c.getLatestRaceSessionKey()
	if err != nil {
		return nil, fmt.Errorf("could not resolve latest race session: %w", err)
	}
	return c.GetDriverChampionship(sessionKey)
}

func (c *OpenF1Client) GetDriverChampionshipForYear(year int) ([]models.ChampionshipDriver, error) {
	sessionKey, err := c.getLatestRaceSessionKeyForYear(year)
	if err != nil {
		return nil, fmt.Errorf("could not resolve latest race session for year %d: %w", year, err)
	}
	return c.GetDriverChampionship(sessionKey)
}

func (c *OpenF1Client) GetLatestTeamChampionship() ([]models.ChampionshipTeam, error) {
	sessionKey, err := c.getLatestRaceSessionKey()
	if err != nil {
		return nil, fmt.Errorf("could not resolve latest race session: %w", err)
	}
	return c.GetTeamChampionship(sessionKey)
}

func (c *OpenF1Client) GetTeamChampionshipForYear(year int) ([]models.ChampionshipTeam, error) {
	sessionKey, err := c.getLatestRaceSessionKeyForYear(year)
	if err != nil {
		return nil, fmt.Errorf("could not resolve latest race session for year %d: %w", year, err)
	}
	return c.GetTeamChampionship(sessionKey)
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
