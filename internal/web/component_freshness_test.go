package web

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
)

func componentTestServer(t *testing.T, responses map[string]string, failures map[string]bool) *Server {
	t.Helper()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if failures[r.URL.Path] {
			http.Error(w, "component unavailable", http.StatusBadGateway)
			return
		}
		body, ok := responses[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(upstream.Close)
	client := api.NewOpenF1Client(upstream.URL, 2*time.Second)
	t.Cleanup(func() { _ = client.Close() })
	return NewServer(client, 0, nil)
}

func assertAvailabilityHeaders(t *testing.T, recorder *httptest.ResponseRecorder, source, freshness string) {
	t.Helper()
	if recorder.Code != http.StatusOK || recorder.Header().Get(dataSourceHeader) != source || recorder.Header().Get(dataFreshnessHeader) != freshness {
		t.Fatalf("response = status %d, metadata %q/%q, body=%s", recorder.Code, recorder.Header().Get(dataSourceHeader), recorder.Header().Get(dataFreshnessHeader), recorder.Body.String())
	}
}

func TestResultsAndGridIdentityFailuresReportPartial(t *testing.T) {
	tests := []struct {
		name string
		path string
		body string
		run  func(*Server, http.ResponseWriter, *http.Request)
	}{
		{name: "results", path: "/v1/session_result", body: `[{"driver_number":1,"position":1}]`, run: func(s *Server, w http.ResponseWriter, r *http.Request) { s.handleResults(w, r) }},
		{name: "grid", path: "/v1/starting_grid", body: `[{"driver_number":1,"position":1}]`, run: func(s *Server, w http.ResponseWriter, r *http.Request) { s.handleGrid(w, r) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := componentTestServer(t, map[string]string{tt.path: tt.body}, map[string]bool{"/v1/drivers": true})
			recorder := httptest.NewRecorder()
			tt.run(server, recorder, httptest.NewRequest(http.MethodGet, "/api/v1/"+tt.name+"?session_key=99&source=openf1", nil))
			assertAvailabilityHeaders(t, recorder, "openf1", "partial")
		})
	}
}

func TestStrategyOptionalComponentFailureReportsPartial(t *testing.T) {
	server := componentTestServer(t, map[string]string{
		"/v1/stints":         `[{"driver_number":1,"stint_number":1,"lap_start":1,"lap_end":10,"compound":"MEDIUM"}]`,
		"/v1/pit":            `[]`,
		"/v1/session_result": `[{"driver_number":1,"position":1,"number_of_laps":10}]`,
		"/v1/race_control":   `[]`,
	}, map[string]bool{"/v1/drivers": true})
	recorder := httptest.NewRecorder()
	server.handleStrategy(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/strategy?session_key=99", nil))
	assertAvailabilityHeaders(t, recorder, "openf1", "partial")
}

func TestStrategyEmptyPrimaryDataReportsLimited(t *testing.T) {
	server := componentTestServer(t, map[string]string{
		"/v1/stints":         `[]`,
		"/v1/pit":            `[]`,
		"/v1/session_result": `[{"driver_number":1,"position":1,"number_of_laps":10}]`,
		"/v1/drivers":        `[{"driver_number":1,"full_name":"Max Verstappen","team_name":"Red Bull","team_colour":"3671c6"}]`,
		"/v1/race_control":   `[]`,
	}, nil)
	recorder := httptest.NewRecorder()
	server.handleStrategy(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/strategy?session_key=99", nil))
	assertAvailabilityHeaders(t, recorder, "openf1", "limited")
}

func TestLapsComparisonDoesNotLabelMissingComponentsFresh(t *testing.T) {
	tests := []struct {
		name      string
		laps      string
		freshness string
	}{
		{name: "empty primary data", laps: `[]`, freshness: "limited"},
		{name: "optional components failed", laps: `[{"driver_number":1,"lap_number":1}]`, freshness: "partial"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := componentTestServer(t, map[string]string{"/v1/laps": tt.laps}, map[string]bool{
				"/v1/stints":       true,
				"/v1/pit":          true,
				"/v1/race_control": true,
				"/v1/drivers":      true,
			})
			recorder := httptest.NewRecorder()
			server.handleLapsComparison(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/laps/comparison?session_key=99", nil))
			assertAvailabilityHeaders(t, recorder, "openf1", tt.freshness)
		})
	}
	t.Run("primary laps failure is an error", func(t *testing.T) {
		server := componentTestServer(t, nil, map[string]bool{
			"/v1/laps":         true,
			"/v1/stints":       true,
			"/v1/pit":          true,
			"/v1/race_control": true,
		})
		recorder := httptest.NewRecorder()
		server.handleLapsComparison(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/laps/comparison?session_key=99", nil))
		if recorder.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
		}
	})
}
