package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/ui"
	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	// Redirect all log output to a file so it never pollutes the TUI.
	if f, err := os.OpenFile("box-box.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644); err == nil {
		log.SetOutput(f)
		defer f.Close()
	}

	var client *api.OpenF1Client
	if apiKey := os.Getenv("OPENF1_API_KEY"); apiKey != "" {
		client = api.NewOpenF1ClientWithKey("https://api.openf1.org", 15*time.Second, apiKey)
	} else {
		client = api.NewOpenF1Client("https://api.openf1.org", 15*time.Second)
	}
	defer client.Close()

	// Clean up old file-based cache (one-time migration).
	go api.CleanupOldFileCache()

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
