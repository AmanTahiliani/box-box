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
	client := api.NewOpenF1Client("https://api.openf1.org", 15*time.Second)
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
