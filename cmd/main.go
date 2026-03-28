package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/ui"
	"github.com/AmanTahiliani/box-box/internal/web"
	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	webMode := flag.Bool("web", false, "Start web companion server instead of TUI")
	port := flag.Int("port", 8080, "Port for web server (used with --web)")
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

	if *webMode {
		log.SetOutput(os.Stderr) // web mode logs to stderr, not file
		fmt.Printf("box-box web  →  http://localhost:%d\n", *port)
		srv := web.NewServer(client, *port)
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
