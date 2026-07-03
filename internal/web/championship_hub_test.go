package web

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/AmanTahiliani/box-box/internal/models"
)

func raceResult(num, pos int, pts float64) models.SessionResult {
	return models.SessionResult{DriverNumber: num, Position: pos, Points: pts}
}

func TestAggregateChampionshipHub(t *testing.T) {
	driverInfo := map[int]models.Driver{
		1: {DriverNumber: 1, NameAcronym: "VER", FullName: "Max Verstappen", TeamName: "Red Bull", TeamColour: "3671c6"},
		2: {DriverNumber: 2, NameAcronym: "PER", FullName: "Sergio Perez", TeamName: "Red Bull", TeamColour: "3671c6"},
		3: {DriverNumber: 3, NameAcronym: "HAM", FullName: "Lewis Hamilton", TeamName: "Mercedes", TeamColour: "27f4d2"},
	}

	champ := []models.ChampionshipDriver{
		{DriverNumber: 1, PointsCurrent: 50, PositionCurrent: 1, SessionKey: 99},
		{DriverNumber: 3, PointsCurrent: 33, PositionCurrent: 2, SessionKey: 99},
		{DriverNumber: 2, PointsCurrent: 30, PositionCurrent: 3, SessionKey: 99},
	}
	teams := []models.ChampionshipTeam{
		{TeamName: "Red Bull", PointsCurrent: 80, PositionCurrent: 1},
		{TeamName: "Mercedes", PointsCurrent: 33, PositionCurrent: 2},
	}

	// Round 1: VER P1(25), HAM P2(18), PER P3(15). Pole: VER.
	// Round 2: VER P1(25), PER P2(18), HAM P3(15). Pole: HAM.
	races := []meetingRace{
		{
			Meeting: models.Meeting{MeetingName: "Bahrain GP"},
			Results: []models.SessionResult{raceResult(1, 1, 25), raceResult(3, 2, 18), raceResult(2, 3, 15)},
			Grid:    []models.StartingGrid{{DriverNumber: 1, Position: 1}},
		},
		{
			Meeting: models.Meeting{MeetingName: "Saudi GP"},
			Results: []models.SessionResult{raceResult(1, 1, 25), raceResult(2, 2, 18), raceResult(3, 3, 15)},
			Grid:    []models.StartingGrid{{DriverNumber: 3, Position: 1}},
		},
		// Round 3: not yet run (no results) — should not count as completed.
		{Meeting: models.Meeting{MeetingName: "Australia GP"}},
	}

	resp := aggregateChampionshipHub(2025, races, champ, teams, driverInfo)

	if resp.Season != 2025 {
		t.Errorf("season = %d, want 2025", resp.Season)
	}
	if resp.Round != 2 {
		t.Errorf("completed rounds = %d, want 2", resp.Round)
	}
	if resp.TotalRounds != 3 {
		t.Errorf("total rounds = %d, want 3", resp.TotalRounds)
	}
	if resp.RoundsLeft != 1 {
		t.Errorf("rounds left = %d, want 1", resp.RoundsLeft)
	}
	if resp.LastRace != "Saudi GP" {
		t.Errorf("last race = %q, want Saudi GP", resp.LastRace)
	}
	if len(resp.RoundLabels) != 2 || resp.RoundLabels[0] != "R1" || resp.RoundLabels[1] != "R2" {
		t.Errorf("round labels = %v, want [R1 R2]", resp.RoundLabels)
	}

	// Drivers are sorted by official position: VER, HAM, PER.
	if len(resp.Drivers) != 3 {
		t.Fatalf("drivers = %d, want 3", len(resp.Drivers))
	}
	ver := resp.Drivers[0]
	if ver.NameAcronym != "VER" || ver.Position != 1 {
		t.Errorf("first driver = %s P%d, want VER P1", ver.NameAcronym, ver.Position)
	}
	if ver.Wins != 2 {
		t.Errorf("VER wins = %d, want 2", ver.Wins)
	}
	if ver.Podiums != 2 {
		t.Errorf("VER podiums = %d, want 2", ver.Podiums)
	}
	if ver.Poles != 1 {
		t.Errorf("VER poles = %d, want 1", ver.Poles)
	}
	if len(ver.Form) != 2 || ver.Form[0] != 25 || ver.Form[1] != 25 {
		t.Errorf("VER form = %v, want [25 25]", ver.Form)
	}
	// Cumulative reconciles final value to official total (50).
	if len(ver.Cumulative) != 2 || ver.Cumulative[0] != 25 || ver.Cumulative[1] != 50 {
		t.Errorf("VER cumulative = %v, want [25 50]", ver.Cumulative)
	}
	// VER beat teammate PER in both rounds.
	if ver.TeammateWins != 2 || ver.TeammateLosses != 0 {
		t.Errorf("VER h2h = %d-%d, want 2-0", ver.TeammateWins, ver.TeammateLosses)
	}

	// PER lost both intra-team battles to VER.
	var per champHubDriver
	for _, d := range resp.Drivers {
		if d.NameAcronym == "PER" {
			per = d
		}
	}
	if per.TeammateWins != 0 || per.TeammateLosses != 2 {
		t.Errorf("PER h2h = %d-%d, want 0-2", per.TeammateWins, per.TeammateLosses)
	}
	if per.Poles != 0 {
		t.Errorf("PER poles = %d, want 0", per.Poles)
	}

	// HAM has no teammate in the data — no h2h recorded.
	var ham champHubDriver
	for _, d := range resp.Drivers {
		if d.NameAcronym == "HAM" {
			ham = d
		}
	}
	if ham.TeammateWins != 0 || ham.TeammateLosses != 0 {
		t.Errorf("HAM h2h = %d-%d, want 0-0 (no teammate)", ham.TeammateWins, ham.TeammateLosses)
	}
	if ham.Poles != 1 {
		t.Errorf("HAM poles = %d, want 1", ham.Poles)
	}

	// Teams sorted by position; Red Bull wins = VER(2) + PER(0) = 2.
	if len(resp.Teams) != 2 {
		t.Fatalf("teams = %d, want 2", len(resp.Teams))
	}
	if resp.Teams[0].TeamName != "Red Bull" || resp.Teams[0].Wins != 2 {
		t.Errorf("top team = %s wins %d, want Red Bull wins 2", resp.Teams[0].TeamName, resp.Teams[0].Wins)
	}
	if resp.Teams[0].TeamColour != "3671c6" {
		t.Errorf("Red Bull colour = %q, want 3671c6", resp.Teams[0].TeamColour)
	}
}

func TestAggregateChampionshipHubEmpty(t *testing.T) {
	resp := aggregateChampionshipHub(2025, nil, nil, nil, map[int]models.Driver{})
	if resp.Round != 0 || resp.TotalRounds != 0 || len(resp.Drivers) != 0 {
		t.Errorf("empty aggregation should be zero-valued, got %+v", resp)
	}
}

func TestFetchMeetingRacesPreservesOrderAndSkips(t *testing.T) {
	const n = 12
	meetings := make([]models.Meeting, n)
	for i := range meetings {
		meetings[i] = models.Meeting{MeetingKey: int32(i + 1)}
	}

	races := fetchMeetingRaces(meetings, 5, func(m models.Meeting) (meetingRace, bool) {
		// Later meetings finish first to shuffle completion order.
		time.Sleep(time.Duration(n-int(m.MeetingKey)) * time.Millisecond)
		if m.MeetingKey%3 == 0 {
			return meetingRace{}, false // simulate skip (fetch error / no Race session)
		}
		return meetingRace{Meeting: m, RaceSessionKey: int(m.MeetingKey) * 100}, true
	})

	want := 0
	for i := 1; i <= n; i++ {
		if i%3 != 0 {
			want++
		}
	}
	if len(races) != want {
		t.Fatalf("races = %d, want %d", len(races), want)
	}
	prev := int32(0)
	for _, r := range races {
		if r.Meeting.MeetingKey <= prev {
			t.Fatalf("races out of input order: key %d after %d", r.Meeting.MeetingKey, prev)
		}
		if r.Meeting.MeetingKey%3 == 0 {
			t.Fatalf("skipped meeting %d present in output", r.Meeting.MeetingKey)
		}
		if r.RaceSessionKey != int(r.Meeting.MeetingKey)*100 {
			t.Fatalf("meeting %d has mismatched race key %d", r.Meeting.MeetingKey, r.RaceSessionKey)
		}
		prev = r.Meeting.MeetingKey
	}
}

func TestFetchMeetingRacesBoundsConcurrency(t *testing.T) {
	const workers = 3
	var inFlight, peak atomic.Int32
	meetings := make([]models.Meeting, 20)
	for i := range meetings {
		meetings[i] = models.Meeting{MeetingKey: int32(i + 1)}
	}

	fetchMeetingRaces(meetings, workers, func(m models.Meeting) (meetingRace, bool) {
		cur := inFlight.Add(1)
		for {
			p := peak.Load()
			if cur <= p || peak.CompareAndSwap(p, cur) {
				break
			}
		}
		time.Sleep(5 * time.Millisecond)
		inFlight.Add(-1)
		return meetingRace{Meeting: m, RaceSessionKey: 1}, true
	})

	if p := peak.Load(); p > workers {
		t.Errorf("peak concurrent fetches = %d, want <= %d", p, workers)
	}
}

func TestChampHubTTL(t *testing.T) {
	now := time.Date(2026, 7, 3, 12, 0, 0, 0, time.UTC)
	if got := champHubTTL(2026, now); got != champHubCurrentTTL {
		t.Errorf("current year TTL = %v, want %v", got, champHubCurrentTTL)
	}
	if got := champHubTTL(2027, now); got != champHubCurrentTTL {
		t.Errorf("future year TTL = %v, want %v", got, champHubCurrentTTL)
	}
	if got := champHubTTL(2024, now); got != champHubPastTTL {
		t.Errorf("past year TTL = %v, want %v", got, champHubPastTTL)
	}
}

func TestChampHubCache(t *testing.T) {
	var c champHubCache
	now := time.Date(2026, 7, 3, 12, 0, 0, 0, time.UTC)

	if _, ok := c.get(2026, now); ok {
		t.Fatal("empty cache should miss")
	}

	c.put(2026, champHubResponse{Season: 2026, Round: 10}, now)
	c.put(2024, champHubResponse{Season: 2024, Round: 24}, now)

	// Current-year entry: hit within 15 min, miss after.
	if resp, ok := c.get(2026, now.Add(14*time.Minute)); !ok || resp.Round != 10 {
		t.Errorf("current-year get within TTL = (%+v, %v), want hit with Round 10", resp, ok)
	}
	if _, ok := c.get(2026, now.Add(16*time.Minute)); ok {
		t.Error("current-year entry should expire after 15 minutes")
	}

	// Past-year entry: hit well beyond 15 min, miss after 24 h.
	if resp, ok := c.get(2024, now.Add(12*time.Hour)); !ok || resp.Round != 24 {
		t.Errorf("past-year get within TTL = (%+v, %v), want hit with Round 24", resp, ok)
	}
	if _, ok := c.get(2024, now.Add(25*time.Hour)); ok {
		t.Error("past-year entry should expire after 24 hours")
	}

	// Re-put refreshes the entry.
	c.put(2026, champHubResponse{Season: 2026, Round: 11}, now.Add(20*time.Minute))
	if resp, ok := c.get(2026, now.Add(30*time.Minute)); !ok || resp.Round != 11 {
		t.Errorf("refreshed entry = (%+v, %v), want hit with Round 11", resp, ok)
	}
}
