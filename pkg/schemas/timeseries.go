package schemas

import (
	"time"

	"github.com/google/uuid"
)

// Format is a string
type Format string

// Formats is a list of possible formats to return
const (
	ArrowFormat = "arrow"
)

// AggregationType is a string
type AggregationType string

// AggregationTypes is a list of supported aggregations
const (
	Count    AggregationType = "count"
	Integral AggregationType = "integral"
	Mean     AggregationType = "mean"
	Median   AggregationType = "median"
	Mode     AggregationType = "mode"
	Spread   AggregationType = "spread"
	Stddev   AggregationType = "stddev"
	Sum      AggregationType = "sum"
	First    AggregationType = "first"
	Last     AggregationType = "last"
	Max      AggregationType = "max"
	Min      AggregationType = "min"
)

// FillType is a string
type FillType string

// FillType is a list of supported fill types
const (
	None     FillType = "none"
	Null     FillType = "null"
	Previous FillType = "previous"
	Linear   FillType = "linear"
	Zero     FillType = "0"
)

// MeasurementByName is used to identify which measurement to query
// @Description Identifier for a measurement
type MeasurementByName struct {
	// The database in which we can find the measurement
	Database string `validate:"required" example:"historian"`
	// The name of the measurement
	Measurement string `validate:"required" example:"ghent.line_1.motor_2.speed"`
}

// Aggregation defines an aggregation function
// @Description Aggregation function for time series data
type Aggregation struct {
	// The aggregation function to use
	Name AggregationType `validate:"required" example:"mean"`
	// The period on which to aggregate the time series data of none is given the aggregation spans the given time period
	Period string `example:"5m"`
	// Optional arguments for the aggregation function
	Arguments []interface{}
	// What to do when there is no data in the aggregation window
	Fill FillType `example:"null"`
}

// Query contains all required parameters to perform a query
// @Description A query object is used to describe a query to
// @Description retrieve time series data.
type Query struct {
	// An array of measurements to query defined by uuid
	MeasurementUUIDs []uuid.UUID `validate:"required_without=Measurements"`
	// An array of measurements to query defined by database name and measurement name
	Measurements []MeasurementByName `validate:"required_without=MeasurementUUIDs"`
	// The start time of the query (inclusive)
	Start time.Time `validate:"required"`
	// The end time of the query (not inclusive)
	End *time.Time
	// A list of key value pairs to filter on
	Tags map[string]string
	// An array of tags to group by
	GroupBy []string
	// The maximum number of records to return per measurement, 0 for no limit
	Limit int
	// The offset for query
	Offset int
	// The aggregate function to call
	Aggregation *Aggregation
	// Reverse the sort order of records, normally ascending by timestamp
	Desc bool
	// Join will join the results on time filling in null values so a data point will be available for every timestamp
	Join bool
	// Format
	Format Format `json:",omitempty"`
}
