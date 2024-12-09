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
	MetadataAsLabels       bool
	ChangesOnly            bool
	ValueFilters           []ValueFilter
}

// ValueFilter is used to filter the values returned by the historian
type ValueFilter struct {
	Value     interface{}
	Operator  string
	Condition string
}

// AssetMeasurementQuery is used to build the time series query to send to the historian
type AssetMeasurementQuery struct {
	Assets          []string
	AssetProperties []string
	Options         MeasurementQueryOptions
}

// MeasurementQuery is used to build the time series query to send to the historian
type MeasurementQuery struct {
	Databases    []string
	Measurement  string
	Measurements []string
	Options      MeasurementQueryOptions
	Regex        string
	IsRegex      bool
}

// RawQuery is used to query raw time series data
type RawQuery struct {
	Query              string
	Format             Format
	TimeseriesDatabase uuid.UUID
}

// EventQuery is used to query events
type EventQuery struct {
	Type                 string
	Assets               []string
	EventTypes           []string
	Statuses             []string
	Properties           []string
	PropertyFilter       []EventPropertyValueFilter
	IncludeParentInfo    bool
	QueryAssetProperties bool
	AssetProperties      []string
	Options              *MeasurementQueryOptions
}
