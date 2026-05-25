package models

import "testing"

func TestSortSessionResults(t *testing.T) {
	results := []SessionResult{
		{DriverNumber: 55, Position: 0, DNF: true},
		{DriverNumber: 10, Position: 0, DNS: true},
		{DriverNumber: 1, Position: 1},
		{DriverNumber: 44, Position: 2},
	}

	SortSessionResults(results)

	want := []int{1, 44, 10, 55}
	for i, dn := range want {
		if results[i].DriverNumber != dn {
			t.Fatalf("results[%d].DriverNumber = %d, want %d", i, results[i].DriverNumber, dn)
		}
	}
}
