package web

import (
	"net/http"
	"strconv"

	"github.com/AmanTahiliani/box-box/internal/models"
	"github.com/AmanTahiliani/box-box/internal/query"
)

func (s *Server) handleRaceHub(w http.ResponseWriter, r *http.Request) {
	sessionKey, err := strconv.Atoi(r.URL.Query().Get("session_key"))
	if err != nil || sessionKey == 0 {
		http.Error(w, "session_key required", http.StatusBadRequest)
		return
	}

	if !s.hasLocalQuery() {
		writeJSON(w, emptyRaceHub(sessionKey))
		return
	}

	hub, err := s.query.GetRaceHub(sessionKey)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, false)
		return
	}
	writeJSON(w, hub)
}

func emptyRaceHub(sessionKey int) query.RaceHub {
	return query.RaceHub{
		Source:     query.ResponseSourceNone,
		SessionKey: sessionKey,
		Datasets: map[string]query.DatasetInfo{
			"meeting":       query.DatasetInfo{Status: query.DatasetStatusMissing, Source: query.DataSourceNone, Count: 0},
			"session":       query.DatasetInfo{Status: query.DatasetStatusMissing, Source: query.DataSourceNone, Count: 0},
			"drivers":       query.DatasetInfo{Status: query.DatasetStatusMissing, Source: query.DataSourceNone, Count: 0},
			"results":       query.DatasetInfo{Status: query.DatasetStatusMissing, Source: query.DataSourceNone, Count: 0},
			"starting_grid": query.DatasetInfo{Status: query.DatasetStatusMissing, Source: query.DataSourceNone, Count: 0},
		},
		Drivers:      []models.Driver{},
		Results:      []query.EnrichedResult{},
		StartingGrid: []query.EnrichedGrid{},
	}
}
