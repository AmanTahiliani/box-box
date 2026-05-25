package api

import (
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

func TestLatestCompletedRaceSessionKeyUsesDatesNotInputOrder(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	sessions := []models.Session{
		{
			SessionKey:  1,
			SessionName: "Race",
			DateStart:   "2025-12-01T13:00:00+00:00",
			DateEnd:     "2025-12-01T15:00:00+00:00",
		},
		{
			SessionKey:  2,
			SessionName: "Race",
			DateStart:   "2025-03-01T13:00:00+00:00",
			DateEnd:     "2025-03-01T15:00:00+00:00",
		},
	}

	sessionKey, ok := latestCompletedRaceSessionKey(sessions, now)
	if !ok {
		t.Fatal("expected a completed race")
	}
	if sessionKey != 1 {
		t.Fatalf("sessionKey = %d, want 1", sessionKey)
	}
}

func TestLatestCompletedRaceSessionKeyIgnoresFutureSessions(t *testing.T) {
	now := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	sessions := []models.Session{
		{
			SessionKey:  1,
			SessionName: "Race",
			DateStart:   "2025-12-01T13:00:00+00:00",
			DateEnd:     "2025-12-01T15:00:00+00:00",
		},
		{
			SessionKey:  2,
			SessionName: "Race",
			DateStart:   "2025-05-01T13:00:00+00:00",
			DateEnd:     "2025-05-01T15:00:00+00:00",
		},
	}

	sessionKey, ok := latestCompletedRaceSessionKey(sessions, now)
	if !ok {
		t.Fatal("expected a completed race")
	}
	if sessionKey != 2 {
		t.Fatalf("sessionKey = %d, want 2", sessionKey)
	}
}
