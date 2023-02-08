package schemas

import (
	"github.com/google/uuid"
)

// MeasurementQueryOptions are measurement query options
type MeasurementQueryOptions struct {
	Tags                  map[string]string
	GroupBy               []string
	Aggregation           *Aggregation
	IncludeLastKnownPoint bool
	UseEngineeringSpecs   bool
	Limit                 *int
}

// AssetMeasurementQuery is used to build the time series query to send to the historian
type AssetMeasurementQuery struct {
	Assets          []string
	AssetProperties []string
	Options         MeasurementQueryOptions
}

// MeasurementQuery is used to build the time series query to send to the historian
type MeasurementQuery struct {
	Database     string
	Measurements []string
	Measurement  string
	Options      MeasurementQueryOptions
}

// RawQuery is used to query raw time series data
type RawQuery struct {
	Query              string
	Format             Format
	TimeseriesDatabase uuid.UUID
}

// EventQuery is used to query events
type EventQuery struct {
	Assets         []string
	EventTypes     []string
	PropertyFilter []EventPropertyValueFilter
}
