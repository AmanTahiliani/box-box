package web

import (
	"context"
	"errors"
	"math"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

const (
	defaultReplayIntervalMS = 5000
	maxReplayFrames         = 3000
	replayFetchConcurrency  = 4
)

type replayDataClient interface {
	GetDriversForSession(sessionKey int) ([]models.Driver, error)
	GetLocation(sessionKey, driverNumber int) ([]models.Location, error)
}

type replayFramesResponse struct {
	SessionKey int           `json:"session_key"`
	Interval   int           `json:"interval_ms"`
	StartTime  string        `json:"start_time"`
	Frames     []replayFrame `json:"frames"`
}

type replayFrame struct {
	T    int64                `json:"t"`
	Cars map[string]replayCar `json:"cars"`
}

type replayCar struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

func (s *Server) handleReplayFrames(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}

	intervalMS := defaultReplayIntervalMS
	rawInterval := r.URL.Query().Get("interval_ms")
	if rawInterval != "" {
		parsed, err := strconv.Atoi(rawInterval)
		if err != nil {
			http.Error(w, "invalid interval_ms", http.StatusBadRequest)
			return
		}
		if parsed > intervalMS {
			intervalMS = parsed
		}
	}

	client := s.client.Scoped()
	resp, incomplete, err := assembleReplayFrames(r.Context(), client, sessionKey, intervalMS)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, client.LastResponseWasStale())
		return
	}
	markOpenF1Availability(w, client, replayResponseFreshness(resp, incomplete))
	writeJSON(w, resp)
}

func replayResponseFreshness(resp replayFramesResponse, incomplete bool) string {
	if !incomplete {
		return "fresh"
	}
	if len(resp.Frames) == 0 {
		return "limited"
	}
	return "partial"
}

func assembleReplayFrames(ctx context.Context, client replayDataClient, sessionKey, intervalMS int) (replayFramesResponse, bool, error) {
	if intervalMS < defaultReplayIntervalMS {
		intervalMS = defaultReplayIntervalMS
	}

	resp := replayFramesResponse{
		SessionKey: sessionKey,
		Interval:   intervalMS,
		Frames:     []replayFrame{},
	}

	drivers, err := client.GetDriversForSession(sessionKey)
	if err != nil {
		return resp, false, err
	}

	driverNumbers := uniqueDriverNumbers(drivers)
	if len(driverNumbers) == 0 {
		return resp, true, nil
	}

	series, err := fetchReplayLocationSeries(ctx, client, sessionKey, driverNumbers)
	if err != nil && len(series) == 0 {
		return resp, false, err
	}

	start, ok := earliestReplayLocationTime(series)
	if !ok {
		return resp, true, nil
	}
	resp.StartTime = start.Format(time.RFC3339Nano)
	resp.Frames = snapReplayFrames(series, start, intervalMS)
	return resp, err != nil || len(resp.Frames) == 0, nil
}

func uniqueDriverNumbers(drivers []models.Driver) []int {
	seen := make(map[int]bool, len(drivers))
	numbers := make([]int, 0, len(drivers))
	for _, driver := range drivers {
		if driver.DriverNumber <= 0 || seen[driver.DriverNumber] {
			continue
		}
		seen[driver.DriverNumber] = true
		numbers = append(numbers, driver.DriverNumber)
	}
	sort.Ints(numbers)
	return numbers
}

func fetchReplayLocationSeries(ctx context.Context, client replayDataClient, sessionKey int, driverNumbers []int) (map[int][]models.Location, error) {
	type result struct {
		driver int
		locs   []models.Location
		err    error
	}

	sem := make(chan struct{}, replayFetchConcurrency)
	results := make(chan result, len(driverNumbers))
	var wg sync.WaitGroup

	for _, driverNumber := range driverNumbers {
		driverNumber := driverNumber
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				results <- result{driver: driverNumber, err: ctx.Err()}
				return
			}

			locs, err := client.GetLocation(sessionKey, driverNumber)
			results <- result{driver: driverNumber, locs: locs, err: err}
		}()
	}

	wg.Wait()
	close(results)

	series := make(map[int][]models.Location, len(driverNumbers))
	var joined error
	for result := range results {
		if result.err != nil {
			joined = errors.Join(joined, result.err)
			continue
		}
		if len(result.locs) > 0 {
			series[result.driver] = result.locs
		}
	}
	return series, joined
}

func earliestReplayLocationTime(series map[int][]models.Location) (time.Time, bool) {
	var start time.Time
	for _, locs := range series {
		for _, loc := range locs {
			t, err := time.Parse(time.RFC3339Nano, loc.Date)
			if err != nil {
				continue
			}
			if start.IsZero() || t.Before(start) {
				start = t
			}
		}
	}
	if start.IsZero() {
		return time.Time{}, false
	}
	return start, true
}

func snapReplayFrames(series map[int][]models.Location, start time.Time, intervalMS int) []replayFrame {
	type accumulator struct {
		t       int64
		cars    map[string]replayCar
		nearest map[string]int64
	}

	interval := int64(intervalMS)
	framesByIndex := make(map[int]*accumulator)

	for driverNumber, locs := range series {
		driverKey := strconv.Itoa(driverNumber)
		for _, loc := range locs {
			if !isFiniteFloat(loc.X) || !isFiniteFloat(loc.Y) {
				continue
			}
			t, err := time.Parse(time.RFC3339Nano, loc.Date)
			if err != nil {
				continue
			}
			offset := t.Sub(start).Milliseconds()
			if offset < 0 {
				continue
			}
			index := int((offset + interval/2) / interval)
			if index < 0 || index >= maxReplayFrames {
				continue
			}
			frameT := int64(index) * interval
			distance := absInt64(offset - frameT)

			acc, ok := framesByIndex[index]
			if !ok {
				acc = &accumulator{
					t:       frameT,
					cars:    make(map[string]replayCar),
					nearest: make(map[string]int64),
				}
				framesByIndex[index] = acc
			}
			if prev, ok := acc.nearest[driverKey]; ok && prev <= distance {
				continue
			}
			acc.nearest[driverKey] = distance
			acc.cars[driverKey] = replayCar{X: loc.X, Y: loc.Y}
		}
	}

	indexes := make([]int, 0, len(framesByIndex))
	for index, acc := range framesByIndex {
		if len(acc.cars) > 0 {
			indexes = append(indexes, index)
		}
	}
	sort.Ints(indexes)

	frames := make([]replayFrame, 0, len(indexes))
	for _, index := range indexes {
		acc := framesByIndex[index]
		frames = append(frames, replayFrame{T: acc.t, Cars: acc.cars})
	}
	return frames
}

func absInt64(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

func isFiniteFloat(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0)
}
