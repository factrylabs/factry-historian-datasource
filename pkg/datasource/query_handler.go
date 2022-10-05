package datasource

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/api"
	"gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"
)

// QueryTypes are a list of query types
const (
	QueryTypeQuery = "MeasurementQuery"
	QueryTypeRaw   = "RawQuery"
	QueryTypeEvent = "EventQuery"
)

// Query is a struct which holds the query
type Query struct {
	Query json.RawMessage `json:"query"`
}

// GetMeasurementQuery constructs a query that can be used to query measurement data
func GetMeasurementQuery(backendQuery backend.DataQuery, query Query) (schemas.Query, error) {
	measurementQuery := schemas.Query{}
	err := json.Unmarshal(query.Query, &measurementQuery)
	if err != nil {
		return schemas.Query{}, err
	}

	measurementQuery.Start = backendQuery.TimeRange.From
	measurementQuery.End = &backendQuery.TimeRange.To
	if measurementQuery.Aggregation != nil {
		measurementQuery.Aggregation.Period = backendQuery.Interval.String()
	}
	measurementQuery.Limit = int(backendQuery.MaxDataPoints)
	return measurementQuery, nil
}

// QueryData handles incoming backend queries
func (ds *HistorianDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	dsi, err := ds.getDatasourceInstance(ctx, req.PluginContext)
	if err != nil {
		response.Responses["error"] = backend.DataResponse{Error: err}
		return response, nil
	}

	for _, q := range req.Queries {
		res := queryData(ctx, req.PluginContext, q, dsi.API)
		response.Responses[q.RefID] = res
	}
	return response, nil
}

func queryData(ctx context.Context, pCtx backend.PluginContext, backendQuery backend.DataQuery, api *api.API) backend.DataResponse {
	response := backend.DataResponse{}
	query := Query{}
	if err := json.Unmarshal(backendQuery.JSON, &query); err != nil {
		response.Error = err
		return response
	}

	switch backendQuery.QueryType {
	case QueryTypeQuery:
		query, err := GetMeasurementQuery(backendQuery, query)
		if err != nil {
			response.Error = err
			return response
		}

		result, err := api.MeasurementQuery(query)
		if err != nil {
			response.Error = err
			return response
		}

		response.Frames, response.Error = QueryResultToDataFrame(nil, result)
		return response

		// TODO Augment data frames with metadata from measurements?
	case QueryTypeRaw:
	case QueryTypeEvent:
	}

	response.Error = fmt.Errorf("unsupported query type %s", backendQuery.QueryType)
	return response
}
