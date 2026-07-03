package web

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/AmanTahiliani/box-box/internal/live"
	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/store"
)

func TestHandleTrackOutlineReturnsBoundsAndResolvesLiveIdentity(t *testing.T) {
	st := openTestStore(t)
	if err := st.UpsertMeeting(store.Meeting{
		MeetingKey:       1234,
		MeetingName:      "British Grand Prix",
		Location:         "Silverstone",
		CircuitKey:       9,
		CircuitShortName: "Silverstone",
		Year:             2026,
	}); err != nil {
		t.Fatalf("UpsertMeeting() error = %v", err)
	}
	srv := testServer(t, st)
	locs := []models.Location{
		{X: -100, Y: 50, Z: 0},
		{X: 0, Y: 100, Z: 0},
		{X: 100, Y: 50, Z: 0},
	}
	if err := srv.client.Cache().SetTrackOutline(9, 2026, locs); err != nil {
		t.Fatalf("SetTrackOutline() error = %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/track-outline?meeting_name=British+Grand+Prix&circuit_name=Silverstone&year=2026", nil)
	rec := httptest.NewRecorder()
	srv.handleTrackOutline(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	var resp trackOutlineResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.CircuitKey != 9 {
		t.Fatalf("circuit_key = %d, want 9", resp.CircuitKey)
	}
	if resp.Bounds.MinX != -100 || resp.Bounds.MaxX != 100 || resp.Bounds.MinY != 50 || resp.Bounds.MaxY != 100 {
		t.Fatalf("bounds = %+v", resp.Bounds)
	}
	if len(resp.Points) != 3 {
		t.Fatalf("points len = %d, want 3", len(resp.Points))
	}
}

func TestPositionsSSEFrameShape(t *testing.T) {
	payload, err := json.Marshal(map[string]live.LivePositionData{
		"1": {X: 100, Y: -50, Z: 2, Status: "OnTrack"},
	})
	if err != nil {
		t.Fatalf("marshal positions: %v", err)
	}
	frame := string(formatSSEFrame("positions", payload))
	if !strings.HasPrefix(frame, "event: positions\ndata: ") {
		t.Fatalf("frame prefix = %q", frame)
	}
	if !strings.Contains(frame, `"1":{"x":100,"y":-50,"z":2,"status":"OnTrack"}`) {
		t.Fatalf("frame data = %q", frame)
	}
	if !strings.HasSuffix(frame, "\n\n") {
		t.Fatalf("frame should end with blank line: %q", frame)
	}
}
