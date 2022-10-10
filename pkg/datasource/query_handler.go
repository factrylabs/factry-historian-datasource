package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/api"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
	historianSchemas "gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"
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
		response.Frames, response.Error = handleQuery(query, backendQuery, api)
		return response
	case QueryTypeRaw:
		response.Frames, response.Error = handleRawQuery(query, backendQuery, api)
		return response
	case QueryTypeEvent:
	}

	response.Error = fmt.Errorf("unsupported query type %s", backendQuery.QueryType)
	return response
}

func handleQuery(query Query, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	measurementQuery := schemas.MeasurementQuery{}
	err := json.Unmarshal(query.Query, &measurementQuery)
	if err != nil {
		return nil, err
	}

	measurementQuery.Start = backendQuery.TimeRange.From
	measurementQuery.End = &backendQuery.TimeRange.To
	if measurementQuery.Aggregation != nil {
		measurementQuery.Aggregation.Period = backendQuery.Interval.String()
	}
	measurementQuery.Limit = int(backendQuery.MaxDataPoints)

	result, err := api.MeasurementQuery(measurementQuery.ToHistorianQuery())
	if err != nil {
		return nil, err
	}

	return QueryResultToDataFrame(measurementQuery.Measurements, result)
}

func handleRawQuery(query Query, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	rawQuery := schemas.RawQuery{}
	err := json.Unmarshal(query.Query, &rawQuery)
	if err != nil {
		return nil, err
	}

	rawQuery.Query = fillQueryVariables(rawQuery.Query, "Influx", backendQuery)

	result, err := api.RawQuery(rawQuery.TimeseriesDatabase, historianSchemas.RawQuery{Query: rawQuery.Query})
	if err != nil {
		return nil, err
	}

	return QueryResultToDataFrame(nil, result)
}

func fillQueryVariables(query string, databaseType string, backendQuery backend.DataQuery) string {
	timeFilter := ""
	interval := ""
	switch databaseType {
	case "Influx":
		timeFilter = fmt.Sprintf("time >= %vns AND time < %vns", backendQuery.TimeRange.From.UnixNano(), backendQuery.TimeRange.To.UnixNano())
		interval = fmt.Sprintf("TIME(%vns, %vns)", backendQuery.Interval.Nanoseconds(), backendQuery.TimeRange.From.UnixNano()%backendQuery.Interval.Nanoseconds())
	}
	query = strings.ReplaceAll(query, "$timeFilter", timeFilter)
	query = strings.ReplaceAll(query, "$__interval", interval)
	return query
}
