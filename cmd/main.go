package main

import (
	"fmt"
	"os"
	"time"

	"github.com/AmanTahiliani/box-box/internal/api"
	"github.com/AmanTahiliani/box-box/internal/ui"
	tea "github.com/charmbracelet/bubbletea"
)

func main() {
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
