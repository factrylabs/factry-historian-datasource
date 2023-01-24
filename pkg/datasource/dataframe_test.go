package datasource_test

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/datasource"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

func TestQueryResultToDataFrame(t *testing.T) {
	start := time.Now()
	queryResult := &schemas.QueryResult{
		Series: []*schemas.Series{
			{
				Measurement: "measurement name",
				Database:    "database name",
				Fields:      nil,
				Tags: map[string]interface{}{
					"status": "good",
				},
				Datatype: "number",
				DataPoints: []schemas.DataPoint{
					{
						Timestamp: start.UnixMilli(),
						Value:     1.0,
					},
					{
						Timestamp: start.Add(time.Second).UnixMilli(),
						Value:     2.0,
					},
				},
			},
		},
	}

	dataFrames, err := datasource.QueryResultToDataFrame(nil, queryResult)
	if assert.NoError(t, err) && assert.Len(t, dataFrames, 1) {
		assert.Equal(t, "measurement name", dataFrames[0].Name)
		if assert.Len(t, dataFrames[0].Fields, 2) {
			assert.Equal(t, "time", dataFrames[0].Fields[0].Name)
			assert.Equal(t, "value", dataFrames[0].Fields[1].Name)
			assert.Equal(t, data.FieldTypeTime, dataFrames[0].Fields[0].Type())
			assert.Equal(t, data.FieldTypeFloat64, dataFrames[0].Fields[1].Type())
			assert.Equal(t, 2, dataFrames[0].Fields[0].Len())
			assert.Equal(t, 2, dataFrames[0].Fields[1].Len())
			assert.Equal(t, start, dataFrames[0].Fields[0].At(0))
			assert.Equal(t, start.Add(time.Second), dataFrames[0].Fields[0].At(1))
			assert.Equal(t, 1.0, dataFrames[0].Fields[1].At(0))
			assert.Equal(t, 2.0, dataFrames[0].Fields[1].At(1))
		}
	}
}
