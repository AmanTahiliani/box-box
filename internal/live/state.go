package live

import (
	"encoding/json"
	"fmt"
	"time"
)

// State accumulates live timing updates from SignalR topic payloads.
type State struct {
	Drivers            map[string]LiveDriverData
	DriverInfo         map[string]F1DriverListEntry
	Tyres              map[string]LiveTyreData
	Stints             map[string][]LiveStintData
	RCMessages         []LiveRCMessage
	Weather            LiveWeatherData
	Session            LiveSessionMeta
	TrackStatus        string
	CurrentLap         int
	TotalLaps          int
	Clock              string
	ClockRefTime       time.Time
	ClockExtrapolating bool
}

// NewState returns an empty live timing accumulator.
func NewState() *State {
	return &State{
		Drivers:    make(map[string]LiveDriverData),
		DriverInfo: make(map[string]F1DriverListEntry),
		Tyres:      make(map[string]LiveTyreData),
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
	cpyRC := make([]LiveRCMessage, len(s.RCMessages))
	copy(cpyRC, s.RCMessages)
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
		RCMessages:         cpyRC,
		Weather:            s.Weather,
		Session:            s.Session,
		TrackStatus:        s.TrackStatus,
		CurrentLap:         s.CurrentLap,
		TotalLaps:          s.TotalLaps,
		Clock:              s.Clock,
		ClockRefTime:       s.ClockRefTime,
		ClockExtrapolating: s.ClockExtrapolating,
		Stints:             cpyStints,
	}
}

// ProcessMessage parses a raw SignalR WebSocket frame and applies any updates.
func (s *State) ProcessMessage(message []byte) bool {
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

// ProcessTopic applies a single topic payload to the accumulator.
func (s *State) ProcessTopic(topic string, data json.RawMessage) bool {
	updated := false
	switch topic {
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
			Messages map[string]json.RawMessage `json:"Messages"`
		}
		if json.Unmarshal(data, &rcm) == nil {
			for _, msgRaw := range rcm.Messages {
				var msg struct {
					Utc      string `json:"Utc"`
					Category string `json:"Category"`
					Flag     string `json:"Flag"`
					Message  string `json:"Message"`
					Lap      int    `json:"Lap"`
				}
				if json.Unmarshal(msgRaw, &msg) == nil && msg.Message != "" {
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
				Name string `json:"Name"`
			} `json:"Meeting"`
			Name string `json:"Name"`
			Type string `json:"Type"`
		}
		if json.Unmarshal(data, &si) == nil {
			if si.Meeting.Name != "" {
				s.Session.MeetingName = si.Meeting.Name
			}
			if si.Name != "" {
				s.Session.SessionName = si.Name
			}
			if si.Type != "" {
				s.Session.SessionType = si.Type
			}
			updated = true
		}
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
					Stints map[string]json.RawMessage `json:"Stints"`
				}
				if json.Unmarshal(lineRaw, &line) == nil && line.Stints != nil {
					var driverStints []LiveStintData
					for _, sRaw := range line.Stints {
						var st struct {
							Compound  string `json:"Compound"`
							New       string `json:"New"`
							TotalLaps int    `json:"TotalLaps"`
						}
						if json.Unmarshal(sRaw, &st) == nil && st.Compound != "" {
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
	return updated
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

	for idx, sRaw := range line.Sectors {
		i := 0
		fmt.Sscanf(idx, "%d", &i)
		if i >= 0 && i < 3 {
			var sec struct {
				Value           string `json:"Value"`
				PersonalFastest bool   `json:"PersonalFastest"`
				OverallFastest  bool   `json:"OverallFastest"`
			}
			if json.Unmarshal(sRaw, &sec) == nil {
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
