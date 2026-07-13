package web

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

type fakeReplayClient struct {
	drivers []models.Driver
	locs    map[int][]models.Location
	err     error
	locErrs map[int]error

	mu          sync.Mutex
	inFlight    int
	maxInFlight int
	delay       time.Duration
}

func (f *fakeReplayClient) GetDriversForSession(sessionKey int) ([]models.Driver, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.drivers, nil
}

func (f *fakeReplayClient) GetLocation(sessionKey, driverNumber int) ([]models.Location, error) {
	f.mu.Lock()
	f.inFlight++
	if f.inFlight > f.maxInFlight {
		f.maxInFlight = f.inFlight
	}
	f.mu.Unlock()

	if f.delay > 0 {
		time.Sleep(f.delay)
	}

	f.mu.Lock()
	f.inFlight--
	f.mu.Unlock()

	return f.locs[driverNumber], f.locErrs[driverNumber]
}

func TestAssembleReplayFramesReportsPartialDriverSeries(t *testing.T) {
	start := time.Date(2025, 5, 25, 13, 0, 0, 0, time.UTC)
	client := &fakeReplayClient{
		drivers: []models.Driver{{DriverNumber: 1}, {DriverNumber: 4}},
		locs: map[int][]models.Location{
			1: {{Date: start.Format(time.RFC3339Nano), X: 1, Y: 2}},
		},
		locErrs: map[int]error{4: errors.New("location unavailable")},
	}
	resp, incomplete, err := assembleReplayFrames(context.Background(), client, 99, defaultReplayIntervalMS)
	if err != nil {
		t.Fatalf("partial replay should remain usable: %v", err)
	}
	if !incomplete || len(resp.Frames) != 1 {
		t.Fatalf("partial replay = incomplete %v, frames %+v", incomplete, resp.Frames)
	}
	if got := replayResponseFreshness(resp, incomplete); got != "partial" {
		t.Fatalf("partial replay freshness = %q", got)
	}
}

func TestAssembleReplayFramesEmptyDriverSetIsLimited(t *testing.T) {
	resp, incomplete, err := assembleReplayFrames(context.Background(), &fakeReplayClient{}, 99, defaultReplayIntervalMS)
	if err != nil {
		t.Fatal(err)
	}
	if !incomplete || replayResponseFreshness(resp, incomplete) != "limited" {
		t.Fatalf("empty replay = incomplete %v, freshness %q", incomplete, replayResponseFreshness(resp, incomplete))
	}
}

func TestAssembleReplayFramesSnapsNearestSamplesAndOmitsEmptyDrivers(t *testing.T) {
	start := time.Date(2025, 5, 25, 13, 0, 0, 0, time.UTC)
	client := &fakeReplayClient{
		drivers: []models.Driver{
			{DriverNumber: 1},
			{DriverNumber: 4},
			{DriverNumber: 16},
		},
		locs: map[int][]models.Location{
			1: {
				{Date: start.Add(1 * time.Second).Format(time.RFC3339Nano), X: 10, Y: 20},
				{Date: start.Add(4 * time.Second).Format(time.RFC3339Nano), X: 40, Y: 80},
				{Date: start.Add(6 * time.Second).Format(time.RFC3339Nano), X: 60, Y: 120},
			},
			4: {
				{Date: start.Add(5 * time.Second).Format(time.RFC3339Nano), X: 100, Y: 200},
			},
			16: {},
		},
	}

	resp, incomplete, err := assembleReplayFrames(context.Background(), client, 99, 5000)
	if err != nil {
		t.Fatalf("assembleReplayFrames() error = %v", err)
	}
	if !incomplete {
		t.Fatal("empty entrant location series was labelled complete")
	}
	if got := replayResponseFreshness(resp, incomplete); got != "partial" {
		t.Fatalf("empty entrant freshness = %q", got)
	}
	if resp.SessionKey != 99 || resp.Interval != 5000 {
		t.Fatalf("response metadata = %+v", resp)
	}
	if resp.StartTime != start.Add(1*time.Second).Format(time.RFC3339Nano) {
		t.Fatalf("start_time = %q", resp.StartTime)
	}
	if len(resp.Frames) != 2 {
		t.Fatalf("frames len = %d, want 2: %+v", len(resp.Frames), resp.Frames)
	}
	if _, ok := resp.Frames[0].Cars["16"]; ok {
		t.Fatalf("empty driver included in frame: %+v", resp.Frames[0].Cars)
	}
	if got := resp.Frames[0].Cars["1"]; got.X != 10 || got.Y != 20 {
		t.Fatalf("frame 0 car 1 = %+v, want first nearest sample", got)
	}
	if got := resp.Frames[1].Cars["1"]; got.X != 60 || got.Y != 120 {
		t.Fatalf("frame 1 car 1 = %+v, want later nearest sample", got)
	}
	if got := resp.Frames[1].Cars["4"]; got.X != 100 || got.Y != 200 {
		t.Fatalf("frame 1 car 4 = %+v", got)
	}
}

func TestAssembleReplayFramesCapsFrameCount(t *testing.T) {
	start := time.Date(2025, 5, 25, 13, 0, 0, 0, time.UTC)
	locs := make([]models.Location, maxReplayFrames+250)
	for i := range locs {
		locs[i] = models.Location{
			Date: start.Add(time.Duration(i*defaultReplayIntervalMS) * time.Millisecond).Format(time.RFC3339Nano),
			X:    float64(i),
			Y:    float64(i * 2),
		}
	}
	client := &fakeReplayClient{
		drivers: []models.Driver{{DriverNumber: 1}},
		locs:    map[int][]models.Location{1: locs},
	}

	resp, _, err := assembleReplayFrames(context.Background(), client, 99, defaultReplayIntervalMS)
	if err != nil {
		t.Fatalf("assembleReplayFrames() error = %v", err)
	}
	if len(resp.Frames) > maxReplayFrames {
		t.Fatalf("frames len = %d, want <= %d", len(resp.Frames), maxReplayFrames)
	}
	if len(resp.Frames) != maxReplayFrames {
		t.Fatalf("frames len = %d, want hard cap %d", len(resp.Frames), maxReplayFrames)
	}
}

func TestAssembleReplayFramesBoundsLocationFanOut(t *testing.T) {
	drivers := make([]models.Driver, 10)
	locs := make(map[int][]models.Location, len(drivers))
	now := time.Date(2025, 5, 25, 13, 0, 0, 0, time.UTC)
	for i := range drivers {
		number := i + 1
		drivers[i] = models.Driver{DriverNumber: number}
		locs[number] = []models.Location{{Date: now.Format(time.RFC3339Nano), X: float64(number), Y: float64(number)}}
	}
	client := &fakeReplayClient{
		drivers: drivers,
		locs:    locs,
		delay:   5 * time.Millisecond,
	}

	if _, _, err := assembleReplayFrames(context.Background(), client, 99, defaultReplayIntervalMS); err != nil {
		t.Fatalf("assembleReplayFrames() error = %v", err)
	}
	if client.maxInFlight > replayFetchConcurrency {
		t.Fatalf("max in-flight location calls = %d, want <= %d", client.maxInFlight, replayFetchConcurrency)
	}
}

func TestHandleReplayFramesValidatesParamsAndFloorsInterval(t *testing.T) {
	srv := testServer(t, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/replay/frames", nil)
	rec := httptest.NewRecorder()
	srv.handleReplayFrames(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("missing session_key status = %d, want 400", rec.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/v1/replay/frames?session_key=1&interval_ms=nope", nil)
	rec = httptest.NewRecorder()
	srv.handleReplayFrames(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid interval status = %d, want 400", rec.Code)
	}

	client := &fakeReplayClient{drivers: []models.Driver{{DriverNumber: 1}}, locs: map[int][]models.Location{
		1: {{Date: time.Date(2025, 5, 25, 13, 0, 0, 0, time.UTC).Format(time.RFC3339Nano), X: 1, Y: 2}},
	}}
	resp, _, err := assembleReplayFrames(context.Background(), client, 99, 1000)
	if err != nil {
		t.Fatalf("assembleReplayFrames() error = %v", err)
	}
	body, err := json.Marshal(resp)
	if err != nil || len(body) == 0 {
		t.Fatalf("marshal response = %d bytes, %v", len(body), err)
	}
	if resp.Interval != defaultReplayIntervalMS {
		t.Fatalf("interval = %d, want floor %d", resp.Interval, defaultReplayIntervalMS)
	}
}
