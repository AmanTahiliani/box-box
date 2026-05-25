package ingest

import (
	"fmt"
	"io"
	"os"
)

// Progress reports ingestion progress to a writer.
type Progress struct {
	w io.Writer
}

// NewProgress returns a progress helper writing to w, or stderr when w is nil.
func NewProgress(w io.Writer) *Progress {
	if w == nil {
		w = os.Stderr
	}
	return &Progress{w: w}
}

func (p *Progress) Step(format string, args ...any) {
	fmt.Fprintf(p.w, "ingest: "+format+"\n", args...)
}

func (p *Progress) Summary(summary Summary) {
	fmt.Fprintf(p.w, "\ningest summary (%s %s): status=%s\n", summary.ScopeType, summary.ScopeKey, summary.Status)
	if summary.Meetings > 0 {
		fmt.Fprintf(p.w, "  meetings: %d\n", summary.Meetings)
	}
	if summary.Sessions > 0 {
		fmt.Fprintf(p.w, "  sessions: %d\n", summary.Sessions)
	}
	if summary.Drivers > 0 {
		fmt.Fprintf(p.w, "  drivers: %d\n", summary.Drivers)
	}
	if summary.SessionResults > 0 {
		fmt.Fprintf(p.w, "  session results: %d\n", summary.SessionResults)
	}
	if summary.StartingGrid > 0 {
		fmt.Fprintf(p.w, "  starting grid: %d\n", summary.StartingGrid)
	}
	if summary.RawPayloads > 0 {
		fmt.Fprintf(p.w, "  raw payloads fetched: %d (inserted: %d)\n", summary.RawPayloads, summary.RawInserted)
	}
	for _, errMsg := range summary.Errors {
		fmt.Fprintf(p.w, "  error: %s\n", errMsg)
	}
}
