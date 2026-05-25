package web

import "net/http"

const (
	sourceOpenF1 = "openf1"
	sourceLocal  = "local"
	sourceAuto   = "auto"
)

func parseSourceMode(r *http.Request) string {
	switch r.URL.Query().Get("source") {
	case sourceLocal:
		return sourceLocal
	case sourceAuto:
		return sourceAuto
	default:
		return sourceOpenF1
	}
}

func (s *Server) hasLocalQuery() bool {
	return s.query != nil
}
