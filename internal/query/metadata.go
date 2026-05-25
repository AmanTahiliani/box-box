package query

const (
	DatasetStatusAvailable = "available"
	DatasetStatusMissing   = "missing"

	DataSourceLocal  = "local"
	DataSourceNone   = "none"
	DataSourceOpenF1 = "openf1"

	ResponseSourceLocal   = "local"
	ResponseSourceNone    = "none"
	ResponseSourcePartial = "partial"
)

// DatasetInfo describes availability of a single dataset.
type DatasetInfo struct {
	Status string `json:"status"`
	Source string `json:"source"`
	Count  int    `json:"count,omitempty"`
}

func availableLocal(count int) DatasetInfo {
	return DatasetInfo{
		Status: DatasetStatusAvailable,
		Source: DataSourceLocal,
		Count:  count,
	}
}

func missingDataset() DatasetInfo {
	return DatasetInfo{
		Status: DatasetStatusMissing,
		Source: DataSourceNone,
		Count:  0,
	}
}

func responseSource(datasets map[string]DatasetInfo) string {
	if len(datasets) == 0 {
		return ResponseSourceNone
	}

	hasLocal := false
	allMissing := true
	for _, info := range datasets {
		if info.Status == DatasetStatusAvailable && info.Source == DataSourceLocal {
			hasLocal = true
			allMissing = false
		} else if info.Status == DatasetStatusAvailable {
			allMissing = false
		}
	}
	if allMissing {
		return ResponseSourceNone
	}
	if hasLocal {
		for _, info := range datasets {
			if info.Status == DatasetStatusMissing {
				return ResponseSourcePartial
			}
		}
		return ResponseSourceLocal
	}
	return ResponseSourceNone
}
