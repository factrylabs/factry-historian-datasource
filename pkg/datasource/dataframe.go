package datasource

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"
)

func QueryResultToDataFrame(queryResult *schemas.QueryResult) (data.Frames, error) {
	labels := data.Labels{"test": "to implement"}
	field := data.NewField("time", labels, []time.Time{time.Now().Add(-5 * time.Minute), time.Now().Add(-60 * time.Second)})
	frame := data.NewFrame("TEST FRAME", field)
	data := data.Frames{frame}
	return data, nil
}
