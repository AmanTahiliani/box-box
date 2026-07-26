package web

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/AmanTahiliani/box-box/internal/query"
)

func (s *Server) handleSeasons(w http.ResponseWriter, r *http.Request) {
	markLocalResponse(w, false)
	if !s.hasLocalQuery() {
		writeJSON(w, []int{})
		return
	}

	years, err := s.query.ListSeasons()
	if err != nil {
		writeError(w, err, http.StatusInternalServerError, false)
		return
	}
	if years == nil {
		years = []int{}
	}
	writeJSON(w, years)
}

func (s *Server) handleWeekend(w http.ResponseWriter, r *http.Request) {
	markLocalResponse(w, false)
	meetingKey, err := strconv.Atoi(r.URL.Query().Get("meeting_key"))
	if err != nil || meetingKey == 0 {
		http.Error(w, "meeting_key required", http.StatusBadRequest)
		return
	}

	if !s.hasLocalQuery() {
		writeError(w, query.ErrMeetingNotFound, http.StatusNotFound, false)
		return
	}

	weekend, err := s.query.GetWeekend(meetingKey)
	if err != nil {
		if errors.Is(err, query.ErrMeetingNotFound) {
			writeError(w, err, http.StatusNotFound, false)
			return
		}
		writeError(w, err, http.StatusInternalServerError, false)
		return
	}
	markLocalResponse(w, weekend.Source == query.ResponseSourcePartial)
	writeJSON(w, weekend)
}
