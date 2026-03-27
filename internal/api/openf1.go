package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

// ErrLiveSessionLocked is returned when the OpenF1 API blocks free-tier access
// during a live F1 session. All endpoints (including historical data) return 401
// from ~30 min before a session starts until ~30 min after it ends.
var ErrLiveSessionLocked = errors.New("live F1 session in progress — API access is restricted to authenticated users until the session ends")

// IsLiveSessionError reports whether err (or any error in its chain) is the
// live-session lockout error from the OpenF1 API.
func IsLiveSessionError(err error) bool {
	return errors.Is(err, ErrLiveSessionLocked)
}

// get performs a GET request and returns the response body, or an error if the
// status code is not 200 OK. It checks a local file cache before making the request.
func (c *OpenF1Client) get(url string) (io.ReadCloser, error) {
	if cachedData, ok := c.cache.Get(url); ok {
		return io.NopCloser(bytes.NewReader(cachedData)), nil
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Try to parse the JSON error body for a better message.
		if resp.StatusCode == http.StatusUnauthorized {
			body, _ := io.ReadAll(resp.Body)
			var apiErr struct {
				Detail string `json:"detail"`
			}
			if json.Unmarshal(body, &apiErr) == nil && apiErr.Detail != "" {
				detail := strings.ToLower(apiErr.Detail)
				if strings.Contains(detail, "live") && strings.Contains(detail, "session") {
					return nil, fmt.Errorf("%w", ErrLiveSessionLocked)
				}
				return nil, fmt.Errorf("openf1 API: %s", apiErr.Detail)
			}
		}
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

// getLatestRaceSessionKey returns the session_key of the most recent completed
// Race session across all years.
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

	// Walk backwards to find the most recent completed race.
	now := time.Now()
	for i := len(sessions) - 1; i >= 0; i-- {
		s := sessions[i]
		if s.DateEnd != "" {
			endTime, err := time.Parse(time.RFC3339, s.DateEnd)
			if err == nil && endTime.Before(now) {
				return s.SessionKey, nil
			}
		} else if s.DateStart != "" {
			startTime, err := time.Parse(time.RFC3339, s.DateStart)
			if err == nil && startTime.Add(3*time.Hour).Before(now) {
				return s.SessionKey, nil
			}
		}
	}

	return 0, errors.New("no completed Race sessions found")
}

// getLatestRaceSessionKeyForYear returns the session_key of the most recent
// completed Race session for a specific year. It walks backwards through the
// year's races to find one whose date_end is in the past (i.e. has results).
func (c *OpenF1Client) getLatestRaceSessionKeyForYear(year int) (int, error) {
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

	// Walk backwards to find the most recent completed race.
	now := time.Now()
	for i := len(sessions) - 1; i >= 0; i-- {
		s := sessions[i]
		if s.DateEnd != "" {
			endTime, err := time.Parse(time.RFC3339, s.DateEnd)
			if err == nil && endTime.Before(now) {
				return s.SessionKey, nil
			}
		} else if s.DateStart != "" {
			// Fallback: if no DateEnd, check DateStart + 3 hours as a rough estimate.
			startTime, err := time.Parse(time.RFC3339, s.DateStart)
			if err == nil && startTime.Add(3*time.Hour).Before(now) {
				return s.SessionKey, nil
			}
		}
	}

	return 0, fmt.Errorf("no completed Race sessions found for year %d", year)
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
	url := fmt.Sprintf("%s/v1/position?session_key=%d", c.url, sessionKey)
	if driverNumber != 0 {
		url += fmt.Sprintf("&driver_number=%d", driverNumber)
	}
	body, err := c.get(url)
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
	url := fmt.Sprintf("%s/v1/intervals?session_key=%d", c.url, sessionKey)
	if driverNumber != 0 {
		url += fmt.Sprintf("&driver_number=%d", driverNumber)
	}
	body, err := c.get(url)
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
