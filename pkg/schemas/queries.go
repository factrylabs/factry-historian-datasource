package schemas

import (
	"github.com/google/uuid"
	historianSchemas "gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"
)

// MeasurementQuery is used to build the time series query to send to the historian
type MeasurementQuery struct {
	Measurements []Measurement
	Tags         map[string]string
	GroupBy      []string
	Aggregation  *historianSchemas.Aggregation
}

// RawQuery is used to query raw time series data
type RawQuery struct {
	Query              string
	TimeseriesDatabase uuid.UUID
}
