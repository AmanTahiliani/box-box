package chapters

import (
	"fmt"
	"testing"

	"github.com/AmanTahiliani/box-box/internal/models"
)

func TestDetectStructuralChapters(t *testing.T) {
	chapters := Detect(nil, nil, testLaps(10, nil), 10)

	if len(chapters) < 2 {
		t.Fatalf("chapters len = %d, want at least start and finish", len(chapters))
	}
	if got := chapters[0]; got.Kind != KindStart || got.StartLap != 1 || got.EndLap != 1 {
		t.Fatalf("start chapter = %+v, want L1-L1", got)
	}
	got := chapters[len(chapters)-1]
	if got.Kind != KindFinish || got.StartLap != 9 || got.EndLap != 10 {
		t.Fatalf("finish chapter = %+v, want L9-L10", got)
	}
}

func TestDetectReturnsEmptyWithoutData(t *testing.T) {
	if chapters := Detect(nil, nil, nil, 0); len(chapters) != 0 {
		t.Fatalf("chapters = %+v, want empty", chapters)
	}
}

func TestDetectFlagPeriods(t *testing.T) {
	tests := []struct {
		name      string
		start     RaceControl
		end       RaceControl
		wantKind  string
		wantTitle string
	}{
		{
			name:      "safety car",
			start:     rc(12, models.CategorySafetyCar, "", "SAFETY CAR DEPLOYED"),
			end:       rc(15, models.CategorySafetyCar, "", "SAFETY CAR IN THIS LAP"),
			wantKind:  KindSafetyCar,
			wantTitle: "Safety Car (L12-L15)",
		},
		{
			name:      "virtual safety car",
			start:     rc(22, models.CategoryOther, "", "VSC DEPLOYED"),
			end:       rc(24, models.CategoryOther, "", "VSC ENDING"),
			wantKind:  KindVirtualSafetyCar,
			wantTitle: "Virtual Safety Car (L22-L24)",
		},
		{
			name:      "red flag",
			start:     rc(31, models.CategoryFlag, models.FlagRed, "RED FLAG"),
			end:       rc(33, models.CategoryFlag, models.FlagGreen, "GREEN FLAG"),
			wantKind:  KindRedFlag,
			wantTitle: "Red Flag (L31-L33)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			chapters := Detect([]RaceControl{tt.start, tt.end}, nil, testLaps(40, nil), 40)
			got := findKind(chapters, tt.wantKind)
			if got == nil {
				t.Fatalf("chapters = %+v, want %s", chapters, tt.wantKind)
			}
			if got.StartLap != rcLap(tt.start) || got.EndLap != rcLap(tt.end) || got.Title != tt.wantTitle {
				t.Fatalf("flag chapter = %+v, want %s", *got, tt.wantTitle)
			}
		})
	}
}

func TestDetectPitPhaseFromPitOutLapCluster(t *testing.T) {
	pitOuts := map[int][]int{
		5:  {1},
		10: {2},
		20: {3},
		21: {4},
		22: {5},
		30: {6},
		35: {7},
		40: {8},
		45: {9},
		50: {10},
	}
	chapters := Detect(nil, nil, testLaps(55, pitOuts), 55)

	got := findKind(chapters, KindPitPhase)
	if got == nil {
		t.Fatalf("chapters = %+v, want pit phase", chapters)
	}
	if got.StartLap != 20 || got.EndLap != 22 {
		t.Fatalf("pit phase = %+v, want L20-L22", *got)
	}
	if len(got.DriverNumbers) != 3 || got.DriverNumbers[0] != 3 || got.DriverNumbers[2] != 5 {
		t.Fatalf("pit phase drivers = %v, want [3 4 5]", got.DriverNumbers)
	}
}

func TestDetectDecisiveSwingPersistsToFinish(t *testing.T) {
	positions := []PositionSample{
		pos(1, 1, 1),
		pos(1, 16, 4),
		pos(1, 55, 3),
		pos(6, 16, 3),
		pos(6, 55, 4),
		pos(8, 44, 5),
		pos(8, 63, 6),
		pos(10, 44, 6),
	}

	chapters := Detect(nil, positions, testLaps(12, nil), 12)
	got := findKind(chapters, KindDecisiveSwing)
	if got == nil {
		t.Fatalf("chapters = %+v, want decisive swing", chapters)
	}
	if got.StartLap != 6 || got.EndLap != 6 {
		t.Fatalf("swing lap = %+v, want L6", *got)
	}
	if len(got.DriverNumbers) != 2 || got.DriverNumbers[0] != 16 || got.DriverNumbers[1] != 55 {
		t.Fatalf("swing drivers = %v, want [16 55]", got.DriverNumbers)
	}
}

func TestDetectFlagPeriodsWinOverConflictingChapters(t *testing.T) {
	pitOuts := map[int][]int{
		12: {1, 2},
		13: {3, 4},
		14: {5, 6},
	}
	rcs := []RaceControl{
		rc(12, models.CategorySafetyCar, "", "SAFETY CAR DEPLOYED"),
		rc(15, models.CategorySafetyCar, "", "SAFETY CAR IN THIS LAP"),
	}

	chapters := Detect(rcs, nil, testLaps(20, pitOuts), 20)
	if got := findKind(chapters, KindSafetyCar); got == nil || got.StartLap != 12 || got.EndLap != 15 {
		t.Fatalf("chapters = %+v, want safety car L12-L15", chapters)
	}
	if got := findKind(chapters, KindPitPhase); got != nil {
		t.Fatalf("pit phase = %+v, want omitted under safety car", *got)
	}
	for i := 1; i < len(chapters); i++ {
		if chapters[i].StartLap <= chapters[i-1].EndLap {
			t.Fatalf("chapters overlap at %d: %+v then %+v", i, chapters[i-1], chapters[i])
		}
	}
}

func rcLap(r RaceControl) int {
	if r.LapNumber == nil {
		return 0
	}
	return *r.LapNumber
}

func findKind(chapters []Chapter, kind string) *Chapter {
	for i := range chapters {
		if chapters[i].Kind == kind {
			return &chapters[i]
		}
	}
	return nil
}

func testLaps(total int, pitOuts map[int][]int) []Lap {
	var laps []Lap
	for lap := 1; lap <= total; lap++ {
		drivers := []int{1}
		if pitDrivers := pitOuts[lap]; len(pitDrivers) > 0 {
			drivers = pitDrivers
		}
		for _, driver := range drivers {
			laps = append(laps, Lap{
				DriverNumber: driver,
				LapNumber:    lap,
				DateStart:    lapTime(lap),
				IsPitOutLap:  containsDriver(pitOuts[lap], driver),
			})
		}
	}
	return laps
}

func rc(lap int, category models.RaceControlCategory, flag models.Flag, message string) RaceControl {
	return RaceControl{
		Category:  category,
		Flag:      flag,
		Message:   message,
		LapNumber: &lap,
		Date:      lapTime(lap),
	}
}

func pos(lap int, driver int, position int) PositionSample {
	return PositionSample{
		DriverNumber: driver,
		Position:     position,
		Date:         lapTime(lap),
	}
}

func lapTime(lap int) string {
	minute := lap - 1
	return fmt.Sprintf("2025-05-25T13:%02d:00Z", minute)
}

func containsDriver(drivers []int, driver int) bool {
	for _, candidate := range drivers {
		if candidate == driver {
			return true
		}
	}
	return false
}
