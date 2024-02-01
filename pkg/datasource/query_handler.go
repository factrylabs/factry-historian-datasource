package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/api"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
	"golang.org/x/exp/maps"
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
		res := queryData(q, dsi.API)
		response.Responses[q.RefID] = res
	}
	return response, nil
}

func queryData(backendQuery backend.DataQuery, api *api.API) backend.DataResponse {
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

		measurements, err := getMeasurements(measurementQuery, api)
		if err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		measurementQuery.Measurements = measurements
		response.Frames, response.Error = handleMeasurementQuery(measurementQuery, backendQuery, api)
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

	measurementUUIDs := map[string]struct{}{}
	assetUUIDs := []uuid.UUID{}
	for _, assetString := range assetMeasurementQuery.Assets {
		if assetUUID, ok := filterAssetUUID(assets, assetString); ok {
			assetUUIDs = append(assetUUIDs, assetUUID)
		}
	}

	measurementIndexToPropertyMap := make([]schemas.AssetProperty, 0)
	for _, assetUUID := range assetUUIDs {
		for _, property := range assetMeasurementQuery.AssetProperties {
			for _, assetProperty := range assetProperties {
				if assetProperty.Name == property && assetProperty.AssetUUID == assetUUID {
					measurementUUIDs[assetProperty.MeasurementUUID.String()] = struct{}{}
					measurementIndexToPropertyMap = append(measurementIndexToPropertyMap, assetProperty)
					break
				}
			}
		}
	}

	measurementQuery := schemas.MeasurementQuery{
		Measurements: maps.Keys(measurementUUIDs),
		Options:      assetMeasurementQuery.Options,
	}

	frames, err := handleQuery(measurementQuery, backendQuery, api)
	if err != nil {
		return nil, err
	}

	return sortByStatus(setAssetFrameNames(frames, assets, measurementIndexToPropertyMap, measurementQuery.Options)), nil
}

func getMeasurements(measurementQuery schemas.MeasurementQuery, api *api.API) ([]string, error) {
	parsedMeasurements := []string{}
	measurements := measurementQuery.Measurements
	if measurementQuery.Measurement != "" {
		measurements = append(measurements, measurementQuery.Measurement)
	}
	databases, err := api.GetTimeseriesDatabases()
	if err != nil {
		return nil, err
	}

	for _, measurement := range measurements {
		if measurementUUID, err := uuid.Parse(measurement); err == nil {
			parsedMeasurements = append(parsedMeasurements, measurementUUID.String())
			continue
		}

		databaseUUID := measurementQuery.Database
		if _, err := uuid.Parse(databaseUUID); err != nil {
			for _, database := range databases {
				if database.Name == measurementQuery.Database {
					databaseUUID = database.UUID.String()
				}
			}
		}

		values, _ := url.ParseQuery(fmt.Sprintf("Keyword=%v&DatabaseUUID=%v", measurement, databaseUUID))
		res, err := api.GetMeasurements(values.Encode())
		if err != nil {
			return nil, err
		}

		if len(res) == 0 {
			return nil, fmt.Errorf("invalid measurement: %v", measurement)
		}

		for _, m := range res {
			parsedMeasurements = append(parsedMeasurements, m.UUID.String())
		}
	}
	return parsedMeasurements, nil
}

func handleMeasurementQuery(measurementQuery schemas.MeasurementQuery, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	frames, err := handleQuery(measurementQuery, backendQuery, api)
	if err != nil {
		return nil, err
	}

	return sortByStatus(setMeasurementFrameNames(frames, measurementQuery.Options)), nil
}

func handleQuery(measurementQuery schemas.MeasurementQuery, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	q := historianQuery(measurementQuery, backendQuery)
	result, err := api.MeasurementQuery(q)
	if err != nil {
		return nil, err
	}

	if measurementQuery.Options.IncludeLastKnownPoint || measurementQuery.Options.FillInitialEmptyValues {
		lastPointQuery := q
		start := q.Start
		lastPointQuery.End = &start
		lastPointQuery.Start = time.Time{}.Add(time.Millisecond)
		lastPointQuery.Aggregation = &schemas.Aggregation{
			Name: "last",
		}

		lastKnowPointResults := data.Frames{}

		if len(lastPointQuery.Tags) == 0 {
			lastPointQuery.Tags = make(map[string]string)
			lastPointQuery.Tags["status"] = "Good"

			// If unfiltered query last point for each resulting data frame
			for _, frame := range result {
				getLastQueryForFrame := getLastQueryForFrame(frame, q)
				lastResult, err := api.MeasurementQuery(getLastQueryForFrame)
				if err != nil {
					return nil, err
				}

				lastKnowPointResults = append(lastKnowPointResults, lastResult...)
			}
		}

		// OtherFrames
		lastResult, err := api.MeasurementQuery(lastPointQuery)
		if err != nil {
			return nil, err
		}
		lastKnowPointResults = append(lastKnowPointResults, lastResult...)

		result = mergeFrames(lastKnowPointResults, result)
		if measurementQuery.Options.FillInitialEmptyValues {
			result = fillInitialEmptyIntervals(result, q)
		}

		if !measurementQuery.Options.IncludeLastKnownPoint {
			result = deleteFirstRow(result)
		}
	}

	return addMetaData(result, measurementQuery.Options.UseEngineeringSpecs), nil
}

func getLastQueryForFrame(frame *data.Frame, q schemas.Query) schemas.Query {
	lastQuery := q
	start := q.Start
	lastQuery.MeasurementUUIDs = []string{getMeasurementUUIDFromFrame(frame)}
	lastQuery.Measurements = nil
	lastQuery.End = &start
	lastQuery.Start = time.Time{}.Add(time.Millisecond)
	lastQuery.Aggregation = &schemas.Aggregation{
		Name: "last",
	}

	lastQuery.Tags = make(map[string]string)
	labels := getLabelsFromFrame(frame)

	for label, value := range labels {
		lastQuery.Tags[label] = fmt.Sprintf("%v", value)
	}

	return lastQuery
}

func handleRawQuery(rawQuery schemas.RawQuery, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	rawQuery.Query = fillQueryVariables(rawQuery.Query, "Influx", backendQuery)

	result, err := api.RawQuery(rawQuery.TimeseriesDatabase, schemas.RawQuery{Query: rawQuery.Query, Format: schemas.ArrowFormat})
	if err != nil {
		return nil, err
	}

	return setRawFrameNames(result), nil
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

	assetUUIDs := []uuid.UUID{}
	eventTypeUUIDs := []uuid.UUID{}
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
		AssetUUIDs:        assetUUIDs,
		EventTypeUUIDs:    eventTypeUUIDs,
		PreloadProperties: true,
		Limit:             math.MaxInt32,
		PropertyFilter:    eventQuery.PropertyFilter,
		Status:            eventQuery.Statuses,
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
		Format:           schemas.ArrowFormat,
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

func filterAssetUUID(assets []schemas.Asset, searchValue string) (uuid.UUID, bool) {
	for _, asset := range assets {
		if asset.UUID.String() == searchValue || asset.AssetPath == searchValue {
			return asset.UUID, true
		}
	}

	return uuid.Nil, false
}

func filterEventTypeUUID(eventTypes []schemas.EventType, searchValue string) (uuid.UUID, bool) {
	for _, eventType := range eventTypes {
		if eventType.UUID.String() == searchValue || eventType.Name == searchValue {
			return eventType.UUID, true
		}
	}

	return uuid.Nil, false
}
