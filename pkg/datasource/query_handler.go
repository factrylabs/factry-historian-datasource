package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
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
	Query         json.RawMessage        `json:"query"`
	SeriesLimit   int                    `json:"seriesLimit"`
	HistorianInfo *schemas.HistorianInfo `json:"historianInfo,omitempty"`
}

// QueryData handles incoming backend queries
func (ds *HistorianDataSource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		res := queryData(ctx, q, ds.API)
		response.Responses[q.RefID] = res
	}
	return response, nil
}

func queryData(ctx context.Context, backendQuery backend.DataQuery, api *api.API) backend.DataResponse {
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

		response.Frames, response.Error = handleAssetMeasurementQuery(ctx, assetMeasurementQuery, backendQuery, query.SeriesLimit, query.HistorianInfo, api)
		return response
	case QueryTypeQuery:
		measurementQuery := schemas.MeasurementQuery{}
		if err := json.Unmarshal(query.Query, &measurementQuery); err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		measurements, err := getMeasurements(ctx, measurementQuery, query.SeriesLimit, api)
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

		response.Frames, response.Error = handleEventQuery(ctx, eventQuery, backendQuery, query.SeriesLimit, query.HistorianInfo, api)
		return response
	}

	response.Error = fmt.Errorf("unsupported query type %s", backendQuery.QueryType)
	return response
}

func handleAssetMeasurementQuery(ctx context.Context, assetMeasurementQuery schemas.AssetMeasurementQuery, backendQuery backend.DataQuery, seriesLimit int, historianInfo *schemas.HistorianInfo, api *api.API) (data.Frames, error) {
	assets, err := getFilteredAssets(ctx, api, assetMeasurementQuery.Assets, historianInfo)
	if err != nil {
		return nil, err
	}

	var assetProperties []schemas.AssetProperty
	canFilterAssetProperties := checkMinimumVersion(historianInfo, "6.3.0")
	if canFilterAssetProperties {
		assetPropertyQuery := url.Values{}
		for i, assetUUID := range maps.Keys(assets) {
			assetPropertyQuery.Add(fmt.Sprintf("AssetUUIDs[%d]", i), assetUUID.String())
		}

		assetProperties, err = api.GetAssetProperties(ctx, assetPropertyQuery.Encode())
		if err != nil {
			return nil, err
		}
	} else {
		assetProperties, err = api.GetAssetProperties(ctx, "")
		if err != nil {
			return nil, err
		}
	}

	measurementUUIDs := map[string]struct{}{}
	measurementIndexToPropertyMap := make([]schemas.AssetProperty, 0)

	propertiesByAssetUUIDAndID := map[uuid.UUID]map[string]schemas.AssetProperty{}
	for _, assetProperty := range assetProperties {
		if _, ok := propertiesByAssetUUIDAndID[assetProperty.AssetUUID]; !ok {
			propertiesByAssetUUIDAndID[assetProperty.AssetUUID] = map[string]schemas.AssetProperty{}
		}
		propertiesByAssetUUIDAndID[assetProperty.AssetUUID][assetProperty.Name] = assetProperty
		propertiesByAssetUUIDAndID[assetProperty.AssetUUID][assetProperty.UUID.String()] = assetProperty
	}

assetLoop:
	for _, assetUUID := range maps.Keys(assets) {
		for _, property := range assetMeasurementQuery.AssetProperties {
			if assetProperty, ok := propertiesByAssetUUIDAndID[assetUUID][property]; ok {
				measurementUUIDs[assetProperty.MeasurementUUID.String()] = struct{}{}
				measurementIndexToPropertyMap = append(measurementIndexToPropertyMap, assetProperty)
				if len(measurementUUIDs) >= seriesLimit {
					break assetLoop
				}
			}
		}
	}

	measurementQuery := schemas.MeasurementQuery{
		Measurements: maps.Keys(measurementUUIDs),
		Options:      assetMeasurementQuery.Options,
	}

	q := historianQuery(measurementQuery, backendQuery)
	frames, err := handleQuery(measurementQuery, q, api)
	if err != nil {
		return nil, err
	}

	setAssetFrameNames(frames, assets, measurementIndexToPropertyMap, measurementQuery.Options)
	if measurementQuery.Options.MetadataAsLabels {
		setFieldLabels(frames)
	}
	return sortByStatus(frames), nil
}

func getMeasurements(ctx context.Context, measurementQuery schemas.MeasurementQuery, seriesLimit int, api *api.API) ([]string, error) {
	parsedMeasurements := []string{}
	var measurements []string
	if measurementQuery.IsRegex {
		measurements = []string{fmt.Sprintf("/%s/", measurementQuery.Regex)}
	} else {
		measurements = measurementQuery.Measurements
		if measurementQuery.Measurement != "" {
			measurements = append(measurements, measurementQuery.Measurement)
		}
	}
	databases, err := api.GetTimeseriesDatabases(ctx, "")
	if err != nil {
		return nil, err
	}

	for _, measurement := range measurements {
		if measurementUUID, err := uuid.Parse(measurement); err == nil {
			parsedMeasurements = append(parsedMeasurements, measurementUUID.String())
			continue
		}

		databaseUUIDs := []string{}
		for _, databaseString := range measurementQuery.Databases {
			if _, err := uuid.Parse(databaseString); err != nil {
				for _, database := range databases {
					if database.Name == databaseString {
						databaseUUIDs = append(databaseUUIDs, database.UUID.String())
					}
				}
			} else {
				databaseUUIDs = append(databaseUUIDs, databaseString)
			}
		}

		databasesQuery := ""
		for i, databaseUUID := range databaseUUIDs {
			databasesQuery += fmt.Sprintf("&DatabaseUUIDs[%v]=%s", i, databaseUUID)
		}
		values, _ := url.ParseQuery(fmt.Sprintf("Keyword=%v&limit=%v%v", measurement, seriesLimit, databasesQuery))
		res, err := api.GetMeasurements(ctx, values.Encode())
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
	q := historianQuery(measurementQuery, backendQuery)
	frames, err := handleQuery(measurementQuery, q, api)
	if err != nil {
		return nil, err
	}

	setMeasurementFrameNames(frames, measurementQuery.Options)
	if measurementQuery.Options.MetadataAsLabels {
		setFieldLabels(frames)
	}
	return sortByStatus(frames), nil
}

func handleQuery(measurementQuery schemas.MeasurementQuery, query schemas.Query, api *api.API) (data.Frames, error) {
	result, err := api.MeasurementQuery(query)
	if err != nil {
		return nil, err
	}

	if measurementQuery.Options.IncludeLastKnownPoint || measurementQuery.Options.FillInitialEmptyValues {
		lastPointQuery := query
		start := query.Start
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
				getLastQueryForFrame := getLastQueryForFrame(frame, query)
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
			result = fillInitialEmptyIntervals(result, query)
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

	setRawFrameNames(result)
	return result, nil
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

func getFilteredAssets(ctx context.Context, api *api.API, assetStrings []string, historianInfo *schemas.HistorianInfo) (map[uuid.UUID]schemas.Asset, error) {
	assetUUIDSet := map[uuid.UUID]schemas.Asset{}

	if checkMinimumVersion(historianInfo, "6.4.0") {
		for _, assetString := range assetStrings {
			assetQuery := url.Values{}
			assetQuery.Add("Keyword", assetString)
			assets, err := api.GetAssets(ctx, assetQuery.Encode())
			if err != nil {
				return nil, err
			}

			for _, asset := range assets {
				assetUUIDSet[asset.UUID] = asset
			}
		}
	} else {
		// Deprecated
		assets, err := api.GetAssets(ctx, "")
		if err != nil {
			return nil, err
		}

		for _, assetString := range assetStrings {
			if filteredAssetUUIDs := filterAssetUUIDs(assets, assetString); len(filteredAssetUUIDs) > 0 {
				for assetUUID, asset := range filteredAssetUUIDs {
					assetUUIDSet[assetUUID] = asset
				}
			}
		}
	}

	return assetUUIDSet, nil
}

func filterAssetUUIDs(assets []schemas.Asset, searchValue string) map[uuid.UUID]schemas.Asset {
	filteredAssets := map[uuid.UUID]schemas.Asset{}
	if strings.HasPrefix(searchValue, "/") && strings.HasSuffix(searchValue, "/") {
		pattern := searchValue[1 : len(searchValue)-1]
		re, err := regexp.Compile(pattern)
		if err != nil {
			return filteredAssets
		}

		for _, asset := range assets {
			if re.MatchString(asset.AssetPath) || re.MatchString(asset.UUID.String()) {
				filteredAssets[asset.UUID] = asset
			}
		}
		return filteredAssets
	}

	for _, asset := range assets {
		if asset.UUID.String() == searchValue || asset.AssetPath == searchValue {
			return map[uuid.UUID]schemas.Asset{asset.UUID: asset}
		}
	}

	return filteredAssets
}

func filterEventTypeUUIDs(eventTypes []schemas.EventType, searchValue string) map[uuid.UUID]schemas.EventType {
	filteredEventTypes := map[uuid.UUID]schemas.EventType{}
	if strings.HasPrefix(searchValue, "/") && strings.HasSuffix(searchValue, "/") {
		pattern := searchValue[1 : len(searchValue)-1]
		re, err := regexp.Compile(pattern)
		if err != nil {
			return filteredEventTypes
		}

		for _, eventType := range eventTypes {
			if re.MatchString(eventType.Name) || re.MatchString(eventType.UUID.String()) {
				filteredEventTypes[eventType.UUID] = eventType
			}
		}
		return filteredEventTypes
	}

	for _, eventType := range eventTypes {
		if eventType.UUID.String() == searchValue || eventType.Name == searchValue {
			return map[uuid.UUID]schemas.EventType{eventType.UUID: eventType}
		}
	}

	return filteredEventTypes
}
