package web

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/query"
	"github.com/AmanTahiliani/box-box/internal/store"
)

//go:embed assets
var assetsFS embed.FS

// Server is the box-box web companion HTTP server.
type Server struct {
	client   *api.OpenF1Client
	query    *query.Service
	hub      *SSEHub
	addr     string
	hubCache champHubCache // aggregated championship hub responses, keyed by year
}

// NewServer creates a new Server. Call Start() to begin serving.
// When st is non-nil, local-first read models are available from the domain DB.
func NewServer(client *api.OpenF1Client, port int, st *store.Store) *Server {
	s := &Server{
		client: client,
		hub:    newSSEHub(),
		addr:   fmt.Sprintf(":%d", port),
	}
	if st != nil {
		s.query = query.NewService(st)
	}
	return s
}

// Start registers routes, launches background goroutines, and begins serving.
func (s *Server) Start() error {
	handler, err := s.routes()
	if err != nil {
		return err
	}

	// Start background goroutines.
	go s.hub.run()
	if os.Getenv("BOXBOX_DISABLE_LIVE") != "1" {
		go s.runLiveFeeds()
	}

	return http.ListenAndServe(s.addr, withCORS(withLogging(handler)))
}

func (s *Server) routes() (http.Handler, error) {
	mux := http.NewServeMux()

	// REST API — /api/v1/laps/comparison must be registered before /api/v1/laps
	// because Go's ServeMux uses longest-prefix matching.
	mux.HandleFunc("/api/v1/race-hub", s.handleRaceHub)
	mux.HandleFunc("/api/v1/seasons", s.handleSeasons)
	mux.HandleFunc("/api/v1/weekend", s.handleWeekend)
	mux.HandleFunc("/api/v1/news/article", s.handleNewsArticle)
	mux.HandleFunc("/api/v1/news/read", s.handleNewsRead)
	mux.HandleFunc("/api/v1/news", s.handleNews)
	mux.HandleFunc("/api/v1/meetings", s.handleMeetings)
	mux.HandleFunc("/api/v1/sessions", s.handleSessions)
	mux.HandleFunc("/api/v1/drivers", s.handleDrivers)
	mux.HandleFunc("/api/v1/results", s.handleResults)
	mux.HandleFunc("/api/v1/grid", s.handleGrid)
	mux.HandleFunc("/api/v1/laps/comparison", s.handleLapsComparison)
	mux.HandleFunc("/api/v1/laps", s.handleLaps)
	mux.HandleFunc("/api/v1/replay/frames", s.handleReplayFrames)
	mux.HandleFunc("/api/v1/weather", s.handleWeather)
	mux.HandleFunc("/api/v1/race-control", s.handleRaceControl)
	mux.HandleFunc("/api/v1/telemetry", s.handleTelemetry)
	mux.HandleFunc("/api/v1/overtakes", s.handleOvertakes)
	mux.HandleFunc("/api/v1/team-radio", s.handleTeamRadio)
	mux.HandleFunc("/api/v1/championship/drivers", s.handleChampionshipDrivers)
	mux.HandleFunc("/api/v1/championship/teams", s.handleChampionshipTeams)
	mux.HandleFunc("/api/v1/championship/hub", s.handleChampionshipHub)
	mux.HandleFunc("/api/v1/track-outline", s.handleTrackOutline)
	mux.HandleFunc("/api/v1/strategy", s.handleStrategy)
	mux.HandleFunc("/api/v1/live/state", s.handleLiveState)
	mux.HandleFunc("/api/v1/live/stream", s.handleSSEStream)

	// Static files + SPA catchall
	staticFS, err := selectStaticFS()
	if err != nil {
		return nil, err
	}
	mux.Handle("/", spaFileServer(staticFS))

	return mux, nil
}

func selectStaticFS() (fs.FS, error) {
	if dist, ok := findFrontendDist("."); ok {
		return os.DirFS(dist), nil
	}
	return fs.Sub(assetsFS, "assets")
}

func findFrontendDist(start string) (string, bool) {
	dir, err := filepath.Abs(start)
	if err != nil {
		return "", false
	}

	for {
		dist := filepath.Join(dir, "frontend", "dist")
		index := filepath.Join(dist, "index.html")
		if info, err := os.Stat(index); err == nil && !info.IsDir() {
			return dist, true
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false
		}
		dir = parent
	}
}

func spaFileServer(staticFS fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(staticFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// If the path maps to a real asset file, serve it directly.
		if r.URL.Path != "/" {
			p := strings.TrimPrefix(r.URL.Path, "/")
			if fs.ValidPath(p) {
				if info, err := fs.Stat(staticFS, p); err == nil && !info.IsDir() {
					fileServer.ServeHTTP(w, r)
					return
				}
			}
		}

		// SPA catchall: all unknown paths serve index.html.
		r2 := *r
		r2.URL.Path = "/"
		fileServer.ServeHTTP(w, &r2)
	})
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
