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
	if summary.Stints > 0 {
		fmt.Fprintf(p.w, "  stints: %d\n", summary.Stints)
	}
	if summary.PitStops > 0 {
		fmt.Fprintf(p.w, "  pit stops: %d\n", summary.PitStops)
	}
	if summary.Positions > 0 {
		fmt.Fprintf(p.w, "  positions: %d\n", summary.Positions)
	}
	if summary.RaceControl > 0 {
		fmt.Fprintf(p.w, "  race control: %d\n", summary.RaceControl)
	}
	if summary.Weather > 0 {
		fmt.Fprintf(p.w, "  weather: %d\n", summary.Weather)
	}
	if summary.Laps > 0 {
		fmt.Fprintf(p.w, "  laps: %d\n", summary.Laps)
	}
	if summary.RawPayloads > 0 {
		fmt.Fprintf(p.w, "  raw payloads fetched: %d (inserted: %d)\n", summary.RawPayloads, summary.RawInserted)
	}
	for _, ss := range summary.SessionSummaries {
		fmt.Fprintf(p.w, "  session %d (%s): status=%s", ss.SessionKey, ss.SessionName, ss.Summary.Status)
		if ss.Summary.Drivers > 0 || ss.Summary.SessionResults > 0 {
			fmt.Fprintf(p.w, " drivers=%d results=%d", ss.Summary.Drivers, ss.Summary.SessionResults)
		}
		if ss.Summary.RawPayloads > 0 {
			fmt.Fprintf(p.w, " raw=%d", ss.Summary.RawPayloads)
		}
		fmt.Fprintln(p.w)
		for _, errMsg := range ss.Summary.Errors {
			fmt.Fprintf(p.w, "    error: %s\n", errMsg)
		}
	}
	for _, errMsg := range summary.Errors {
		fmt.Fprintf(p.w, "  error: %s\n", errMsg)
	}
}
