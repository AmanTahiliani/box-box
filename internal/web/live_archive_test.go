package web

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/live"
)

func TestSSEHubArchivesTerminalSessionSnapshot(t *testing.T) {
	hub := newSSEHub()
	now := time.Date(2026, 7, 4, 14, 0, 0, 0, time.UTC)
	active := live.LiveStreamData{
		SessionStatus: "Started",
		Drivers: map[string]live.LiveDriverData{
			"1": {RacingNumber: "1", Position: 1},
		},
		Positions: map[string]live.LivePositionData{
			"1": {X: 100, Y: -50, Z: 2, Status: "OnTrack"},
		},
		PositionUpdated: true,
		SnapshotUpdated: true,
	}
	if state := hub.applySnapshot(active, now); !state.IsLive || state.Data == nil {
		t.Fatalf("active state = %+v, want live data", state)
	}

	terminal := active
	terminal.SessionStatus = "Finished"
	terminal.Positions = nil
	terminal.PositionUpdated = false
	state := hub.applySnapshot(terminal, now.Add(time.Minute))

	if state.IsLive {
		t.Fatal("terminal SessionStatus should not be live")
	}
	if state.Data != nil {
		t.Fatalf("inactive state data = %+v, want nil", state.Data)
	}
	if state.LastSnapshot == nil || state.LastSnapshot.SessionStatus != "Finished" {
		t.Fatalf("last snapshot = %+v, want terminal snapshot", state.LastSnapshot)
	}
	if got := state.LastPositions["1"]; got.X != 100 || got.Status != "OnTrack" {
		t.Fatalf("last positions = %+v, want carried active positions", state.LastPositions)
	}
	if state.LastSnapshotAt == nil || !state.LastSnapshotAt.Equal(now.Add(time.Minute)) {
		t.Fatalf("last snapshot time = %v, want %v", state.LastSnapshotAt, now.Add(time.Minute))
	}
}

func TestSnapshotIsLive(t *testing.T) {
	redFlag := live.LiveStreamData{
		SessionStatus: "Inactive",
		TrackStatus:   "2",
		Clock:         "00:03:27",
		Session:       live.LiveSessionMeta{MeetingName: "Belgian Grand Prix", SessionName: "Practice 2", SessionType: "Practice"},
	}
	tests := []struct {
		name string
		data live.LiveStreamData
		want bool
	}{
		{"started", live.LiveStreamData{SessionStatus: "Started"}, true},
		{"resumed", live.LiveStreamData{SessionStatus: "Resumed"}, true},
		{"red flag inactive with clock and session", redFlag, true},
		{"terminal finished with clock", func() live.LiveStreamData {
			d := redFlag
			d.SessionStatus = "Finished"
			return d
		}(), false},
		{"inactive spent clock", func() live.LiveStreamData {
			d := redFlag
			d.Clock = "00:00:00"
			return d
		}(), false},
		{"inactive no clock", func() live.LiveStreamData {
			d := redFlag
			d.Clock = ""
			return d
		}(), false},
		{"inactive no session metadata", func() live.LiveStreamData {
			d := redFlag
			d.Session = live.LiveSessionMeta{}
			return d
		}(), false},
	}
	for _, tt := range tests {
		if got := snapshotIsLive(tt.data); got != tt.want {
			t.Errorf("%s: snapshotIsLive = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestSSEHubKeepsRedFlagSessionLive(t *testing.T) {
	hub := newSSEHub()
	now := time.Date(2026, 7, 26, 14, 0, 0, 0, time.UTC)

	redFlag := live.LiveStreamData{
		SessionStatus:   "Inactive",
		TrackStatus:     "2",
		Clock:           "00:03:27",
		Session:         live.LiveSessionMeta{MeetingName: "Belgian Grand Prix", SessionName: "Practice 2", SessionType: "Practice"},
		SnapshotUpdated: true,
	}
	state := hub.applySnapshot(redFlag, now)

	if !state.IsLive {
		t.Fatal("red-flag paused session should report is_live=true")
	}
	if state.Data == nil {
		t.Fatal("red-flag paused session must still send the active snapshot")
	}
	if state.Data.TrackStatus != "2" {
		t.Fatalf("track status = %q, want the paused state \"2\"", state.Data.TrackStatus)
	}
	if state.LastSnapshot != nil {
		t.Fatalf("red-flag session should not be archived: %+v", state.LastSnapshot)
	}
}

func TestSSEHubStaleInactiveSnapshotNotLive(t *testing.T) {
	hub := newSSEHub()
	now := time.Date(2026, 7, 26, 14, 0, 0, 0, time.UTC)

	// Inactive snapshot with session metadata but no remaining clock: this is a
	// stale/no-live-evidence snapshot and must not be surfaced as live.
	stale := live.LiveStreamData{
		SessionStatus:   "Inactive",
		Clock:           "00:00:00",
		Session:         live.LiveSessionMeta{MeetingName: "Belgian Grand Prix", SessionName: "Practice 2"},
		SnapshotUpdated: true,
	}
	state := hub.applySnapshot(stale, now)

	if state.IsLive {
		t.Fatal("stale inactive snapshot should report is_live=false")
	}
	if state.Data != nil {
		t.Fatalf("stale inactive snapshot leaked into active data: %+v", state.Data)
	}
	if state.LastSnapshot == nil {
		t.Fatal("stale inactive snapshot with metadata should be archived")
	}
}

func TestHandleLiveStateKeepsArchiveOutOfActiveData(t *testing.T) {
	hub := newSSEHub()
	now := time.Date(2026, 7, 4, 14, 0, 0, 0, time.UTC)
	hub.applySnapshot(live.LiveStreamData{
		SessionStatus: "Finished",
		Session:       live.LiveSessionMeta{MeetingName: "British Grand Prix", SessionName: "Race"},
		Drivers: map[string]live.LiveDriverData{
			"44": {RacingNumber: "44", Position: 1},
		},
		SnapshotUpdated: true,
	}, now)

	srv := &Server{hub: hub}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/live/state", nil)
	rec := httptest.NewRecorder()
	srv.handleLiveState(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp liveStatePayload
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.IsLive {
		t.Fatal("archived snapshot should report is_live=false")
	}
	if resp.Data != nil {
		t.Fatalf("archived snapshot leaked into data: %+v", resp.Data)
	}
	if resp.LastSnapshot == nil || resp.LastSnapshot.Session.MeetingName != "British Grand Prix" {
		t.Fatalf("last snapshot = %+v, want archived race", resp.LastSnapshot)
	}
	if resp.LastSnapshotAt == nil {
		t.Fatal("last_snapshot_at should be present for archived snapshots")
	}
}
