package schemas

import (
	"github.com/google/uuid"
)

// MeasurementQueryOptions are measurement query options
type MeasurementQueryOptions struct {
	Tags                   map[string]string
	Aggregation            *Aggregation
	Limit                  *int
	GroupBy                []string
	IncludeLastKnownPoint  bool
	FillInitialEmptyValues bool
	UseEngineeringSpecs    bool
	DisplayDatabaseName    bool
	DisplayDescription     bool
}

// AssetMeasurementQuery is used to build the time series query to send to the historian
type AssetMeasurementQuery struct {
	Assets          []string
	AssetProperties []string
	Options         MeasurementQueryOptions
}

// MeasurementQuery is used to build the time series query to send to the historian
type MeasurementQuery struct {
	Database         string
	MeasurementUUIDs []uuid.UUID
	Measurement      string
	Options          MeasurementQueryOptions
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
	Statuses       []string
	PropertyFilter []EventPropertyValueFilter
}
