package schemas

import (
	"time"

	"github.com/google/uuid"
)

// AggregationType is a string
type AggregationType string

// AggregationTypes is a list of supported aggregations
const (
	Count    AggregationType = "count"
	Integral                 = "integral"
	Mean                     = "mean"
	Median                   = "median"
	Mode                     = "mode"
	Spread                   = "spread"
	Stddev                   = "stddev"
	Sum                      = "sum"
	First                    = "first"
	Last                     = "last"
	Max                      = "max"
	Min                      = "min"
)

// FillType is a string
type FillType string

// FillType is a list of supported fill types
const (
	None     FillType = "none"
	Null              = "null"
	Previous          = "previous"
	Linear            = "linear"
	Zero              = "0"
)

// DataPoint represents a single data point in a time series
// @Description  DataPoint represents a single data point in a time series
type DataPoint struct {
	// The timestamp of the data point in unix milliseconds
	Timestamp int64
	// The value of the data point
	Value interface{}
}

// Series a representation of time series data
// @Description Series represents the result of data for a single time series
type Series struct {
	// The name the measurement
	Measurement string
	// The name of the database queried
	Database string
	// Fields is an optional list of of field names returned when the DataPoint value is an array of values
	Fields []string
	// Tags associated with the measurement
	Tags map[string]interface{}
	// DataPoints are all the data points for this time series
	DataPoints []DataPoint
	// The datatype of the values returned
	Datatype string
}

// QueryResult contains the result of a query
// @Description QueryResult contains the result of a query
type QueryResult struct {
	// An array of series
	Series []*Series
	// Optional metadata about the executed query
	Attributes map[string]interface{}
}

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
}
