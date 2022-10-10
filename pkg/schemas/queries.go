package schemas

import (
	"time"

	"github.com/google/uuid"
	historianSchemas "gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"
)

type MeasurementQuery struct {
	Measurements []Measurement
	Start        time.Time
	End          *time.Time
	Tags         map[string]string
	GroupBy      []string
	Limit        int
	Offset       int
	Aggregation  *historianSchemas.Aggregation
	Desc         bool
	Join         bool
}

type RawQuery struct {
	Query              string
	TimeseriesDatabase uuid.UUID
}

func (query *MeasurementQuery) ToHistorianQuery() historianSchemas.Query {
	historianQuery := historianSchemas.Query{
		MeasurementUUIDs: make([]uuid.UUID, len(query.Measurements)),
		Start:            query.Start,
		End:              query.End,
		Tags:             query.Tags,
		GroupBy:          query.GroupBy,
		Limit:            query.Limit,
		Offset:           query.Offset,
		Aggregation:      query.Aggregation,
		Desc:             query.Desc,
		Join:             query.Join,
	}

	for i, measurement := range query.Measurements {
		historianQuery.MeasurementUUIDs[i] = measurement.UUID
	}

	return historianQuery
}
