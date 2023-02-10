package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"reflect"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/api"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

// QueryTypes are a list of query types
const (
	QueryTypeQuery = "MeasurementQuery"
	QueryTypeAsset = "AssetMeasurementQuery"
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
	case QueryTypeAsset:
		assetMeasurementQuery := schemas.AssetMeasurementQuery{}
		if err := json.Unmarshal(query.Query, &assetMeasurementQuery); err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		response.Frames, response.Error = handleAssetMeasurementQuery(assetMeasurementQuery, backendQuery, api)
		return response
	case QueryTypeQuery:
		measurementQuery := schemas.MeasurementQuery{}
		if err := json.Unmarshal(query.Query, &measurementQuery); err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		response.Frames, response.Error = handleQuery(measurementQuery, backendQuery, api)
		return response
	case QueryTypeRaw:
		rawQuery := schemas.RawQuery{}
		if err := json.Unmarshal(query.Query, &rawQuery); err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		response.Frames, response.Error = handleRawQuery(rawQuery, backendQuery, api)
		return response
	case QueryTypeEvent:
		eventQuery := schemas.EventQuery{}
		if err := json.Unmarshal(query.Query, &eventQuery); err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		response.Frames, response.Error = handleEventQuery(eventQuery, backendQuery, api)
		return response
	}

	response.Error = fmt.Errorf("unsupported query type %s", backendQuery.QueryType)
	return response
}

func handleAssetMeasurementQuery(assetMeasurementQuery schemas.AssetMeasurementQuery, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	assets, err := api.GetAssets()
	if err != nil {
		return nil, err
	}

	assetProperties, err := api.GetAssetProperties()
	if err != nil {
		return nil, err
	}

	measurements := []string{}
	assetUUID, ok := filterAssetUUID(assets, assetMeasurementQuery.Asset)
	if !ok {
		assetUUID = assetMeasurementQuery.Asset
	}

	for _, property := range assetMeasurementQuery.AssetProperties {
		for _, assetProperty := range assetProperties {
			if assetProperty.Name == property && assetProperty.AssetUUID.String() == assetUUID {
				measurements = append(measurements, assetProperty.MeasurementUUID.String())
				break
			}
		}
	}

	measurementQuery := schemas.MeasurementQuery{
		Measurements: measurements,
		Options:      assetMeasurementQuery.Options,
	}

	return handleQuery(measurementQuery, backendQuery, api)
}

func getAssetPath(asset schemas.Asset, assets []schemas.Asset) string {
	if asset.ParentUUID == nil {
		return asset.Name
	}

	var parent *schemas.Asset
	for _, item := range assets {
		if item.UUID == *asset.ParentUUID {
			parent = &item
			break
		}
	}

	if parent != nil {
		return fmt.Sprintf("%v\\\\%v", getAssetPath(*parent, assets), asset.Name)
	}

	return asset.Name
}

func handleQuery(measurementQuery schemas.MeasurementQuery, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	// check if every measurement is an UUID, get all measurement's missing uuid
	for i, measurement := range measurementQuery.Measurements {
		if _, err := uuid.Parse(measurement); err == nil {
			continue
		}
		databaseUUID := measurementQuery.Database
		if _, err := uuid.Parse(databaseUUID); err != nil {
			databases, err := api.GetTimeseriesDatabases()
			if err != nil {
				return nil, err
			}

			for _, database := range databases {
				if database.Name == measurementQuery.Database {
					databaseUUID = database.UUID.String()
				}
			}
		}

		values, _ := url.ParseQuery(fmt.Sprintf("Keyword=%v&Database=%v", measurement, databaseUUID))
		res, err := api.GetMeasurements(values.Encode())
		if err != nil {
			return nil, err
		}

		if len(res) == 0 {
			return nil, fmt.Errorf("invalid measurement: %v", measurement)
		}

		measurementQuery.Measurements[i] = res[0].UUID.String()
	}

	q := historianQuery(measurementQuery, backendQuery)
	result, err := api.MeasurementQuery(q)
	if err != nil {
		return nil, err
	}

	if measurementQuery.Options.IncludeLastKnownPoint {
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
			return nil, fmt.Errorf("Error getting measurement: %v", err)
		}

		measurements[i] = measurement
	}

	return QueryResultToDataFrame(measurements, measurementQuery.Options.UseEngineeringSpecs, result)
}

func handleRawQuery(rawQuery schemas.RawQuery, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	rawQuery.Query = fillQueryVariables(rawQuery.Query, "Influx", backendQuery)

	result, err := api.RawQuery(rawQuery.TimeseriesDatabase, schemas.RawQuery{Query: rawQuery.Query})
	if err != nil {
		return nil, err
	}

	return QueryResultToDataFrame(nil, false, result)
}

func handleEventQuery(eventQuery schemas.EventQuery, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	assets, err := api.GetAssets()
	if err != nil {
		return nil, err
	}

	eventTypes, err := api.GetEventTypes()
	if err != nil {
		return nil, err
	}

	assetUUIDs := []string{}
	eventTypeUUIDs := []string{}
	for _, assetString := range eventQuery.Assets {
		if assetUUID, ok := filterAssetUUID(assets, assetString); ok {
			assetUUIDs = append(assetUUIDs, assetUUID)
		}
	}
	for _, eventTypeString := range eventQuery.EventTypes {
		if eventTypeUUID, ok := filterEventTypeUUID(eventTypes, eventTypeString); ok {
			eventTypeUUIDs = append(eventTypeUUIDs, eventTypeUUID)
		}
	}

	filter := schemas.EventFilter{
		StartTime:         backendQuery.TimeRange.From,
		StopTime:          backendQuery.TimeRange.To,
		Assets:            assetUUIDs,
		EventTypes:        eventTypeUUIDs,
		PreloadProperties: true,
		Limit:             math.MaxInt32,
		PropertyFilter:    eventQuery.PropertyFilter,
	}

	events, err := api.EventQuery(filter)
	if err != nil {
		return nil, err
	}

	eventTypeProperties, err := api.GetEventTypeProperties()
	if err != nil {
		return nil, err
	}

	return EventQueryResultToDataFrame(assets, events, eventTypes, eventTypeProperties)
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
		Tags:             query.Options.Tags,
		GroupBy:          query.Options.GroupBy,
	}

	if query.Options.Aggregation != nil {
		historianQuery.Aggregation = query.Options.Aggregation
		if query.Options.Aggregation.Period == "" || query.Options.Aggregation.Period == "$__interval" {
			historianQuery.Aggregation.Period = backendQuery.Interval.String()
		}
	}

	if query.Options.Limit != nil {
		historianQuery.Limit = *query.Options.Limit
	}

	return historianQuery
}

func filterAssetUUID(assets []schemas.Asset, searchValue string) (string, bool) {
	for _, asset := range assets {
		if getAssetPath(asset, assets) == searchValue {
			return asset.UUID.String(), true
		}
	}

	return "", false
}

func filterEventTypeUUID(eventTypes []schemas.EventType, searchValue string) (string, bool) {
	for _, eventType := range eventTypes {
		if eventType.UUID.String() == searchValue || eventType.Name == searchValue {
			return eventType.UUID.String(), true
		}
	}

	return "", false
}
