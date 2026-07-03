package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/ingest"
	"github.com/AmanTahiliani/box-box/internal/news"
	"github.com/AmanTahiliani/box-box/internal/store"
	"github.com/AmanTahiliani/box-box/internal/ui"
	"github.com/AmanTahiliani/box-box/internal/web"
	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	webMode := flag.Bool("web", false, "Start web companion server instead of TUI")
	port := flag.Int("port", 8080, "Port for web server (used with --web)")
	ingestYear := flag.Int("ingest-year", 0, "Ingest OpenF1 meetings for a season year")
	backfillSeason := flag.Int("backfill-season", 0, "Trigger full-season backfill/deep-ingestion for the given year")
	ingestMeeting := flag.Int("ingest-meeting", 0, "Ingest meeting metadata and Race Hub datasets for all sessions")
	ingestSession := flag.Int("ingest-session", 0, "Ingest Race Hub datasets for a session key")
	ingestNews := flag.Bool("ingest-news", false, "Refresh RSS/Atom paddock briefing feeds")
	dryRun := flag.Bool("dry-run", false, "Preview ingestion without writing domain rows")
	force := flag.Bool("force", false, "Re-ingest datasets even if already tracked in the session_coverage table as completed")
	coverageYear := flag.Int("coverage", 0, "Show season coverage report for the given year")
	dbPath := flag.String("db", "", "Domain database path (default: ~/.local/share/box-box/boxbox.db)")
	flag.Parse()

	if *coverageYear != 0 {
		if err := runCoverageReport(*coverageYear, *dbPath); err != nil {
			fmt.Fprintf(os.Stderr, "coverage report error: %v\n", err)
			os.Exit(1)
		}
		return
	}

	// BOXBOX_OPENF1_BASE_URL overrides the upstream OpenF1 API root. E2E runs
	// point it at an unreachable address so tests stay hermetic and
	// deterministic regardless of wall-clock date or network state.
	baseURL := os.Getenv("BOXBOX_OPENF1_BASE_URL")
	if baseURL == "" {
		baseURL = "https://api.openf1.org"
	}

	var client *api.OpenF1Client
	if apiKey := os.Getenv("OPENF1_API_KEY"); apiKey != "" {
		client = api.NewOpenF1ClientWithKey(baseURL, 15*time.Second, apiKey)
	} else {
		client = api.NewOpenF1Client(baseURL, 15*time.Second)
	}
	defer client.Close()

	// Clean up old file-based cache (one-time migration).
	go api.CleanupOldFileCache()

	ingestFlags := 0
	if *ingestYear != 0 {
		ingestFlags++
	}
	if *backfillSeason != 0 {
		ingestFlags++
	}
	if *ingestMeeting != 0 {
		ingestFlags++
	}
	if *ingestSession != 0 {
		ingestFlags++
	}
	if *ingestNews {
		ingestFlags++
	}
	if ingestFlags > 0 {
		if ingestFlags > 1 {
			fmt.Fprintln(os.Stderr, "box-box: only one of --ingest-year, --backfill-season, --ingest-meeting, --ingest-session, or --ingest-news may be set")
			os.Exit(1)
		}
		if *ingestNews {
			if err := runNewsIngestion(*dryRun, *dbPath); err != nil {
				fmt.Fprintf(os.Stderr, "box-box ingest error: %v\n", err)
				os.Exit(1)
			}
			return
		}
		
		yearVal := *ingestYear
		if *backfillSeason != 0 {
			yearVal = *backfillSeason
		}

		if err := runIngestion(client, yearVal, *ingestMeeting, *ingestSession, *force, *dryRun, *dbPath); err != nil {
			fmt.Fprintf(os.Stderr, "box-box ingest error: %v\n", err)
			os.Exit(1)
		}
		return
	}

	if *webMode {
		log.SetOutput(os.Stderr) // web mode logs to stderr, not file
		fmt.Printf("box-box web  →  http://localhost:%d\n", *port)

		var domainStore *store.Store
		db := *dbPath
		if db == "" {
			db = store.DefaultDBPath()
		}
		if st, err := store.Open(db); err != nil {
			log.Printf("web: domain database unavailable (%s): %v", db, err)
		} else {
			domainStore = st
			defer domainStore.Close()
		}

		srv := web.NewServer(client, *port, domainStore)
		log.Fatal(srv.Start())
		return
	}

	// TUI mode: redirect logs to file so they don't pollute the terminal.
	if f, err := os.OpenFile("box-box.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644); err == nil {
		log.SetOutput(f)
		defer f.Close()
	}

	model := ui.NewAppModel(client)

	p := tea.NewProgram(
		model,
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "box-box error: %v\n", err)
		os.Exit(1)
	}
}

func runIngestion(client *api.OpenF1Client, year, meetingKey, sessionKey int, force, dryRun bool, dbPath string) error {
	log.SetOutput(os.Stderr)

	path := dbPath
	if path == "" {
		path = store.DefaultDBPath()
	}

	st, err := store.Open(path)
	if err != nil {
		return fmt.Errorf("open domain database: %w", err)
	}
	defer st.Close()

	opts := ingest.DefaultOptions()
	opts.DryRun = dryRun
	opts.Force = force
	opts.Progress = ingest.NewProgress(os.Stderr)

	svc := ingest.NewService(st, ingest.NewOpenF1Source(client), opts)

	switch {
	case year != 0:
		_, err = svc.IngestYear(year)
	case meetingKey != 0:
		_, err = svc.IngestMeeting(meetingKey)
	case sessionKey != 0:
		_, err = svc.IngestSession(sessionKey)
	}
	return err
}

func runNewsIngestion(dryRun bool, dbPath string) error {
	log.SetOutput(os.Stderr)

	path := dbPath
	if path == "" {
		path = store.DefaultDBPath()
	}

	var st *store.Store
	if !dryRun {
		var err error
		st, err = store.Open(path)
		if err != nil {
			return fmt.Errorf("open domain database: %w", err)
		}
		defer st.Close()
	}

	if dryRun {
		fmt.Fprintf(os.Stderr, "news: dry run, not writing to %s\n", path)
	} else {
		fmt.Fprintf(os.Stderr, "news: refreshing feeds into %s\n", path)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	result, err := news.Refresh(ctx, st, news.RefreshOptions{
		Client:   &http.Client{Timeout: 10 * time.Second},
		DryRun:   dryRun,
		Progress: os.Stderr,
		EnrichOG: !dryRun,
	})
	fmt.Fprintf(
		os.Stderr,
		"news: %d source(s) fetched, %d failed, %d item(s) fetched, %d upserted\n",
		result.SourcesFetched,
		result.SourcesFailed,
		result.ItemsFetched,
		result.ItemsUpserted,
	)
	return err
}

func runCoverageReport(year int, dbPath string) error {
	path := dbPath
	if path == "" {
		path = store.DefaultDBPath()
	}

	st, err := store.Open(path)
	if err != nil {
		return fmt.Errorf("open domain database: %w", err)
	}
	defer st.Close()

	rows, err := st.GetSeasonCoverage(year)
	if err != nil {
		return fmt.Errorf("get season coverage: %w", err)
	}

	if len(rows) == 0 {
		fmt.Printf("No session coverage data found for year %d.\n", year)
		return nil
	}

	type datasetStatus struct {
		Status string
		Count  int
	}

	type sessionInfo struct {
		MeetingName string
		SessionName string
		SessionKey  int
		Datasets    map[string]datasetStatus
	}

	var sessions []sessionInfo
	sessionMap := make(map[int]int)

	for _, row := range rows {
		idx, exists := sessionMap[row.SessionKey]
		if !exists {
			idx = len(sessions)
			sessions = append(sessions, sessionInfo{
				MeetingName: row.MeetingName,
				SessionName: row.SessionName,
				SessionKey:  row.SessionKey,
				Datasets:    make(map[string]datasetStatus),
			})
			sessionMap[row.SessionKey] = idx
		}
		if row.Dataset != "" {
			sessions[idx].Datasets[row.Dataset] = datasetStatus{
				Status: row.Status,
				Count:  row.RowCount,
			}
		}
	}

	fmt.Printf("\n--- Season %d Coverage Report ---\n\n", year)
	fmt.Printf("%-35s | %-5s | %-2s | %-2s | %-2s | %-2s | %-2s | %-2s | %-2s | %-2s | %-2s\n", 
		"Meeting / Session (Key)", "ID", "DR", "SR", "SG", "ST", "PS", "PO", "RC", "WE", "LA")
	fmt.Println(strings.Repeat("-", 82))

	for _, sess := range sessions {
		statusChar := func(ds string) string {
			dsStatus, ok := sess.Datasets[ds]
			if !ok {
				return "."
			}
			switch dsStatus.Status {
			case "complete":
				return "✓"
			case "failed":
				return "✗"
			default:
				return "."
			}
		}

		nameCol := fmt.Sprintf("%s - %s (%d)", sess.MeetingName, sess.SessionName, sess.SessionKey)
		if len(nameCol) > 35 {
			nameCol = nameCol[:32] + "..."
		}

		fmt.Printf("%-35s | %-5d |  %s |  %s |  %s |  %s |  %s |  %s |  %s |  %s |  %s\n",
			nameCol,
			sess.SessionKey,
			statusChar("drivers"),
			statusChar("session_result"),
			statusChar("starting_grid"),
			statusChar("stints"),
			statusChar("pit_stops"),
			statusChar("positions"),
			statusChar("race_control"),
			statusChar("weather"),
			statusChar("laps"),
		)
	}

	fmt.Println(strings.Repeat("-", 82))
	fmt.Println("\nLegend:")
	fmt.Println("  [✓] Complete   [✗] Failed   [.] Pending/Unattempted")
	fmt.Println("Datasets:")
	fmt.Println("  DR: drivers          SR: session_result   SG: starting_grid")
	fmt.Println("  ST: stints           PS: pit_stops        PO: positions")
	fmt.Println("  RC: race_control     WE: weather          LA: laps")
	fmt.Println()

	return nil
}
