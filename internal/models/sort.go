package models

import "sort"

// SortSessionResults orders results by classified position, with position 0 (DNF/DNS) last.
func SortSessionResults(results []SessionResult) {
	sort.Slice(results, func(i, j int) bool {
		pi, pj := results[i].Position, results[j].Position
		if pi == 0 {
			pi = 9999
		}
		if pj == 0 {
			pj = 9999
		}
		if pi != pj {
			return pi < pj
		}
		return results[i].DriverNumber < results[j].DriverNumber
	})
}
