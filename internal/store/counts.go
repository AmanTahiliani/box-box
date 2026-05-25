package store

import "database/sql"

// SessionDatasetCounts holds row counts for session-scoped datasets.
type SessionDatasetCounts struct {
	Drivers      int
	Results      int
	StartingGrid int
	Stints       int
	PitStops     int
	Positions    int
	RaceControl  int
	Weather      int
	Laps         int
}

// CountSessionDatasets returns row counts for ingested session datasets.
func (s *Store) CountSessionDatasets(sessionKey int) (SessionDatasetCounts, error) {
	var c SessionDatasetCounts
	err := s.db.QueryRow(`
		SELECT
			(SELECT COUNT(*) FROM session_drivers WHERE session_key = ?),
			(SELECT COUNT(*) FROM session_results WHERE session_key = ?),
			(SELECT COUNT(*) FROM starting_grid WHERE session_key = ?),
			(SELECT COUNT(*) FROM stints WHERE session_key = ?),
			(SELECT COUNT(*) FROM pit_stops WHERE session_key = ?),
			(SELECT COUNT(*) FROM positions WHERE session_key = ?),
			(SELECT COUNT(*) FROM race_control WHERE session_key = ?),
			(SELECT COUNT(*) FROM weather WHERE session_key = ?),
			(SELECT COUNT(*) FROM laps WHERE session_key = ?)
	`,
		sessionKey, sessionKey, sessionKey, sessionKey, sessionKey,
		sessionKey, sessionKey, sessionKey, sessionKey,
	).Scan(
		&c.Drivers,
		&c.Results,
		&c.StartingGrid,
		&c.Stints,
		&c.PitStops,
		&c.Positions,
		&c.RaceControl,
		&c.Weather,
		&c.Laps,
	)
	if err == sql.ErrNoRows {
		return SessionDatasetCounts{}, nil
	}
	return c, err
}
