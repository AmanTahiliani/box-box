package web

import (
	"net/http"

	"github.com/AmanTahiliani/box-box/internal/api"
)

const (
	dataSourceHeader    = "X-BoxBox-Data-Source"
	dataFreshnessHeader = "X-BoxBox-Data-Freshness"
)

// markOpenF1Response publishes request-scoped success provenance. Callers must
// pass the scoped client used for this response, never Server.client.
func markOpenF1Response(w http.ResponseWriter, client *api.OpenF1Client) {
	markOpenF1AggregateResponse(w, client, false)
}

func markOpenF1AggregateResponse(w http.ResponseWriter, client *api.OpenF1Client, partial bool) {
	freshness := "fresh"
	if partial {
		freshness = "partial"
	}
	markOpenF1Availability(w, client, freshness)
}

func markOpenF1Availability(w http.ResponseWriter, client *api.OpenF1Client, freshness string) {
	w.Header().Set(dataSourceHeader, "openf1")
	if client != nil && client.LastResponseWasStale() {
		w.Header().Set(dataFreshnessHeader, "stale")
		return
	}
	if freshness == "" {
		freshness = "fresh"
	}
	w.Header().Set(dataFreshnessHeader, freshness)
}

func markDataResponse(w http.ResponseWriter, source, freshness string) {
	w.Header().Set(dataSourceHeader, source)
	w.Header().Set(dataFreshnessHeader, freshness)
}

func markLocalResponse(w http.ResponseWriter, partial bool) {
	w.Header().Set(dataSourceHeader, "local")
	if partial {
		w.Header().Set(dataFreshnessHeader, "partial")
		return
	}
	w.Header().Set(dataFreshnessHeader, "local")
}

func markMixedResponse(w http.ResponseWriter, client *api.OpenF1Client, partial bool) {
	w.Header().Set(dataSourceHeader, "mixed")
	if client != nil && client.LastResponseWasStale() {
		w.Header().Set(dataFreshnessHeader, "stale")
	} else if partial {
		w.Header().Set(dataFreshnessHeader, "partial")
	} else {
		w.Header().Set(dataFreshnessHeader, "local")
	}
}
