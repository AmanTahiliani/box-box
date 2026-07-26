package web

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/AmanTahiliani/box-box/internal/live"
)

// sseClient is a connected SSE subscriber.
type sseClient struct {
	ch   chan []byte // buffered; non-blocking sends
	done chan struct{}
}

// sseEvent is an outbound SSE frame.
type sseEvent struct {
	name string
	data []byte
}

// SSEHub manages SSE clients and broadcasts live events.
type SSEHub struct {
	register   chan *sseClient
	deregister chan *sseClient
	broadcast  chan sseEvent

	mu              sync.RWMutex
	activeSnapshot  *live.LiveStreamData
	activePositions map[string]live.LivePositionData
	lastSnapshot    *live.LiveStreamData
	lastPositions   map[string]live.LivePositionData
	lastSnapshotAt  time.Time
	isLive          bool
}

type liveStatePayload struct {
	IsLive         bool                             `json:"is_live"`
	Data           *live.LiveStreamData             `json:"data"`
	LastSnapshot   *live.LiveStreamData             `json:"last_snapshot,omitempty"`
	LastPositions  map[string]live.LivePositionData `json:"last_positions,omitempty"`
	LastSnapshotAt *time.Time                       `json:"last_snapshot_at,omitempty"`
}

func newSSEHub() *SSEHub {
	return &SSEHub{
		register:   make(chan *sseClient, 16),
		deregister: make(chan *sseClient, 16),
		broadcast:  make(chan sseEvent, 64),
	}
}

// run is the hub's event loop. Must be called in a goroutine.
func (h *SSEHub) run() {
	clients := make(map[*sseClient]bool)
	for {
		select {
		case c := <-h.register:
			clients[c] = true
			// Send catch-up snapshot so new clients see current state immediately.
			state := h.State()
			if state.Data != nil || state.LastSnapshot != nil {
				if data, err := json.Marshal(state); err == nil {
					select {
					case c.ch <- formatSSEFrame("snapshot", data):
					default:
					}
				}
			}
			positions := h.ActivePositions()
			if len(positions) > 0 {
				if data, err := json.Marshal(positions); err == nil {
					select {
					case c.ch <- formatSSEFrame("positions", data):
					default:
					}
				}
			}

		case c := <-h.deregister:
			if clients[c] {
				delete(clients, c)
				close(c.ch)
			}

		case ev := <-h.broadcast:
			frame := formatSSEFrame(ev.name, ev.data)
			for c := range clients {
				select {
				case c.ch <- frame:
				default:
					// Slow client — drop frame rather than block.
				}
			}
		}
	}
}

func formatSSEFrame(event string, data []byte) []byte {
	return []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", event, data))
}

// State returns the active live snapshot and the retained in-memory archive.
func (h *SSEHub) State() liveStatePayload {
	h.mu.RLock()
	defer h.mu.RUnlock()
	payload := liveStatePayload{
		IsLive: h.isLive,
	}
	if h.isLive {
		payload.Data = h.activeSnapshot
	} else if h.lastSnapshot != nil {
		payload.LastSnapshot = h.lastSnapshot
		payload.LastPositions = cloneLivePositions(h.lastPositions)
		if !h.lastSnapshotAt.IsZero() {
			at := h.lastSnapshotAt
			payload.LastSnapshotAt = &at
		}
	}
	return payload
}

func (h *SSEHub) ActivePositions() map[string]live.LivePositionData {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return cloneLivePositions(h.activePositions)
}

func (h *SSEHub) applySnapshot(data live.LiveStreamData, now time.Time) liveStatePayload {
	h.mu.Lock()
	defer h.mu.Unlock()

	if snapshotIsLive(data) {
		h.isLive = true
		h.activeSnapshot = &data
		if data.PositionUpdated && len(data.Positions) > 0 {
			h.activePositions = cloneLivePositions(data.Positions)
		}
		return liveStatePayload{IsLive: true, Data: h.activeSnapshot}
	}

	archivePositions := cloneLivePositions(h.activePositions)
	if data.PositionUpdated && len(data.Positions) > 0 {
		archivePositions = cloneLivePositions(data.Positions)
	}
	h.isLive = false
	h.activeSnapshot = nil
	h.activePositions = nil
	if hasLiveSnapshotData(data) {
		h.lastSnapshot = &data
		h.lastSnapshotAt = now
		h.lastPositions = archivePositions
	}
	return h.stateLocked()
}

func (h *SSEHub) applyPositions(data live.LiveStreamData) map[string]live.LivePositionData {
	h.mu.Lock()
	defer h.mu.Unlock()

	if len(data.Positions) == 0 {
		return nil
	}
	positions := cloneLivePositions(data.Positions)
	if h.isLive {
		h.activePositions = positions
		return positions
	}
	if h.lastSnapshot != nil {
		h.lastPositions = positions
	}
	return nil
}

func (h *SSEHub) deactivate(now time.Time) liveStatePayload {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.activeSnapshot != nil {
		h.lastSnapshot = h.activeSnapshot
		h.lastPositions = cloneLivePositions(h.activePositions)
		h.lastSnapshotAt = now
	}
	h.isLive = false
	h.activeSnapshot = nil
	h.activePositions = nil
	return h.stateLocked()
}

func (h *SSEHub) stateLocked() liveStatePayload {
	payload := liveStatePayload{IsLive: h.isLive}
	if h.isLive {
		payload.Data = h.activeSnapshot
		return payload
	}
	if h.lastSnapshot != nil {
		payload.LastSnapshot = h.lastSnapshot
		payload.LastPositions = cloneLivePositions(h.lastPositions)
		if !h.lastSnapshotAt.IsZero() {
			at := h.lastSnapshotAt
			payload.LastSnapshotAt = &at
		}
	}
	return payload
}

// snapshotIsLive reports whether the current live-timing snapshot represents an
// ongoing session that should be surfaced as live.
//
// An actively running session (Started/Resumed) is always live. A non-terminal
// but temporarily inactive session — e.g. a red-flag pause where SessionStatus
// drops to "Inactive" while the session is still in progress — is also live when
// the snapshot itself carries live evidence: a session clock with time remaining
// plus session metadata. This keeps the paused track state visible instead of
// collapsing to the inactive empty state.
//
// Terminal sessions (Finished/Finalised/Ends/Aborted) are never live. A generic
// inactive/no-session stale snapshot is not live either: the predicate keys off
// the current snapshot's clock and session, so old metadata alone is not enough.
func snapshotIsLive(data live.LiveStreamData) bool {
	if live.SessionStatusIsActive(data.SessionStatus) {
		return true
	}
	if live.SessionStatusIsTerminal(data.SessionStatus) {
		return false
	}
	return clockHasTimeRemaining(data.Clock) && data.Session.SessionName != ""
}

// clockHasTimeRemaining reports whether an "HH:MM:SS" session clock has any time
// left. Empty or all-zero clocks (a spent or absent session) return false.
func clockHasTimeRemaining(clock string) bool {
	for _, r := range clock {
		if r >= '1' && r <= '9' {
			return true
		}
	}
	return false
}

func hasLiveSnapshotData(data live.LiveStreamData) bool {
	return len(data.Drivers) > 0 ||
		len(data.DriverInfo) > 0 ||
		len(data.Tyres) > 0 ||
		len(data.Telemetry) > 0 ||
		len(data.RCMessages) > 0 ||
		len(data.TeamRadio) > 0 ||
		len(data.Stints) > 0 ||
		data.Session.MeetingName != "" ||
		data.Session.SessionName != "" ||
		data.Session.SessionType != "" ||
		data.TrackStatus != "" ||
		data.CurrentLap != 0 ||
		data.TotalLaps != 0 ||
		data.Clock != ""
}

// runLiveFeeds launches background goroutines for the F1 SignalR feed and keepalive.
func (s *Server) runLiveFeeds() {
	// Goroutine A: F1 SignalR bridge.
	go s.signalRLoop()

	// Goroutine B: SSE keepalive every 20s to prevent proxy timeouts.
	go func() {
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			s.hub.broadcast <- sseEvent{name: "heartbeat", data: []byte(`"ping"`)}
		}
	}()
}

// signalRLoop connects to the F1 live timing feed, processes updates, and
// reconnects with exponential backoff on failure.
func (s *Server) signalRLoop() {
	backoff := 5 * time.Second
	const maxBackoff = 2 * time.Minute

	for {
		if err := s.connectAndDrain(); err != nil {
			log.Printf("web: live feed ended: %v", err)
		}

		state := s.hub.deactivate(time.Now())
		if payload, err := json.Marshal(state); err == nil {
			s.hub.broadcast <- sseEvent{name: "snapshot", data: payload}
		}

		log.Printf("web: live feed reconnecting in %v", backoff)
		time.Sleep(backoff)
		if backoff < maxBackoff {
			backoff = min(backoff*2, maxBackoff)
		}
	}
}

// connectAndDrain establishes a SignalR connection and drains the data channel
// until the feed goes silent for 60 seconds.
func (s *Server) connectAndDrain() error {
	dataChan := make(chan live.LiveStreamData, 16)

	if err := live.ConnectToF1LiveTiming(dataChan); err != nil {
		return err
	}
	log.Printf("web: live feed connected")

	// Reset backoff on successful connect.
	idleTimeout := 60 * time.Second
	timer := time.NewTimer(idleTimeout)
	defer timer.Stop()
	lastPositionBroadcast := time.Time{}

	for {
		select {
		case data := <-dataChan:
			now := time.Now()
			if data.SnapshotUpdated {
				state := s.hub.applySnapshot(data, now)
				if payload, err := json.Marshal(state); err == nil {
					s.hub.broadcast <- sseEvent{name: "snapshot", data: payload}
				}
			}

			if data.PositionUpdated && len(data.Positions) > 0 && now.Sub(lastPositionBroadcast) >= 250*time.Millisecond {
				positions := s.hub.applyPositions(data)
				if len(positions) > 0 {
					payload, err := json.Marshal(positions)
					if err != nil {
						continue
					}
					s.hub.broadcast <- sseEvent{name: "positions", data: payload}
					lastPositionBroadcast = now
				}
			}

			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timer.Reset(idleTimeout)

		case <-timer.C:
			return fmt.Errorf("idle timeout (%v)", idleTimeout)
		}
	}
}

func cloneLivePositions(in map[string]live.LivePositionData) map[string]live.LivePositionData {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string]live.LivePositionData, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

// handleLiveState returns the current live data snapshot as JSON.
func (s *Server) handleLiveState(w http.ResponseWriter, r *http.Request) {
	state := s.hub.State()
	freshness := "limited"
	if state.IsLive {
		freshness = "live"
	} else if state.LastSnapshot != nil {
		freshness = "archive"
	}
	markDataResponse(w, "fia", freshness)
	writeJSON(w, state)
}

// handleSSEStream is the persistent SSE endpoint for live data.
func (s *Server) handleSSEStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	client := &sseClient{
		ch:   make(chan []byte, 8),
		done: make(chan struct{}),
	}
	s.hub.register <- client
	defer func() { s.hub.deregister <- client }()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-client.ch:
			if !ok {
				return
			}
			if _, err := w.Write(msg); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
