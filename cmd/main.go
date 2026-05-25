package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
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
	ingestMeeting := flag.Int("ingest-meeting", 0, "Ingest meeting metadata and Race Hub datasets for all sessions")
	ingestSession := flag.Int("ingest-session", 0, "Ingest Race Hub datasets for a session key")
	ingestNews := flag.Bool("ingest-news", false, "Refresh RSS/Atom paddock briefing feeds")
	dryRun := flag.Bool("dry-run", false, "Preview ingestion without writing domain rows")
	dbPath := flag.String("db", "", "Domain database path (default: ~/.local/share/box-box/boxbox.db)")
	flag.Parse()

	var client *api.OpenF1Client
	if apiKey := os.Getenv("OPENF1_API_KEY"); apiKey != "" {
		client = api.NewOpenF1ClientWithKey("https://api.openf1.org", 15*time.Second, apiKey)
	} else {
		client = api.NewOpenF1Client("https://api.openf1.org", 15*time.Second)
	}
	defer client.Close()

	// Clean up old file-based cache (one-time migration).
	go api.CleanupOldFileCache()

	ingestFlags := 0
	if *ingestYear != 0 {
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
			fmt.Fprintln(os.Stderr, "box-box: only one of --ingest-year, --ingest-meeting, --ingest-session, or --ingest-news may be set")
			os.Exit(1)
		}
		if *ingestNews {
			if err := runNewsIngestion(*dryRun, *dbPath); err != nil {
				fmt.Fprintf(os.Stderr, "box-box ingest error: %v\n", err)
				os.Exit(1)
			}
			return
		}
		if err := runIngestion(client, *ingestYear, *ingestMeeting, *ingestSession, *dryRun, *dbPath); err != nil {
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

func runIngestion(client *api.OpenF1Client, year, meetingKey, sessionKey int, dryRun bool, dbPath string) error {
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

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	result, err := news.Refresh(ctx, st, news.RefreshOptions{
		Client:   &http.Client{Timeout: 10 * time.Second},
		DryRun:   dryRun,
		Progress: os.Stderr,
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
