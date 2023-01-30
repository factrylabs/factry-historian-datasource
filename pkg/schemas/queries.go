package schemas

import (
	"github.com/google/uuid"
)

// MeasurementQuery is used to build the time series query to send to the historian
type MeasurementQuery struct {
	Measurements          []uuid.UUID
	Tags                  map[string]string
	GroupBy               []string
	Aggregation           *Aggregation
	IncludeLastKnownPoint bool
}

// RawQuery is used to query raw time series data
type RawQuery struct {
	Query              string
	TimeseriesDatabase uuid.UUID
}

// EventQuery is used to query events
type EventQuery struct {
	Assets         []uuid.UUID
	EventTypes     []uuid.UUID
	PropertyFilter []EventPropertyValueFilter
}
