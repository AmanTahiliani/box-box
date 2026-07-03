package live_test

import (
	"bytes"
	"compress/flate"
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/live"
)

func TestProcessMessageFullState(t *testing.T) {
	state := live.NewState()
	msg := []byte(`{
		"R": {
			"TimingData": {"Lines": {"1": {"Position": "1", "RacingNumber": "1", "LastLapTime": {"Value": "1:32.456"}}}},
			"DriverList": {"1": {"RacingNumber": "1", "Tla": "VER", "TeamName": "Red Bull"}},
			"LapCount": {"CurrentLap": 12, "TotalLaps": 57},
			"TrackStatus": {"Status": "1", "Message": "AllClear"},
			"WeatherData": {"AirTemp": "24.5", "TrackTemp": "38.0", "Humidity": "55", "WindSpeed": "2.1", "WindDirection": "180", "Rainfall": "0"},
			"SessionInfo": {"Meeting": {"Name": "Monaco Grand Prix"}, "Name": "Race", "Type": "Race"},
			"ExtrapolatedClock": {"Remaining": "0:45:00", "Utc": "2025-05-25T14:00:00Z", "Extrapolating": true}
		}
	}`)

	if !state.ProcessMessage(msg) {
		t.Fatal("expected full-state message to produce updates")
	}

	snap := state.Snapshot()
	if snap.Drivers["1"].Position != 1 {
		t.Errorf("driver position = %d, want 1", snap.Drivers["1"].Position)
	}
	if snap.Drivers["1"].LastLapTime != "1:32.456" {
		t.Errorf("last lap = %q, want 1:32.456", snap.Drivers["1"].LastLapTime)
	}
	if snap.DriverInfo["1"].Tla != "VER" {
		t.Errorf("TLA = %q, want VER", snap.DriverInfo["1"].Tla)
	}
	if snap.CurrentLap != 12 || snap.TotalLaps != 57 {
		t.Errorf("laps = %d/%d, want 12/57", snap.CurrentLap, snap.TotalLaps)
	}
	if snap.TrackStatus != "1" {
		t.Errorf("track status = %q, want 1", snap.TrackStatus)
	}
	if snap.Weather.AirTemp != 24.5 || snap.Weather.TrackTemp != 38.0 {
		t.Errorf("weather temps = %.1f/%.1f, want 24.5/38.0", snap.Weather.AirTemp, snap.Weather.TrackTemp)
	}
	if snap.Session.MeetingName != "Monaco Grand Prix" || snap.Session.SessionName != "Race" {
		t.Errorf("session = %+v", snap.Session)
	}
	if snap.Clock != "0:45:00" || !snap.ClockExtrapolating {
		t.Errorf("clock = %q extrapolating=%v", snap.Clock, snap.ClockExtrapolating)
	}
}

func TestProcessMessageIncremental(t *testing.T) {
	state := live.NewState()
	msg := []byte(`{
		"M": [{
			"A": ["TimingData", {"Lines": {"44": {"Position": "2", "GapToLeader": "+1.234", "IntervalToPositionAhead": {"Value": "+0.456"}}}}]
		}]
	}`)

	if !state.ProcessMessage(msg) {
		t.Fatal("expected incremental message to produce updates")
	}

	d := state.Snapshot().Drivers["44"]
	if d.Position != 2 {
		t.Errorf("position = %d, want 2", d.Position)
	}
	if d.GapToLeader != "+1.234" {
		t.Errorf("gap = %q, want +1.234", d.GapToLeader)
	}
	if d.Interval != "+0.456" {
		t.Errorf("interval = %q, want +0.456", d.Interval)
	}
}

func TestProcessCoreMessageCompletionAndFeed(t *testing.T) {
	state := live.NewState()
	msg := []byte(`{"type":3,"invocationId":"1","result":{
		"ExtrapolatedClock":{"Remaining":"00:04:23","Utc":"2026-06-06T14:42:36.0491737Z","Extrapolating":true},
		"TimingData":{"Lines":{"12":{"Position":"1","RacingNumber":"12","Sectors":[{"Value":"22.430"},{"Value":"40.119"},{"Value":""}],"Speeds":{"ST":{"Value":"254"}},"BestLapTime":{"Value":"1:12.704","Lap":15}}}},
		"DriverList":{"12":{"RacingNumber":"12","Tla":"ANT","TeamName":"Mercedes","TeamColour":"00D7B6"}}
	}}` + "\x1e")

	if !state.ProcessCoreMessage(msg) {
		t.Fatal("expected SignalR Core completion to produce updates")
	}

	snap := state.Snapshot()
	if snap.Clock != "00:04:23" || !snap.ClockExtrapolating {
		t.Errorf("clock = %q extrapolating=%v", snap.Clock, snap.ClockExtrapolating)
	}
	if snap.Drivers["12"].Position != 1 || snap.Drivers["12"].BestLapTime != "1:12.704" {
		t.Errorf("driver = %+v", snap.Drivers["12"])
	}
	if snap.Drivers["12"].Sectors[1].Value != "40.119" || snap.Drivers["12"].SpeedTrap != "254" {
		t.Errorf("driver sectors/speed = %+v", snap.Drivers["12"])
	}
	if snap.DriverInfo["12"].Tla != "ANT" {
		t.Errorf("driver info = %+v", snap.DriverInfo["12"])
	}

	feed := []byte(`{"type":1,"target":"feed","arguments":["TimingData",{"Lines":{"12":{"LastLapTime":{"Value":"1:13.000","PersonalFastest":true}}}},"2026-06-06T14:42:37Z"]}` + "\x1e")
	if !state.ProcessCoreMessage(feed) {
		t.Fatal("expected SignalR Core feed frame to produce updates")
	}
	if state.Snapshot().Drivers["12"].LastLapTime != "1:13.000" {
		t.Errorf("last lap = %q", state.Snapshot().Drivers["12"].LastLapTime)
	}
}

func TestProcessTopicTimingData(t *testing.T) {
	state := live.NewState()
	data := json.RawMessage(`{
		"Lines": {
			"16": {
				"Position": 3,
				"GapToLeader": 2.5,
				"NumberOfLaps": "15",
				"Sectors": {
					"0": {"Value": "28.123", "PersonalFastest": true},
					"1": {"Value": "31.456"},
					"2": {"Value": ""}
				},
				"Speeds": {"ST": {"Value": "312"}}
			}
		}
	}`)

	if !state.ProcessTopic("TimingData", data) {
		t.Fatal("TimingData should update state")
	}

	d := state.Snapshot().Drivers["16"]
	if d.Position != 3 {
		t.Errorf("position = %d, want 3", d.Position)
	}
	if d.GapToLeader != "+2.500" {
		t.Errorf("gap = %q, want +2.500", d.GapToLeader)
	}
	if d.NumberOfLaps != 15 {
		t.Errorf("laps = %d, want 15", d.NumberOfLaps)
	}
	if d.Sectors[0].Value != "28.123" || !d.Sectors[0].PersonalFastest {
		t.Errorf("sector 0 = %+v", d.Sectors[0])
	}
	if d.Sectors[2].Value != "" {
		t.Errorf("sector 2 should be cleared, got %q", d.Sectors[2].Value)
	}
	if !d.OnFlyingLap {
		t.Error("expected OnFlyingLap=true when S1/S2 set and S3 empty")
	}
	if d.SpeedTrap != "312" {
		t.Errorf("speed trap = %q, want 312", d.SpeedTrap)
	}
}

func TestProcessTopicCompressedPositionAndCarData(t *testing.T) {
	state := live.NewState()
	positionPayload := `{
		"Position": [
			{"Timestamp": "2026-07-03T14:00:00Z", "Entries": {
				"1": {"Status": "OnTrack", "X": 1000, "Y": -200, "Z": 3},
				"44": {"Status": "OffTrack", "X": 1200, "Y": -250, "Z": 2}
			}}
		]
	}`
	if !state.ProcessTopic("Position.z", encodedDeflatePayload(t, positionPayload)) {
		t.Fatal("Position.z should update state")
	}

	snap := state.Snapshot()
	if !snap.PositionUpdated || snap.SnapshotUpdated {
		t.Fatalf("position flags = position:%v snapshot:%v", snap.PositionUpdated, snap.SnapshotUpdated)
	}
	if got := snap.Positions["1"]; got.X != 1000 || got.Y != -200 || got.Z != 3 || got.Status != "OnTrack" {
		t.Fatalf("position 1 = %+v", got)
	}
	if got := snap.Positions["44"]; got.Status != "OffTrack" {
		t.Fatalf("position 44 = %+v", got)
	}

	carPayload := `{
		"Entries": [
			{"Utc": "2026-07-03T14:00:00Z", "Cars": {
				"1": {"Channels": {"0": 11234, "2": 318, "3": 8, "4": 92, "5": 0, "45": 10}}
			}}
		]
	}`
	if !state.ProcessTopic("CarData.z", encodedDeflatePayload(t, carPayload)) {
		t.Fatal("CarData.z should update state")
	}
	snap = state.Snapshot()
	if !snap.SnapshotUpdated {
		t.Fatal("CarData should mark snapshot updated")
	}
	tel := snap.Telemetry["1"]
	if tel.RPM != 11234 || tel.Speed != 318 || tel.NGear != 8 || tel.Throttle != 92 || tel.Brake != 0 || tel.DRS != 10 {
		t.Fatalf("telemetry = %+v", tel)
	}
}

func TestProcessTopicSessionInfoCircuitName(t *testing.T) {
	state := live.NewState()
	state.ProcessTopic("SessionInfo", json.RawMessage(`{
		"Meeting": {"Name": "British Grand Prix", "Circuit": {"ShortName": "Silverstone"}},
		"Name": "Race",
		"Type": "Race"
	}`))
	s := state.Snapshot().Session
	if s.MeetingName != "British Grand Prix" || s.CircuitName != "Silverstone" {
		t.Fatalf("session = %+v", s)
	}
}

func TestProcessTopicDriverList(t *testing.T) {
	state := live.NewState()
	data := json.RawMessage(`{"63": {"RacingNumber": "63", "Tla": "RUS", "TeamName": "Mercedes", "TeamColour": "27F4D2"}}`)

	state.ProcessTopic("DriverList", data)
	if len(state.Snapshot().DriverInfo) != 1 {
		t.Fatalf("expected 1 driver info entry")
	}

	// Entries without TLA are ignored.
	data2 := json.RawMessage(`{"99": {"RacingNumber": "99", "TeamName": "Unknown"}}`)
	state.ProcessTopic("DriverList", data2)
	if _, ok := state.Snapshot().DriverInfo["99"]; ok {
		t.Error("driver without TLA should be ignored")
	}
}

func TestProcessTopicLapCount(t *testing.T) {
	state := live.NewState()
	data := json.RawMessage(`{"CurrentLap": "5", "TotalLaps": "78"}`)
	state.ProcessTopic("LapCount", data)
	snap := state.Snapshot()
	if snap.CurrentLap != 5 || snap.TotalLaps != 78 {
		t.Errorf("laps = %d/%d, want 5/78", snap.CurrentLap, snap.TotalLaps)
	}
}

func TestProcessTopicExtrapolatedClock(t *testing.T) {
	state := live.NewState()
	data := json.RawMessage(`{"Remaining": "1:00:00", "Utc": "2025-05-25T15:04:05.123Z", "Extrapolating": true}`)
	state.ProcessTopic("ExtrapolatedClock", data)
	snap := state.Snapshot()
	if snap.Clock != "1:00:00" || !snap.ClockExtrapolating {
		t.Errorf("clock = %q extrapolating=%v", snap.Clock, snap.ClockExtrapolating)
	}
	want := time.Date(2025, 5, 25, 15, 4, 5, 123000000, time.UTC)
	if !snap.ClockRefTime.Equal(want) {
		t.Errorf("ClockRefTime = %v, want %v", snap.ClockRefTime, want)
	}
}

func TestProcessTopicTrackStatus(t *testing.T) {
	state := live.NewState()
	state.ProcessTopic("TrackStatus", json.RawMessage(`{"Status": "4", "Message": "SC DEPLOYED"}`))
	if state.Snapshot().TrackStatus != "4" {
		t.Errorf("track status = %q, want 4", state.Snapshot().TrackStatus)
	}
}

func TestProcessTopicRaceControlMessages(t *testing.T) {
	state := live.NewState()
	data := json.RawMessage(`{
		"Messages": {
			"1": {"Utc": "2025-05-25T15:04:30Z", "Category": "Flag", "Flag": "YELLOW", "Message": "Yellow in sector 2", "Lap": 8}
		}
	}`)
	state.ProcessTopic("RaceControlMessages", data)
	rc := state.Snapshot().RCMessages
	if len(rc) != 1 {
		t.Fatalf("expected 1 RC message, got %d", len(rc))
	}
	if rc[0].Time != "15:04" || rc[0].Flag != "YELLOW" || rc[0].Message != "Yellow in sector 2" || rc[0].Lap != 8 {
		t.Errorf("RC message = %+v", rc[0])
	}
}

func TestProcessTopicWeatherData(t *testing.T) {
	state := live.NewState()
	state.ProcessTopic("WeatherData", json.RawMessage(`{
		"AirTemp": 22, "TrackTemp": 35, "Humidity": 60, "WindSpeed": 3.5, "WindDirection": 90, "Rainfall": 1
	}`))
	w := state.Snapshot().Weather
	if w.AirTemp != 22 || w.TrackTemp != 35 || w.Humidity != 60 || w.WindSpeed != 3.5 || w.WindDir != 90 || !w.Rainfall {
		t.Errorf("weather = %+v", w)
	}
}

func TestProcessTopicSessionInfo(t *testing.T) {
	state := live.NewState()
	state.ProcessTopic("SessionInfo", json.RawMessage(`{
		"Meeting": {"Name": "British Grand Prix"},
		"Name": "Qualifying",
		"Type": "Qualifying"
	}`))
	s := state.Snapshot().Session
	if s.MeetingName != "British Grand Prix" || s.SessionName != "Qualifying" || s.SessionType != "Qualifying" {
		t.Errorf("session = %+v", s)
	}
}

func TestProcessTopicCurrentTyres(t *testing.T) {
	state := live.NewState()
	state.Tyres["1"] = live.LiveTyreData{Age: 7}
	state.ProcessTopic("CurrentTyres", json.RawMessage(`{
		"1": {"Compound": "SOFT", "New": "true"},
		"_kf": {"Compound": "ignore"}
	}`))
	tyre := state.Snapshot().Tyres["1"]
	if tyre.Compound != "SOFT" || !tyre.New {
		t.Errorf("tyre = %+v", tyre)
	}
	if tyre.Age != 7 {
		t.Errorf("age should be preserved from prior state, got %d", tyre.Age)
	}
}

func TestProcessTopicTimingAppData(t *testing.T) {
	state := live.NewState()
	data := json.RawMessage(`{
		"Lines": {
			"4": {
				"Stints": {
					"0": {"Compound": "MEDIUM", "New": "true", "TotalLaps": 0},
					"1": {"Compound": "HARD", "New": "false", "TotalLaps": 18}
				}
			}
		}
	}`)
	state.ProcessTopic("TimingAppData", data)
	snap := state.Snapshot()
	stints := snap.Stints["4"]
	if len(stints) != 2 {
		t.Fatalf("expected 2 stints, got %d", len(stints))
	}
	tyre := snap.Tyres["4"]
	if tyre.Compound != "HARD" || tyre.Age != 18 || tyre.New {
		t.Errorf("tyre synced from stint = %+v", tyre)
	}
}

func TestProcessTopicTimingStats(t *testing.T) {
	state := live.NewState()
	state.Drivers["55"] = live.LiveDriverData{RacingNumber: "55"}
	state.ProcessTopic("TimingStats", json.RawMessage(`{
		"Lines": {"55": {"PersonalBestLapTime": {"Value": "1:28.999"}}}
	}`))
	if state.Snapshot().Drivers["55"].BestLapTime != "1:28.999" {
		t.Errorf("best lap = %q", state.Snapshot().Drivers["55"].BestLapTime)
	}
}

func TestProcessTopicUnknownIgnored(t *testing.T) {
	state := live.NewState()
	if state.ProcessTopic("Heartbeat", json.RawMessage(`{"Seq": 1}`)) {
		t.Error("unknown topic should not mark state updated")
	}
	if state.ProcessTopic("TotallyUnknown", json.RawMessage(`{"foo": "bar"}`)) {
		t.Error("unknown topic should not mark state updated")
	}
}

func TestSnapshotCopiesMapsAndSlices(t *testing.T) {
	state := live.NewState()
	state.Drivers["1"] = live.LiveDriverData{RacingNumber: "1", Position: 1, GapToLeader: "+0.000"}
	state.DriverInfo["1"] = live.F1DriverListEntry{Tla: "VER"}
	state.Tyres["1"] = live.LiveTyreData{Compound: "SOFT", Age: 5}
	state.Stints["1"] = []live.LiveStintData{{Compound: "SOFT", Laps: 5}}
	state.RCMessages = []live.LiveRCMessage{{Message: "Green flag"}}

	snap := state.Snapshot()

	snap.Drivers["1"] = live.LiveDriverData{RacingNumber: "1", Position: 99}
	snap.DriverInfo["1"] = live.F1DriverListEntry{Tla: "MUTATED"}
	snap.Tyres["1"] = live.LiveTyreData{Compound: "WET"}
	snap.Stints["1"][0].Compound = "WET"
	snap.RCMessages[0].Message = "mutated"

	inner := state.Snapshot()
	if inner.Drivers["1"].Position != 1 {
		t.Error("mutating snapshot drivers leaked into state")
	}
	if inner.DriverInfo["1"].Tla != "VER" {
		t.Error("mutating snapshot driverInfo leaked into state")
	}
	if inner.Tyres["1"].Compound != "SOFT" {
		t.Error("mutating snapshot tyres leaked into state")
	}
	if inner.Stints["1"][0].Compound != "SOFT" {
		t.Error("mutating snapshot stints leaked into state")
	}
	if inner.RCMessages[0].Message != "Green flag" {
		t.Error("mutating snapshot RC messages leaked into state")
	}
}

func TestProcessMessageInvalidJSON(t *testing.T) {
	state := live.NewState()
	if state.ProcessMessage([]byte(`not json`)) {
		t.Error("invalid JSON should not update state")
	}
}

func TestProcessMessageEmptyPayload(t *testing.T) {
	state := live.NewState()
	if state.ProcessMessage([]byte(`{}`)) {
		t.Error("empty envelope should not update state")
	}
}

func encodedDeflatePayload(t *testing.T, payload string) json.RawMessage {
	t.Helper()
	var buf bytes.Buffer
	w, err := flate.NewWriter(&buf, flate.DefaultCompression)
	if err != nil {
		t.Fatalf("flate.NewWriter() error = %v", err)
	}
	if _, err := w.Write([]byte(payload)); err != nil {
		t.Fatalf("flate write error = %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("flate close error = %v", err)
	}
	raw, err := json.Marshal(base64.StdEncoding.EncodeToString(buf.Bytes()))
	if err != nil {
		t.Fatalf("marshal payload error = %v", err)
	}
	return raw
}
