// seed-e2e-db creates a deterministic SQLite database for Playwright e2e tests.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/AmanTahiliani/box-box/internal/store"
)

func main() {
	dbPath := flag.String("db", ".playwright/boxbox-e2e.db", "path to e2e database file")
	flag.Parse()

	if err := os.MkdirAll(filepath.Dir(*dbPath), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "mkdir: %v\n", err)
		os.Exit(1)
	}
	_ = os.Remove(*dbPath)

	st, err := store.Open(*dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open db: %v\n", err)
		os.Exit(1)
	}
	defer st.Close()

	const meetingKey = 1229
	const fullSessionKey = 9472
	const coreOnlySessionKey = 9000

	if err := seedMeeting(st, meetingKey); err != nil {
		fail(err)
	}
	if err := seedSession(st, fullSessionKey, meetingKey, "Race"); err != nil {
		fail(err)
	}
	if err := seedSession(st, coreOnlySessionKey, meetingKey, "Core Only"); err != nil {
		fail(err)
	}

	if err := seedDrivers(st, fullSessionKey, meetingKey); err != nil {
		fail(err)
	}
	if err := seedDrivers(st, coreOnlySessionKey, meetingKey); err != nil {
		fail(err)
	}

	if err := seedCoreResults(st, fullSessionKey, meetingKey); err != nil {
		fail(err)
	}
	if err := seedCoreResults(st, coreOnlySessionKey, meetingKey); err != nil {
		fail(err)
	}

	if err := seedAnalytics(st, fullSessionKey, meetingKey); err != nil {
		fail(err)
	}

	fmt.Printf("seeded e2e db at %s\n", *dbPath)
}

func fail(err error) {
	fmt.Fprintf(os.Stderr, "seed error: %v\n", err)
	os.Exit(1)
}

func seedMeeting(st *store.Store, meetingKey int) error {
	return st.UpsertMeeting(store.Meeting{
		MeetingKey:          meetingKey,
		MeetingName:         "Monaco",
		MeetingOfficialName: "FORMULA 1 GRAND PRIX DE MONACO 2025",
		Location:            "Monaco",
		CountryCode:         "MON",
		CountryName:         "Monaco",
		CircuitKey:          10,
		CircuitShortName:    "Monaco",
		Year:                2025,
		DateStart:           "2025-05-23T00:00:00+00:00",
		DateEnd:             "2025-05-25T00:00:00+00:00",
	})
}

func seedSession(st *store.Store, sessionKey, meetingKey int, name string) error {
	start, end := "2025-05-25T13:00:00+00:00", "2025-05-25T15:00:00+00:00"
	// Core-only is an earlier weekend session so Weekend Context's
	// default_analysis_session prefers the later full Race.
	if name == "Core Only" {
		start, end = "2025-05-24T13:00:00+00:00", "2025-05-24T15:00:00+00:00"
	}
	return st.UpsertSession(store.Session{
		SessionKey:  sessionKey,
		MeetingKey:  meetingKey,
		SessionName: name,
		SessionType: "Race",
		CircuitKey:  10,
		DateStart:   start,
		DateEnd:     end,
	})
}

func seedDrivers(st *store.Store, sessionKey, meetingKey int) error {
	drivers := []store.Driver{
		{
			DriverNumber: 1,
			FullName:     "Max Verstappen",
			NameAcronym:  "VER",
			TeamName:     "Red Bull Racing",
			TeamColour:   "3671C6",
		},
		{
			DriverNumber: 44,
			FullName:     "Lewis Hamilton",
			NameAcronym:  "HAM",
			TeamName:     "Ferrari",
			TeamColour:   "E8002D",
		},
	}
	for _, d := range drivers {
		if err := st.UpsertDriver(d); err != nil {
			return err
		}
		if err := st.UpsertSessionDriver(store.SessionDriver{
			SessionKey:   sessionKey,
			DriverNumber: d.DriverNumber,
			MeetingKey:   meetingKey,
			TeamName:     d.TeamName,
			TeamColour:   d.TeamColour,
		}); err != nil {
			return err
		}
	}
	return nil
}

func seedCoreResults(st *store.Store, sessionKey, meetingKey int) error {
	results := []store.SessionResult{
		{
			SessionKey: sessionKey, DriverNumber: 1, MeetingKey: meetingKey,
			Position: 1, Points: 25, NumberOfLaps: 78,
		},
		{
			SessionKey: sessionKey, DriverNumber: 44, MeetingKey: meetingKey,
			Position: 2, Points: 18, NumberOfLaps: 78,
		},
	}
	for _, r := range results {
		if err := st.UpsertSessionResult(r); err != nil {
			return err
		}
	}

	grid := []store.StartingGridEntry{
		{SessionKey: sessionKey, DriverNumber: 1, MeetingKey: meetingKey, Position: 1, LapDuration: 71.234},
		{SessionKey: sessionKey, DriverNumber: 44, MeetingKey: meetingKey, Position: 2, LapDuration: 71.456},
	}
	for _, g := range grid {
		if err := st.UpsertStartingGridEntry(g); err != nil {
			return err
		}
	}
	return nil
}

func seedAnalytics(st *store.Store, sessionKey, meetingKey int) error {
	stints := []store.Stint{
		{
			SessionKey: sessionKey, DriverNumber: 1, MeetingKey: meetingKey,
			StintNumber: 1, Compound: "MEDIUM", LapStart: 1, LapEnd: 30,
		},
		{
			SessionKey: sessionKey, DriverNumber: 44, MeetingKey: meetingKey,
			StintNumber: 1, Compound: "SOFT", LapStart: 1, LapEnd: 18,
		},
	}
	for _, stnt := range stints {
		if err := st.UpsertStint(stnt); err != nil {
			return err
		}
	}

	if err := st.UpsertPitStop(store.PitStop{
		SessionKey: sessionKey, DriverNumber: 44, MeetingKey: meetingKey,
		LapNumber: 19, Date: "2025-05-25T14:00:00+00:00", StopDuration: 2.4,
	}); err != nil {
		return err
	}

	positions := []store.PositionSample{
		{SessionKey: sessionKey, DriverNumber: 1, MeetingKey: meetingKey, Date: "2025-05-25T13:05:00+00:00", Position: 1},
		{SessionKey: sessionKey, DriverNumber: 1, MeetingKey: meetingKey, Date: "2025-05-25T13:10:00+00:00", Position: 1},
		{SessionKey: sessionKey, DriverNumber: 44, MeetingKey: meetingKey, Date: "2025-05-25T13:05:00+00:00", Position: 2},
	}
	for _, p := range positions {
		if err := st.UpsertPositionSample(p); err != nil {
			return err
		}
	}

	if err := st.UpsertRaceControlMessage(store.RaceControlMessage{
		SessionKey: sessionKey, MeetingKey: meetingKey,
		Date: "2025-05-25T13:01:00+00:00", Category: "Flag", Flag: "GREEN",
		Message: "Green light", Scope: "Track",
	}); err != nil {
		return err
	}

	if err := st.UpsertWeatherSample(store.WeatherSample{
		SessionKey: sessionKey, MeetingKey: meetingKey,
		Date: "2025-05-25T13:00:00+00:00", AirTemperature: 22.0, TrackTemperature: 34.0,
	}); err != nil {
		return err
	}

	if err := st.UpsertLap(store.Lap{
		SessionKey: sessionKey, DriverNumber: 1, MeetingKey: meetingKey,
		LapNumber: 1, LapDuration: 75.1,
	}); err != nil {
		return err
	}

	return nil
}
