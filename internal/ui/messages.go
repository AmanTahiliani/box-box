package ui

import "github.com/AmanTahiliani/box-box/internal/models"

// driverChampionshipLoadedMsg carries the loaded driver championship data.
type driverChampionshipLoadedMsg struct {
	standings []models.ChampionshipDriver
	err       error
}

// teamChampionshipLoadedMsg carries the loaded team championship data.
type teamChampionshipLoadedMsg struct {
	standings []models.ChampionshipTeam
	err       error
}

// standingsDriversLoadedMsg carries drivers for the standings join.
type standingsDriversLoadedMsg struct {
	drivers []models.Driver
	err     error
}

// meetingsLoadedMsg carries the full meeting list for the calendar.
type meetingsLoadedMsg struct {
	meetings []models.Meeting
	err      error
}

// sessionsLoadedMsg carries sessions for a selected meeting.
type sessionsLoadedMsg struct {
	sessions []models.Session
	err      error
}

// sessionResultsLoadedMsg carries results for a selected session.
type sessionResultsLoadedMsg struct {
	results []models.SessionResult
	err     error
}

// sessionDriversLoadedMsg carries drivers for a selected session.
type sessionDriversLoadedMsg struct {
	drivers []models.Driver
	err     error
}

// raceControlLoadedMsg carries race control messages for a session.
type raceControlLoadedMsg struct {
	messages []models.RaceControl
	err      error
}

// weatherLoadedMsg carries weather data for a session.
type weatherLoadedMsg struct {
	weather []models.Weather
	err     error
}

// driverListLoadedMsg carries all drivers for the driver tab.
type driverListLoadedMsg struct {
	drivers []models.Driver
	err     error
}

// driverStintsLoadedMsg carries stints for a selected driver.
type driverStintsLoadedMsg struct {
	stints []models.Stint
	err    error
}

// driverLapsLoadedMsg carries laps for a selected driver.
type driverLapsLoadedMsg struct {
	laps []models.Lap
	err  error
}

// driverPitsLoadedMsg carries pit stops for a selected driver.
type driverPitsLoadedMsg struct {
	pits []models.Pit
	err  error
}

// driverPositionsLoadedMsg carries position history for a selected driver.
type driverPositionsLoadedMsg struct {
	positions []models.Position
	err       error
}

// driverTeamRadioLoadedMsg carries team radio messages for a selected driver.
type driverTeamRadioLoadedMsg struct {
	radios []models.TeamRadio
	err    error
}

// driverRaceControlLoadedMsg carries race control messages for a selected driver.
type driverRaceControlLoadedMsg struct {
	messages []models.RaceControl
	err      error
}

// overtakesLoadedMsg carries overtake data for a session.
type overtakesLoadedMsg struct {
	overtakes []models.Overtake
	err       error
}

// meetingSelectedMsg is emitted when the user selects a meeting in the calendar.
type meetingSelectedMsg struct {
	meeting models.Meeting
}

// driverSelectedMsg is emitted when the user selects a driver in the driver tab.
type driverSelectedMsg struct {
	driver     models.Driver
	sessionKey int
}

// startingGridLoadedMsg carries starting grid data for a session.
type startingGridLoadedMsg struct {
	grid []models.StartingGrid
	err  error
}

// loadSecondaryDataMsg triggers loading of secondary session data (race control, weather, overtakes)
// after the primary data (results, drivers) has arrived.
type loadSecondaryDataMsg struct {
	sessionKey int
}
