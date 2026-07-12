package chapters

import (
	"testing"

	"github.com/AmanTahiliani/box-box/internal/models"
)

func TestHeadlineStart(t *testing.T) {
	ch := Chapter{Kind: KindStart, Title: "Start", StartLap: 1, EndLap: 1}
	got := headlineFor(ch, nil, nil, 0)
	want := "Race start — Lap 1 shuffle at the front"
	if got != want {
		t.Fatalf("headline = %q, want %q", got, want)
	}
}

func TestHeadlineStartVariantByLap(t *testing.T) {
	ch := Chapter{Kind: KindStart, Title: "Start", StartLap: 2, EndLap: 2}
	got := headlineFor(ch, nil, nil, 0)
	want := "Lights out — the field charges into Turn 1"
	if got != want {
		t.Fatalf("headline = %q, want %q", got, want)
	}
}

func TestHeadlineSafetyCarWithDriver(t *testing.T) {
	drivers := BuildDriverMap(nil, []DriverIdentityInput{
		{DriverNumber: 55, NameAcronym: "SAI", FullName: "Carlos Sainz", TeamName: "Ferrari"},
	})
	rc := []RaceControl{
		{
			DriverNumber: intPtr(55),
			LapNumber:    intPtr(12),
			Message:      "CAR 55 STOPPED ON TRACK",
		},
		rc(12, models.CategorySafetyCar, "", "SAFETY CAR DEPLOYED"),
		rc(15, models.CategorySafetyCar, "", "SAFETY CAR IN THIS LAP"),
	}
	ch := Chapter{
		Kind:     KindSafetyCar,
		Title:    "Safety Car (L12-L15)",
		StartLap: 12,
		EndLap:   15,
	}
	got := headlineFor(ch, drivers, rc, 0)
	want := "Sainz incident brings out the Safety Car — leaders dive for the pits"
	if got != want {
		t.Fatalf("headline = %q, want %q", got, want)
	}
}

func TestHeadlineSafetyCarFallbackWithoutDriver(t *testing.T) {
	ch := Chapter{
		Kind:     KindSafetyCar,
		Title:    "Safety Car (L12-L15)",
		StartLap: 12,
		EndLap:   15,
	}
	got := headlineFor(ch, nil, nil, 0)
	if got != ch.Title {
		t.Fatalf("headline = %q, want fallback %q", got, ch.Title)
	}
}

func TestHeadlineVirtualSafetyCar(t *testing.T) {
	drivers := BuildDriverMap(nil, []DriverIdentityInput{
		{DriverNumber: 16, NameAcronym: "LEC", FullName: "Charles Leclerc", TeamName: "Ferrari"},
	})
	rc := []RaceControl{
		{
			DriverNumber: intPtr(16),
			LapNumber:    intPtr(22),
			Message:      "CAR 16 OFF TRACK",
		},
		rc(22, models.CategoryOther, "", "VSC DEPLOYED"),
		rc(24, models.CategoryOther, "", "VSC ENDING"),
	}
	ch := Chapter{
		Kind:     KindVirtualSafetyCar,
		Title:    "Virtual Safety Car (L22-L24)",
		StartLap: 22,
		EndLap:   24,
	}
	got := headlineFor(ch, drivers, rc, 0)
	want := "Leclerc off track triggers the Virtual Safety Car"
	if got != want {
		t.Fatalf("headline = %q, want %q", got, want)
	}
}

func TestHeadlineRedFlag(t *testing.T) {
	drivers := BuildDriverMap(nil, []DriverIdentityInput{
		{DriverNumber: 63, NameAcronym: "RUS", FullName: "George Russell", TeamName: "Mercedes"},
	})
	rc := []RaceControl{
		{
			DriverNumber: intPtr(63),
			LapNumber:    intPtr(31),
			Message:      "INCIDENT INVOLVING CAR 63",
		},
		rc(31, models.CategoryFlag, models.FlagRed, "RED FLAG"),
		rc(33, models.CategoryFlag, models.FlagGreen, "GREEN FLAG"),
	}
	ch := Chapter{
		Kind:     KindRedFlag,
		Title:    "Red Flag (L31-L33)",
		StartLap: 31,
		EndLap:   33,
	}
	got := headlineFor(ch, drivers, rc, 0)
	want := "Red flag after Russell incident on Lap 31"
	if got != want {
		t.Fatalf("headline = %q, want %q", got, want)
	}
}

func TestHeadlinePitPhase(t *testing.T) {
	drivers := BuildDriverMap(nil, []DriverIdentityInput{
		{DriverNumber: 1, NameAcronym: "VER", FullName: "Max Verstappen", TeamName: "Red Bull"},
		{DriverNumber: 44, NameAcronym: "HAM", FullName: "Lewis Hamilton", TeamName: "Mercedes"},
		{DriverNumber: 16, NameAcronym: "LEC", FullName: "Charles Leclerc", TeamName: "Ferrari"},
	})
	ch := Chapter{
		Kind:          KindPitPhase,
		Title:         "Pit phase (L20-L22)",
		StartLap:      20,
		EndLap:        22,
		DriverNumbers: []int{1, 44, 16},
	}
	got := headlineFor(ch, drivers, nil, 0)
	want := "Mass pit-window scramble — Verstappen and Hamilton box on L20–L22"
	if got != want {
		t.Fatalf("headline = %q, want %q", got, want)
	}
}

func TestHeadlineDecisiveSwing(t *testing.T) {
	drivers := BuildDriverMap(nil, []DriverIdentityInput{
		{DriverNumber: 16, NameAcronym: "LEC", FullName: "Charles Leclerc", TeamName: "Ferrari"},
		{DriverNumber: 55, NameAcronym: "SAI", FullName: "Carlos Sainz", TeamName: "Ferrari"},
	})
	ch := Chapter{
		Kind:          KindDecisiveSwing,
		Title:         "Decisive swing: #16 to P3 (L6)",
		StartLap:      6,
		EndLap:        6,
		DriverNumbers: []int{16, 55},
	}
	got := headlineFor(ch, drivers, nil, 0)
	want := "Leclerc overtakes Sainz for P3"
	if got != want {
		t.Fatalf("headline = %q, want %q", got, want)
	}
}

func TestHeadlineFinish(t *testing.T) {
	drivers := BuildDriverMap(nil, []DriverIdentityInput{
		{DriverNumber: 1, NameAcronym: "VER", FullName: "Max Verstappen", TeamName: "Red Bull"},
	})
	ch := Chapter{
		Kind:     KindFinish,
		Title:    "Finish (L57-L58)",
		StartLap: 57,
		EndLap:   58,
	}
	got := headlineFor(ch, drivers, nil, 1)
	want := "Chequered flag — Verstappen wins the race"
	if got != want {
		t.Fatalf("headline = %q, want %q", got, want)
	}
}

func TestHeadlineFinishFallbackWithoutWinner(t *testing.T) {
	ch := Chapter{
		Kind:     KindFinish,
		Title:    "Finish (L57-L58)",
		StartLap: 57,
		EndLap:   58,
	}
	got := headlineFor(ch, nil, nil, 0)
	if got != ch.Title {
		t.Fatalf("headline = %q, want fallback %q", got, ch.Title)
	}
}

func TestApplyHeadlinesPreservesChapterFields(t *testing.T) {
	input := []Chapter{
		{Kind: KindStart, Title: "Start", StartLap: 1, EndLap: 1},
	}
	got := ApplyHeadlines(input, nil, nil, 0)
	if len(got) != 1 || got[0].StartLap != 1 || got[0].Headline == "" {
		t.Fatalf("ApplyHeadlines = %+v, want headline on start chapter", got)
	}
}

func intPtr(v int) *int {
	return &v
}
