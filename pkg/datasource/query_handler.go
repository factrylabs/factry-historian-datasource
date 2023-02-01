package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/api"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
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
func (ds *HistorianDataSource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
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
		response.Frames, response.Error = handleEventQuery(query, backendQuery, api)
		return response
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

	q := historianQuery(measurementQuery, backendQuery)
	result, err := api.MeasurementQuery(q)
	if err != nil {
		return nil, err
	}

	if measurementQuery.IncludeLastKnownPoint {
		start := q.Start
		q.End = &start
		q.Start = time.Time{}.Add(time.Millisecond)
		q.Aggregation = &schemas.Aggregation{
			Name: "last",
		}
		lastKnownPointResult, err := api.MeasurementQuery(q)
		if err != nil {
			return nil, err
		}

		for _, series := range lastKnownPointResult.Series {
			found := false
			for i, baseSeries := range result.Series {
				if baseSeries.Measurement != series.Measurement {
					continue
				}

				if !reflect.DeepEqual(baseSeries.Tags, series.Tags) {
					continue
				}

				result.Series[i].DataPoints = append(series.DataPoints, result.Series[i].DataPoints...)
				found = true
				break
			}
			if !found {
				result.Series = append(result.Series, series)
			}
		}
	}

	measurements := make([]schemas.Measurement, len(measurementQuery.Measurements))
	for i, measurementUUID := range measurementQuery.Measurements {
		measurement, err := api.GetMeasurement(measurementUUID)
		if err != nil {
			return data.Frames{}, fmt.Errorf("Error getting measurement: %v", err)
		}

		measurements[i] = measurement
	}

	return QueryResultToDataFrame(measurements, measurementQuery.UseEngineeringSpecs, result)
}

func handleRawQuery(query Query, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	rawQuery := schemas.RawQuery{}

	if err := json.Unmarshal(query.Query, &rawQuery); err != nil {
		return nil, err
	}

	rawQuery.Query = fillQueryVariables(rawQuery.Query, "Influx", backendQuery)

	result, err := api.RawQuery(rawQuery.TimeseriesDatabase, schemas.RawQuery{Query: rawQuery.Query})
	if err != nil {
		return nil, err
	}

	return QueryResultToDataFrame(nil, false, result)
}

func handleEventQuery(query Query, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	eventQuery := schemas.EventQuery{}

	if err := json.Unmarshal(query.Query, &eventQuery); err != nil {
		return nil, err
	}

	filter := schemas.EventFilter{
		StartTime:         backendQuery.TimeRange.From,
		StopTime:          backendQuery.TimeRange.To,
		Assets:            eventQuery.Assets,
		EventTypes:        eventQuery.EventTypes,
		PreloadProperties: true,
		Limit:             math.MaxInt32,
		PropertyFilter:    eventQuery.PropertyFilter,
	}

	events, err := api.EventQuery(filter)
	if err != nil {
		return nil, err
	}

	eventTypes, err := api.GetEventTypes()
	if err != nil {
		return nil, err
	}

	eventTypeProperties, err := api.GetEventTypeProperties()
	if err != nil {
		return nil, err
	}

	return EventQueryResultToDataFrame(events, eventTypes, eventTypeProperties)
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

func historianQuery(query schemas.MeasurementQuery, backendQuery backend.DataQuery) schemas.Query {
	start := backendQuery.TimeRange.From.Truncate(time.Second)
	end := backendQuery.TimeRange.To.Truncate(time.Second)
	historianQuery := schemas.Query{
		MeasurementUUIDs: query.Measurements,
		Start:            start,
		End:              &end,
		Tags:             query.Tags,
		GroupBy:          query.GroupBy,
		Limit:            int(backendQuery.MaxDataPoints),
	}

	if query.Aggregation != nil {
		historianQuery.Aggregation = query.Aggregation
		if query.Aggregation.Period == "" || query.Aggregation.Period == "$__interval" {
			historianQuery.Aggregation.Period = backendQuery.Interval.String()
		}
	}

	return historianQuery
}
