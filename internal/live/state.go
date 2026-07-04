package live

import (
	"bytes"
	"compress/flate"
	"compress/zlib"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"sort"
	"strings"
	"time"
)

// State accumulates live timing updates from SignalR topic payloads.
type State struct {
	Drivers            map[string]LiveDriverData
	DriverInfo         map[string]F1DriverListEntry
	Tyres              map[string]LiveTyreData
	Telemetry          map[string]LiveTelemetryData
	Positions          map[string]LivePositionData
	Stints             map[string][]LiveStintData
	RCMessages         []LiveRCMessage
	Weather            LiveWeatherData
	Session            LiveSessionMeta
	TeamRadio          []LiveRadioCapture
	TrackStatus        string
	CurrentLap         int
	TotalLaps          int
	Clock              string
	ClockRefTime       time.Time
	ClockExtrapolating bool
	positionUpdated    bool
	snapshotUpdated    bool
}

const signalRRecordSeparator = byte(0x1e)
const maxTeamRadioCaptures = 20

// NewState returns an empty live timing accumulator.
func NewState() *State {
	return &State{
		Drivers:    make(map[string]LiveDriverData),
		DriverInfo: make(map[string]F1DriverListEntry),
		Tyres:      make(map[string]LiveTyreData),
		Telemetry:  make(map[string]LiveTelemetryData),
		Positions:  make(map[string]LivePositionData),
		Stints:     make(map[string][]LiveStintData),
	}
}

// Snapshot returns a defensive copy of the current state.
func (s *State) Snapshot() LiveStreamData {
	cpyDrivers := make(map[string]LiveDriverData, len(s.Drivers))
	for k, v := range s.Drivers {
		cpyDrivers[k] = v
	}
	cpyInfo := make(map[string]F1DriverListEntry, len(s.DriverInfo))
	for k, v := range s.DriverInfo {
		cpyInfo[k] = v
	}
	cpyTyres := make(map[string]LiveTyreData, len(s.Tyres))
	for k, v := range s.Tyres {
		cpyTyres[k] = v
	}
	cpyTelemetry := make(map[string]LiveTelemetryData, len(s.Telemetry))
	for k, v := range s.Telemetry {
		cpyTelemetry[k] = v
	}
	cpyPositions := make(map[string]LivePositionData, len(s.Positions))
	for k, v := range s.Positions {
		cpyPositions[k] = v
	}
	cpyRC := make([]LiveRCMessage, len(s.RCMessages))
	copy(cpyRC, s.RCMessages)
	cpyRadio := make([]LiveRadioCapture, len(s.TeamRadio))
	copy(cpyRadio, s.TeamRadio)
	cpyStints := make(map[string][]LiveStintData, len(s.Stints))
	for k, v := range s.Stints {
		st := make([]LiveStintData, len(v))
		copy(st, v)
		cpyStints[k] = st
	}

	return LiveStreamData{
		Drivers:            cpyDrivers,
		DriverInfo:         cpyInfo,
		Tyres:              cpyTyres,
		Telemetry:          cpyTelemetry,
		RCMessages:         cpyRC,
		Weather:            s.Weather,
		Session:            s.Session,
		TeamRadio:          cpyRadio,
		TrackStatus:        s.TrackStatus,
		CurrentLap:         s.CurrentLap,
		TotalLaps:          s.TotalLaps,
		Clock:              s.Clock,
		ClockRefTime:       s.ClockRefTime,
		ClockExtrapolating: s.ClockExtrapolating,
		Stints:             cpyStints,
		Positions:          cpyPositions,
		PositionUpdated:    s.positionUpdated,
		SnapshotUpdated:    s.snapshotUpdated,
	}
}

// ProcessMessage parses a raw SignalR WebSocket frame and applies any updates.
func (s *State) ProcessMessage(message []byte) bool {
	s.clearTransientFlags()

	var parsed F1SignalRMessage
	if err := json.Unmarshal(message, &parsed); err != nil {
		return false
	}

	updated := false

	if len(parsed.R) > 2 {
		var rMap map[string]json.RawMessage
		if err := json.Unmarshal(parsed.R, &rMap); err == nil {
			for topic, data := range rMap {
				if s.ProcessTopic(topic, data) {
					updated = true
				}
			}
		}
	}

	for _, m := range parsed.M {
		if len(m.A) > 1 {
			var topic string
			json.Unmarshal(m.A[0], &topic)
			if s.ProcessTopic(topic, m.A[1]) {
				updated = true
			}
		}
	}

	return updated
}

// ProcessCoreMessage parses one or more SignalR Core JSON frames and applies
// completion snapshots and feed deltas from the current official F1 live timing hub.
func (s *State) ProcessCoreMessage(message []byte) bool {
	s.clearTransientFlags()

	updated := false
	for _, frame := range splitSignalRFrames(message) {
		var envelope struct {
			Type   int               `json:"type"`
			Target string            `json:"target"`
			Args   []json.RawMessage `json:"arguments"`
			Result json.RawMessage   `json:"result"`
		}
		if err := json.Unmarshal(frame, &envelope); err != nil {
			continue
		}

		switch envelope.Type {
		case 1:
			if envelope.Target != "feed" || len(envelope.Args) < 2 {
				continue
			}
			var topic string
			if err := json.Unmarshal(envelope.Args[0], &topic); err != nil {
				continue
			}
			if s.ProcessTopic(topic, envelope.Args[1]) {
				updated = true
			}
		case 3:
			if len(envelope.Result) == 0 || string(envelope.Result) == "null" {
				continue
			}
			var result map[string]json.RawMessage
			if err := json.Unmarshal(envelope.Result, &result); err != nil {
				continue
			}
			for topic, data := range result {
				if s.ProcessTopic(topic, data) {
					updated = true
				}
			}
		}
	}
	return updated
}

// ProcessTopic applies a single topic payload to the accumulator.
func (s *State) ProcessTopic(topic string, data json.RawMessage) bool {
	updated := false
	baseTopic := strings.TrimSuffix(topic, ".z")
	if topic != baseTopic {
		var ok bool
		data, ok = inflateTopicPayload(data)
		if !ok {
			return false
		}
	}
	switch baseTopic {
	case "TimingData":
		var td struct {
			Lines map[string]json.RawMessage `json:"Lines"`
		}
		if json.Unmarshal(data, &td) == nil {
			for num, lineRaw := range td.Lines {
				var line F1TimingLine
				if json.Unmarshal(lineRaw, &line) == nil {
					updateDriver(s.Drivers, num, line)
					updated = true
				}
			}
		}
	case "Position":
		updated = s.updatePositions(data)
	case "CarData":
		updated = s.updateTelemetry(data)
	case "DriverList":
		var dlMap map[string]json.RawMessage
		if json.Unmarshal(data, &dlMap) == nil {
			for num, entryRaw := range dlMap {
				var entry F1DriverListEntry
				if json.Unmarshal(entryRaw, &entry) == nil && entry.Tla != "" {
					s.DriverInfo[num] = entry
					updated = true
				}
			}
		}
	case "LapCount":
		var lc struct {
			CurrentLap json.Number `json:"CurrentLap"`
			TotalLaps  json.Number `json:"TotalLaps"`
		}
		if json.Unmarshal(data, &lc) == nil {
			if v, err := lc.CurrentLap.Int64(); err == nil {
				s.CurrentLap = int(v)
			}
			if v, err := lc.TotalLaps.Int64(); err == nil {
				s.TotalLaps = int(v)
			}
			updated = true
		}
	case "ExtrapolatedClock":
		var ec struct {
			Remaining     string `json:"Remaining"`
			Utc           string `json:"Utc"`
			Extrapolating bool   `json:"Extrapolating"`
		}
		if json.Unmarshal(data, &ec) == nil && ec.Remaining != "" {
			s.Clock = ec.Remaining
			s.ClockExtrapolating = ec.Extrapolating
			if ec.Utc != "" {
				if t, err := time.Parse(time.RFC3339, ec.Utc); err == nil {
					s.ClockRefTime = t
				} else if t, err := time.Parse("2006-01-02T15:04:05.999Z", ec.Utc); err == nil {
					s.ClockRefTime = t
				} else {
					s.ClockRefTime = time.Now()
				}
			} else {
				s.ClockRefTime = time.Now()
			}
			updated = true
		}
	case "TrackStatus":
		var ts struct {
			Status  string `json:"Status"`
			Message string `json:"Message"`
		}
		if json.Unmarshal(data, &ts) == nil && ts.Status != "" {
			s.TrackStatus = ts.Status
			updated = true
		}
	case "RaceControlMessages":
		var rcm struct {
			Messages json.RawMessage `json:"Messages"`
		}
		if json.Unmarshal(data, &rcm) == nil {
			for _, msgRaw := range indexedRawValues(rcm.Messages) {
				var msg struct {
					Utc      string `json:"Utc"`
					Category string `json:"Category"`
					Flag     string `json:"Flag"`
					Message  string `json:"Message"`
					Lap      int    `json:"Lap"`
				}
				if json.Unmarshal(msgRaw.Raw, &msg) == nil && msg.Message != "" {
					t := ""
					if len(msg.Utc) >= 19 {
						t = msg.Utc[11:16]
					}
					s.RCMessages = append(s.RCMessages, LiveRCMessage{
						Time:     t,
						Category: msg.Category,
						Flag:     msg.Flag,
						Message:  msg.Message,
						Lap:      msg.Lap,
					})
					updated = true
				}
			}
		}
	case "WeatherData":
		var wd struct {
			AirTemp       json.Number `json:"AirTemp"`
			TrackTemp     json.Number `json:"TrackTemp"`
			Humidity      json.Number `json:"Humidity"`
			WindSpeed     json.Number `json:"WindSpeed"`
			WindDirection json.Number `json:"WindDirection"`
			Rainfall      json.Number `json:"Rainfall"`
		}
		if json.Unmarshal(data, &wd) == nil {
			if v, err := wd.AirTemp.Float64(); err == nil {
				s.Weather.AirTemp = v
			}
			if v, err := wd.TrackTemp.Float64(); err == nil {
				s.Weather.TrackTemp = v
			}
			if v, err := wd.Humidity.Float64(); err == nil {
				s.Weather.Humidity = v
			}
			if v, err := wd.WindSpeed.Float64(); err == nil {
				s.Weather.WindSpeed = v
			}
			if v, err := wd.WindDirection.Int64(); err == nil {
				s.Weather.WindDir = int(v)
			}
			if v, err := wd.Rainfall.Float64(); err == nil {
				s.Weather.Rainfall = v > 0
			}
			updated = true
		}
	case "SessionInfo":
		var si struct {
			Meeting struct {
				Name    string `json:"Name"`
				Circuit struct {
					ShortName string `json:"ShortName"`
				} `json:"Circuit"`
			} `json:"Meeting"`
			Name string `json:"Name"`
			Type string `json:"Type"`
			Path string `json:"Path"`
		}
		if json.Unmarshal(data, &si) == nil {
			if si.Meeting.Name != "" {
				s.Session.MeetingName = si.Meeting.Name
			}
			if si.Meeting.Circuit.ShortName != "" {
				s.Session.CircuitName = si.Meeting.Circuit.ShortName
			}
			if si.Name != "" {
				s.Session.SessionName = si.Name
			}
			if si.Type != "" {
				s.Session.SessionType = si.Type
			}
			if si.Path != "" {
				s.Session.Path = si.Path
			}
			updated = true
		}
	case "TeamRadio":
		updated = s.updateTeamRadio(data)
	case "CurrentTyres":
		var ct map[string]json.RawMessage
		if json.Unmarshal(data, &ct) == nil {
			for num, raw := range ct {
				if num == "_kf" {
					continue
				}
				var td struct {
					Compound string `json:"Compound"`
					New      string `json:"New"`
				}
				if json.Unmarshal(raw, &td) == nil && td.Compound != "" {
					t := s.Tyres[num]
					t.Compound = td.Compound
					t.New = td.New == "true" || td.New == "True"
					s.Tyres[num] = t
					updated = true
				}
			}
		}
	case "TimingAppData":
		var tad struct {
			Lines map[string]json.RawMessage `json:"Lines"`
		}
		if json.Unmarshal(data, &tad) == nil {
			for num, lineRaw := range tad.Lines {
				var line struct {
					Stints json.RawMessage `json:"Stints"`
				}
				if json.Unmarshal(lineRaw, &line) == nil && line.Stints != nil {
					var driverStints []LiveStintData
					for _, sRaw := range indexedRawValues(line.Stints) {
						var st struct {
							Compound  string `json:"Compound"`
							New       string `json:"New"`
							TotalLaps int    `json:"TotalLaps"`
						}
						if json.Unmarshal(sRaw.Raw, &st) == nil && st.Compound != "" {
							driverStints = append(driverStints, LiveStintData{
								Compound: st.Compound,
								New:      st.New == "true" || st.New == "True",
								Laps:     st.TotalLaps,
							})
						}
					}
					if len(driverStints) > 0 {
						s.Stints[num] = driverStints
						lastStint := driverStints[len(driverStints)-1]
						t := s.Tyres[num]
						t.Age = lastStint.Laps
						if lastStint.Compound != "" {
							t.Compound = lastStint.Compound
							t.New = lastStint.New
						}
						s.Tyres[num] = t
						updated = true
					}
				}
			}
		}
	case "TimingStats":
		var ts struct {
			Lines map[string]json.RawMessage `json:"Lines"`
		}
		if json.Unmarshal(data, &ts) == nil {
			for num, lineRaw := range ts.Lines {
				var line struct {
					PersonalBestLapTime struct {
						Value string `json:"Value"`
					} `json:"PersonalBestLapTime"`
				}
				if json.Unmarshal(lineRaw, &line) == nil {
					if d, ok := s.Drivers[num]; ok && line.PersonalBestLapTime.Value != "" {
						d.BestLapTime = line.PersonalBestLapTime.Value
						s.Drivers[num] = d
						updated = true
					}
				}
			}
		}
	}
	if updated {
		if baseTopic == "Position" {
			s.positionUpdated = true
		} else {
			s.snapshotUpdated = true
		}
	}
	return updated
}

func (s *State) clearTransientFlags() {
	s.positionUpdated = false
	s.snapshotUpdated = false
}

func inflateTopicPayload(data json.RawMessage) (json.RawMessage, bool) {
	var encoded string
	if err := json.Unmarshal(data, &encoded); err != nil {
		var wrapper struct {
			Z string `json:"z"`
		}
		if json.Unmarshal(data, &wrapper) != nil || wrapper.Z == "" {
			return nil, false
		}
		encoded = wrapper.Z
	}

	compressed, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, false
	}
	if inflated, ok := readCompressed(zlib.NewReader(bytes.NewReader(compressed))); ok {
		return json.RawMessage(inflated), true
	}
	if inflated, ok := readCompressed(func() (io.ReadCloser, error) {
		return flate.NewReader(bytes.NewReader(compressed)), nil
	}()); ok {
		return json.RawMessage(inflated), true
	}
	return nil, false
}

func readCompressed(r io.ReadCloser, err error) ([]byte, bool) {
	if err != nil {
		return nil, false
	}
	defer r.Close()
	out, err := io.ReadAll(r)
	return out, err == nil
}

func (s *State) updateTeamRadio(data json.RawMessage) bool {
	var payload struct {
		Captures json.RawMessage `json:"Captures"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		log.Printf("live: skipping malformed TeamRadio payload: %v", err)
		return false
	}
	if len(payload.Captures) == 0 || string(payload.Captures) == "null" {
		log.Printf("live: skipping TeamRadio payload without Captures")
		return false
	}

	captures := indexedRawValues(payload.Captures)
	if len(captures) == 0 {
		log.Printf("live: skipping TeamRadio payload with unexpected Captures shape")
		return false
	}

	updated := false
	for _, captureRaw := range captures {
		var capture LiveRadioCapture
		if err := json.Unmarshal(captureRaw.Raw, &capture); err != nil {
			log.Printf("live: skipping malformed TeamRadio capture: %v", err)
			continue
		}
		if capture.Utc == "" || capture.RacingNumber == "" || capture.Path == "" {
			log.Printf("live: skipping incomplete TeamRadio capture: utc=%q racing_number=%q path=%q", capture.Utc, capture.RacingNumber, capture.Path)
			continue
		}
		if s.hasTeamRadioCapture(capture) {
			continue
		}
		s.TeamRadio = append(s.TeamRadio, capture)
		updated = true
	}
	if updated {
		sort.SliceStable(s.TeamRadio, func(i, j int) bool {
			return s.TeamRadio[i].Utc < s.TeamRadio[j].Utc
		})
		if len(s.TeamRadio) > maxTeamRadioCaptures {
			s.TeamRadio = append([]LiveRadioCapture(nil), s.TeamRadio[len(s.TeamRadio)-maxTeamRadioCaptures:]...)
		}
	}
	return updated
}

func (s *State) hasTeamRadioCapture(capture LiveRadioCapture) bool {
	for _, existing := range s.TeamRadio {
		if existing.Utc == capture.Utc && existing.RacingNumber == capture.RacingNumber && existing.Path == capture.Path {
			return true
		}
	}
	return false
}

func (s *State) updatePositions(data json.RawMessage) bool {
	var payload struct {
		Position json.RawMessage `json:"Position"`
	}
	if json.Unmarshal(data, &payload) != nil || len(payload.Position) == 0 {
		return false
	}

	updated := false
	for _, sampleRaw := range indexedRawValues(payload.Position) {
		var sample struct {
			Entries map[string]struct {
				Status string      `json:"Status"`
				X      json.Number `json:"X"`
				Y      json.Number `json:"Y"`
				Z      json.Number `json:"Z"`
			} `json:"Entries"`
		}
		if json.Unmarshal(sampleRaw.Raw, &sample) != nil {
			continue
		}
		for num, entry := range sample.Entries {
			x, okX := numberToFloat(entry.X)
			y, okY := numberToFloat(entry.Y)
			z, okZ := numberToFloat(entry.Z)
			if !okX || !okY {
				continue
			}
			if !okZ {
				z = 0
			}
			s.Positions[num] = LivePositionData{
				X:      x,
				Y:      y,
				Z:      z,
				Status: entry.Status,
			}
			updated = true
		}
	}
	return updated
}

func (s *State) updateTelemetry(data json.RawMessage) bool {
	var payload struct {
		Entries json.RawMessage `json:"Entries"`
	}
	if json.Unmarshal(data, &payload) != nil || len(payload.Entries) == 0 {
		return false
	}

	updated := false
	for _, entryRaw := range indexedRawValues(payload.Entries) {
		var entry struct {
			Cars map[string]struct {
				Channels map[string]json.RawMessage `json:"Channels"`
			} `json:"Cars"`
		}
		if json.Unmarshal(entryRaw.Raw, &entry) != nil {
			continue
		}
		for num, car := range entry.Cars {
			t := s.Telemetry[num]
			if v, ok := channelInt(car.Channels, "0"); ok {
				t.RPM = v
			}
			if v, ok := channelInt(car.Channels, "2"); ok {
				t.Speed = v
			}
			if v, ok := channelInt(car.Channels, "3"); ok {
				t.NGear = v
			}
			if v, ok := channelInt(car.Channels, "4"); ok {
				t.Throttle = v
			}
			if v, ok := channelInt(car.Channels, "5"); ok {
				t.Brake = v
			}
			if v, ok := channelInt(car.Channels, "45"); ok {
				t.DRS = v
			}
			s.Telemetry[num] = t
			updated = true
		}
	}
	return updated
}

func channelInt(channels map[string]json.RawMessage, key string) (int, bool) {
	raw, ok := channels[key]
	if !ok {
		return 0, false
	}
	var n json.Number
	if json.Unmarshal(raw, &n) == nil {
		if i, err := n.Int64(); err == nil {
			return int(i), true
		}
		if f, err := n.Float64(); err == nil {
			return int(f), true
		}
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		var i int
		if _, err := fmt.Sscanf(s, "%d", &i); err == nil {
			return i, true
		}
	}
	return 0, false
}

func numberToFloat(n json.Number) (float64, bool) {
	if n == "" {
		return 0, false
	}
	v, err := n.Float64()
	return v, err == nil
}

func updateDriver(drivers map[string]LiveDriverData, num string, line F1TimingLine) {
	d, exists := drivers[num]
	if !exists {
		d = LiveDriverData{RacingNumber: num}
		if line.RacingNumber != "" {
			d.RacingNumber = line.RacingNumber
		}
	}

	if line.Position != nil {
		var newPos int
		switch v := line.Position.(type) {
		case string:
			fmt.Sscanf(v, "%d", &newPos)
		case float64:
			newPos = int(v)
		}
		if newPos > 0 && newPos != d.Position {
			d.PrevPosition = d.Position
			d.Position = newPos
		}
	}
	if line.GapToLeader != nil {
		if s := extractStringVal(line.GapToLeader); s != "" {
			d.GapToLeader = s
		}
	}
	if line.IntervalToPositionAhead.Value != nil {
		if s := extractStringVal(line.IntervalToPositionAhead.Value); s != "" {
			d.Interval = s
		}
	}
	if line.LastLapTime.Value != "" {
		d.LastLapTime = line.LastLapTime.Value
		d.LastLapPB = line.LastLapTime.PersonalFastest
		d.LastLapOB = line.LastLapTime.OverallFastest
	}
	if line.BestLapTime.Value != "" {
		d.BestLapTime = line.BestLapTime.Value
		d.BestLapPB = line.BestLapTime.PersonalFastest
		d.BestLapOB = line.BestLapTime.OverallFastest
		if line.BestLapTime.Lap > 0 {
			d.BestLapNum = line.BestLapTime.Lap
		}
	}
	if line.InPit != nil {
		d.InPit = toBool(line.InPit)
	}
	if line.PitOut != nil {
		d.PitOut = toBool(line.PitOut)
	}
	if line.Retired != nil {
		d.Retired = toBool(line.Retired)
	}
	if line.KnockedOut != nil {
		d.KnockedOut = toBool(line.KnockedOut)
	}
	if line.Cutoff != nil {
		d.Cutoff = toBool(line.Cutoff)
	}
	if line.NumberOfLaps != nil {
		if v, ok := toInt(line.NumberOfLaps); ok {
			d.NumberOfLaps = v
		}
	}

	if st, ok := line.Speeds["ST"]; ok {
		var sp struct {
			Value string `json:"Value"`
		}
		if json.Unmarshal(st, &sp) == nil && sp.Value != "" {
			d.SpeedTrap = sp.Value
		}
	}

	for _, sector := range indexedRawValues(line.Sectors) {
		i := sector.Index
		if i >= 0 && i < 3 {
			var sec struct {
				Value           string `json:"Value"`
				PersonalFastest bool   `json:"PersonalFastest"`
				OverallFastest  bool   `json:"OverallFastest"`
			}
			if json.Unmarshal(sector.Raw, &sec) == nil {
				if sec.Value == "" {
					d.Sectors[i] = LiveSectorData{}
				} else {
					d.Sectors[i] = LiveSectorData{
						Value:           sec.Value,
						PersonalFastest: sec.PersonalFastest,
						OverallFastest:  sec.OverallFastest,
					}
				}
			}
		}
	}

	d.OnFlyingLap = !d.InPit && !d.Retired &&
		(d.Sectors[0].Value != "" || d.Sectors[1].Value != "") &&
		d.Sectors[2].Value == ""

	drivers[num] = d
}

func extractStringVal(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case float64:
		if val == 0 {
			return ""
		}
		return fmt.Sprintf("+%.3f", val)
	case map[string]interface{}:
		if s, ok := val["Value"].(string); ok {
			return s
		}
	}
	return ""
}

func toBool(v interface{}) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val == "true" || val == "True"
	}
	return false
}

func toInt(v interface{}) (int, bool) {
	switch val := v.(type) {
	case float64:
		return int(val), true
	case json.Number:
		if i, err := val.Int64(); err == nil {
			return int(i), true
		}
	case string:
		var i int
		if _, err := fmt.Sscanf(val, "%d", &i); err == nil {
			return i, true
		}
	}
	return 0, false
}

type indexedRaw struct {
	Index int
	Raw   json.RawMessage
}

func splitSignalRFrames(message []byte) []json.RawMessage {
	parts := []json.RawMessage{}
	start := 0
	for i, b := range message {
		if b != signalRRecordSeparator {
			continue
		}
		if i > start {
			parts = append(parts, json.RawMessage(message[start:i]))
		}
		start = i + 1
	}
	if start < len(message) {
		parts = append(parts, json.RawMessage(message[start:]))
	}
	return parts
}

func indexedRawValues(raw json.RawMessage) []indexedRaw {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}

	var arr []json.RawMessage
	if err := json.Unmarshal(raw, &arr); err == nil {
		values := make([]indexedRaw, 0, len(arr))
		for i, v := range arr {
			values = append(values, indexedRaw{Index: i, Raw: v})
		}
		return values
	}

	var obj map[string]json.RawMessage
	if err := json.Unmarshal(raw, &obj); err == nil {
		values := make([]indexedRaw, 0, len(obj))
		for k, v := range obj {
			i := 0
			fmt.Sscanf(k, "%d", &i)
			values = append(values, indexedRaw{Index: i, Raw: v})
		}
		sort.Slice(values, func(i, j int) bool {
			return values[i].Index < values[j].Index
		})
		return values
	}

	return nil
}
