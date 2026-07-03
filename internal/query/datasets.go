package query

import "github.com/AmanTahiliani/box-box/internal/store"

func emptyDatasetMap() map[string]DatasetInfo {
	return map[string]DatasetInfo{
		"meeting":       missingDataset(),
		"session":       missingDataset(),
		"drivers":       missingDataset(),
		"results":       missingDataset(),
		"starting_grid": missingDataset(),
		"stints":        missingDataset(),
		"pit_stops":     missingDataset(),
		"positions":     missingDataset(),
		"race_control":  missingDataset(),
		"weather":       missingDataset(),
		"laps":          missingDataset(),
	}
}

func datasetsFromCounts(meetingAvailable, sessionAvailable bool, counts store.SessionDatasetCounts) map[string]DatasetInfo {
	ds := emptyDatasetMap()
	if meetingAvailable {
		ds["meeting"] = availableLocal(1)
	}
	if sessionAvailable {
		ds["session"] = availableLocal(1)
	}
	if counts.Drivers > 0 {
		ds["drivers"] = availableLocal(counts.Drivers)
	}
	if counts.Results > 0 {
		ds["results"] = availableLocal(counts.Results)
	}
	if counts.StartingGrid > 0 {
		ds["starting_grid"] = availableLocal(counts.StartingGrid)
	}
	if counts.Stints > 0 {
		ds["stints"] = availableLocal(counts.Stints)
	}
	if counts.PitStops > 0 {
		ds["pit_stops"] = availableLocal(counts.PitStops)
	}
	if counts.Positions > 0 {
		ds["positions"] = availableLocal(counts.Positions)
	}
	if counts.RaceControl > 0 {
		ds["race_control"] = availableLocal(counts.RaceControl)
	}
	if counts.Weather > 0 {
		ds["weather"] = availableLocal(counts.Weather)
	}
	if counts.Laps > 0 {
		ds["laps"] = availableLocal(counts.Laps)
	}
	return ds
}

func cancelledDatasets() map[string]DatasetInfo {
	ds := emptyDatasetMap()
	ds["meeting"] = availableLocal(1)
	ds["session"] = availableLocal(1)
	for _, key := range []string{
		"drivers",
		"results",
		"starting_grid",
		"stints",
		"pit_stops",
		"positions",
		"race_control",
		"weather",
		"laps",
	} {
		ds[key] = skippedNA()
	}
	return ds
}
