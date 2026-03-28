package web

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"strings"

	"github.com/AmanTahiliani/box-box/internal/api"
)

//go:embed assets
var assetsFS embed.FS

// Server is the box-box web companion HTTP server.
type Server struct {
	client *api.OpenF1Client
	hub    *SSEHub
	addr   string
}

// NewServer creates a new Server. Call Start() to begin serving.
func NewServer(client *api.OpenF1Client, port int) *Server {
	return &Server{
		client: client,
		hub:    newSSEHub(),
		addr:   fmt.Sprintf(":%d", port),
	}
}

// Start registers routes, launches background goroutines, and begins serving.
func (s *Server) Start() error {
	mux := http.NewServeMux()

	// REST API — /api/v1/laps/comparison must be registered before /api/v1/laps
	// because Go's ServeMux uses longest-prefix matching.
	mux.HandleFunc("/api/v1/meetings", s.handleMeetings)
	mux.HandleFunc("/api/v1/sessions", s.handleSessions)
	mux.HandleFunc("/api/v1/drivers", s.handleDrivers)
	mux.HandleFunc("/api/v1/results", s.handleResults)
	mux.HandleFunc("/api/v1/grid", s.handleGrid)
	mux.HandleFunc("/api/v1/laps/comparison", s.handleLapsComparison)
	mux.HandleFunc("/api/v1/laps", s.handleLaps)
	mux.HandleFunc("/api/v1/weather", s.handleWeather)
	mux.HandleFunc("/api/v1/race-control", s.handleRaceControl)
	mux.HandleFunc("/api/v1/telemetry", s.handleTelemetry)
	mux.HandleFunc("/api/v1/overtakes", s.handleOvertakes)
	mux.HandleFunc("/api/v1/team-radio", s.handleTeamRadio)
	mux.HandleFunc("/api/v1/championship/drivers", s.handleChampionshipDrivers)
	mux.HandleFunc("/api/v1/championship/teams", s.handleChampionshipTeams)
	mux.HandleFunc("/api/v1/track-outline", s.handleTrackOutline)
	mux.HandleFunc("/api/v1/strategy", s.handleStrategy)
	mux.HandleFunc("/api/v1/live/state", s.handleLiveState)
	mux.HandleFunc("/api/v1/live/stream", s.handleSSEStream)

	// Static files + SPA catchall
	subFS, err := fs.Sub(assetsFS, "assets")
	if err != nil {
		return err
	}
	fileServer := http.FileServer(http.FS(subFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If the path maps to a real asset file, serve it directly.
		if r.URL.Path != "/" {
			p := strings.TrimPrefix(r.URL.Path, "/")
			if f, err := subFS.Open(p); err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		// SPA catchall: all unknown paths serve index.html.
		r2 := *r
		r2.URL.Path = "/"
		fileServer.ServeHTTP(w, &r2)
	})

	// Start background goroutines.
	go s.hub.run()
	go s.runLiveFeeds()

	return http.ListenAndServe(s.addr, withCORS(withLogging(mux)))
}

// withCORS adds permissive CORS headers (localhost use only).
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// withLogging logs each request to stderr.
func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("web: %s %s", r.Method, r.URL.RequestURI())
		next.ServeHTTP(w, r)
	})
}
