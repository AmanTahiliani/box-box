package web

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/AmanTahiliani/box-box/internal/ui"
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

	mu           sync.RWMutex
	lastSnapshot *ui.LiveStreamData
	isLive       bool
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
			h.mu.RLock()
			snap := h.lastSnapshot
			live := h.isLive
			h.mu.RUnlock()
			if snap != nil {
				if data, err := json.Marshal(map[string]any{"data": snap, "is_live": live}); err == nil {
					select {
					case c.ch <- formatSSEFrame("snapshot", data):
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

// Snapshot returns the latest live data snapshot and whether a session is active.
func (h *SSEHub) Snapshot() (*ui.LiveStreamData, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.lastSnapshot, h.isLive
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

		s.hub.mu.Lock()
		s.hub.isLive = false
		s.hub.mu.Unlock()

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
	dataChan := make(chan ui.LiveStreamData, 16)

	if err := ui.ConnectToF1LiveTiming(dataChan); err != nil {
		return err
	}
	log.Printf("web: live feed connected")

	// Reset backoff on successful connect.
	idleTimeout := 60 * time.Second
	timer := time.NewTimer(idleTimeout)
	defer timer.Stop()

	for {
		select {
		case data := <-dataChan:
			s.hub.mu.Lock()
			s.hub.lastSnapshot = &data
			s.hub.isLive = true
			s.hub.mu.Unlock()

			if payload, err := json.Marshal(map[string]any{"data": data, "is_live": true}); err == nil {
				s.hub.broadcast <- sseEvent{name: "snapshot", data: payload}
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

// handleLiveState returns the current live data snapshot as JSON.
func (s *Server) handleLiveState(w http.ResponseWriter, r *http.Request) {
	snap, isLive := s.hub.Snapshot()
	writeJSON(w, map[string]any{
		"is_live": isLive,
		"data":    snap,
	})
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
