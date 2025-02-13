package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"golang.org/x/sync/errgroup"
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
	HistorianInfo *schemas.HistorianInfo `json:"historianInfo,omitempty"`
	Query         json.RawMessage        `json:"query"`
	SeriesLimit   int                    `json:"seriesLimit"`
}

// QueryData handles incoming backend queries
func (ds *HistorianDataSource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	// set context, so queries in process can be cancelled if the request/context is cancelled/done
	eg, egCtx := errgroup.WithContext(ctx)

	// limit the number of concurrent queries
	eg.SetLimit(10)

	for _, q := range req.Queries {
		eg.Go(func() error {
			res := ds.queryData(egCtx, q)
			response.Responses[q.RefID] = res
			return nil
		})
	}

	err := eg.Wait()
	return response, err
}

func (ds *HistorianDataSource) queryData(ctx context.Context, backendQuery backend.DataQuery) backend.DataResponse {
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

		response.Frames, response.Error = ds.handleAssetMeasurementQuery(ctx, assetMeasurementQuery, backendQuery.TimeRange, backendQuery.Interval, query.SeriesLimit, query.HistorianInfo)
		return response
	case QueryTypeQuery:
		measurementQuery := schemas.MeasurementQuery{}
		if err := json.Unmarshal(query.Query, &measurementQuery); err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		measurements, err := ds.getMeasurements(ctx, measurementQuery, query.SeriesLimit)
		if err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		measurementQuery.Measurements = measurements
		response.Frames, response.Error = ds.handleMeasurementQuery(ctx, measurementQuery, backendQuery.TimeRange, backendQuery.Interval)
		return response
	case QueryTypeRaw:
		rawQuery := schemas.RawQuery{}
		if err := json.Unmarshal(query.Query, &rawQuery); err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		response.Frames, response.Error = ds.handleRawQuery(ctx, rawQuery, backendQuery.TimeRange, backendQuery.Interval)
		return response
	case QueryTypeEvent:
		eventQuery := schemas.EventQuery{}
		if err := json.Unmarshal(query.Query, &eventQuery); err != nil {
			return backend.DataResponse{
				Error: err,
			}
		}

		response.Frames, response.Error = ds.handleEventQuery(ctx, eventQuery, backendQuery.TimeRange, backendQuery.Interval, query.SeriesLimit, query.HistorianInfo)
		return response
	}

	response.Error = fmt.Errorf("unsupported query type %s", backendQuery.QueryType)
	return response
}

func (ds *HistorianDataSource) handleAssetMeasurementQuery(ctx context.Context, assetMeasurementQuery schemas.AssetMeasurementQuery, timeRange backend.TimeRange, interval time.Duration, seriesLimit int, historianInfo *schemas.HistorianInfo) (data.Frames, error) {
	assets, err := ds.API.GetFilteredAssets(ctx, assetMeasurementQuery.Assets, historianInfo)
	if err != nil {
		return nil, err
	}

	var assetProperties []schemas.AssetProperty
	canFilterAssetProperties := util.CheckMinimumVersion(historianInfo, "6.3.0", false)
	if canFilterAssetProperties {
		assetPropertyQuery := url.Values{}

		for i, assetUUID := range slices.Collect(maps.Keys(assets)) {
			assetPropertyQuery.Add(fmt.Sprintf("AssetUUIDs[%d]", i), assetUUID.String())
		}

		assetProperties, err = ds.API.GetAssetProperties(ctx, assetPropertyQuery.Encode())
		if err != nil {
			return nil, err
		}
	} else {
		assetProperties, err = ds.API.GetAssetProperties(ctx, "")
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
	for assetUUID := range maps.Keys(assets) {
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

	if len(measurementUUIDs) == 0 {
		return nil, nil
	}

	measurementQuery := schemas.MeasurementQuery{
		Measurements: slices.Collect(maps.Keys(measurementUUIDs)),
		Options:      assetMeasurementQuery.Options,
	}

	frames, err := ds.handleQuery(ctx, historianQuery(measurementQuery, timeRange, interval), measurementQuery.Options)
	if err != nil {
		return nil, err
	}

	setAssetFrameNames(frames, assets, measurementIndexToPropertyMap, measurementQuery.Options)
	if measurementQuery.Options.MetadataAsLabels {
		setFieldLabels(frames)
	}
	return sortByStatus(frames), nil
}

func (ds *HistorianDataSource) getMeasurements(ctx context.Context, measurementQuery schemas.MeasurementQuery, seriesLimit int) ([]string, error) {
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
	databases, err := ds.API.GetTimeseriesDatabases(ctx, "")
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
		res, err := ds.API.GetMeasurements(ctx, values.Encode())
		if err != nil {
			return nil, err
		}

		if len(res) == 0 {
			return nil, fmt.Errorf("invalid measurement: %v", measurement)
		}

		for i := range res {
			parsedMeasurements = append(parsedMeasurements, res[i].UUID.String())
		}
	}
	return parsedMeasurements, nil
}

func (ds *HistorianDataSource) handleMeasurementQuery(ctx context.Context, measurementQuery schemas.MeasurementQuery, timeRange backend.TimeRange, interval time.Duration) (data.Frames, error) {
	frames, err := ds.handleQuery(ctx, historianQuery(measurementQuery, timeRange, interval), measurementQuery.Options)
	if err != nil {
		return nil, err
	}

	setMeasurementFrameNames(frames, measurementQuery.Options)
	if measurementQuery.Options.MetadataAsLabels {
		setFieldLabels(frames)
	}
	return sortByStatus(frames), nil
}

func (ds *HistorianDataSource) handleQuery(ctx context.Context, query schemas.Query, options schemas.MeasurementQueryOptions) (data.Frames, error) {
	result, err := ds.API.MeasurementQuery(ctx, query)
	if err != nil {
		return nil, err
	}

	if options.IncludeLastKnownPoint || options.FillInitialEmptyValues {
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
				lastResult, err := ds.API.MeasurementQuery(ctx, getLastQueryForFrame)
				if err != nil {
					return nil, err
				}

				lastKnowPointResults = append(lastKnowPointResults, lastResult...)
			}
		}

		// OtherFrames
		lastResult, err := ds.API.MeasurementQuery(ctx, lastPointQuery)
		if err != nil {
			return nil, err
		}
		lastKnowPointResults = append(lastKnowPointResults, lastResult...)

		result = mergeFrames(lastKnowPointResults, result)
		if options.FillInitialEmptyValues {
			result = fillInitialEmptyIntervals(result, query)
		}

		if !options.IncludeLastKnownPoint {
			result = deleteFirstRow(result)
		}
	}
	if options.ChangesOnly {
		for _, frame := range result {
			valueField, _ := frame.FieldByName("value")
			if valueField == nil {
				continue
			}

			var previousValue interface{}
			rowsToDelete := []int{}
			for i := 0; i < valueField.Len(); i++ {
				value, ok := valueField.ConcreteAt(i)
				if !ok {
					continue
				}

				if previousValue == nil || value != previousValue {
					previousValue = value
					continue
				}

				rowsToDelete = append(rowsToDelete, i)
			}
			for i := len(rowsToDelete) - 1; i >= 0; i-- {
				frame.DeleteRow(rowsToDelete[i])
			}
		}
	}

	return addMetaData(result, options.UseEngineeringSpecs), nil
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

func (ds *HistorianDataSource) handleRawQuery(ctx context.Context, rawQuery schemas.RawQuery, timeRange backend.TimeRange, interval time.Duration) (data.Frames, error) {
	rawQuery.Query = fillQueryVariables(rawQuery.Query, "Influx", timeRange, interval)

	result, err := ds.API.RawQuery(ctx, rawQuery.TimeseriesDatabase, schemas.RawQuery{Query: rawQuery.Query, Format: schemas.ArrowFormat})
	if err != nil {
		return nil, err
	}

	setRawFrameNames(result)
	return result, nil
}

func fillQueryVariables(query string, databaseType string, timeRange backend.TimeRange, interval time.Duration) string {
	timeFilter := ""
	intervalStr := ""

	if databaseType == "Influx" {
		timeFilter = fmt.Sprintf("time >= %vns AND time < %vns", timeRange.From.UnixNano(), timeRange.To.UnixNano())
		intervalNano := interval.Nanoseconds()
		intervalStr = fmt.Sprintf("TIME(%vns, %vns)", intervalNano, timeRange.From.UnixNano()%intervalNano)
	}

	query = strings.ReplaceAll(query, "$timeFilter", timeFilter)
	query = strings.ReplaceAll(query, "$__interval", intervalStr)
	return query
}

func historianQuery(query schemas.MeasurementQuery, timeRange backend.TimeRange, interval time.Duration) schemas.Query {
	start := timeRange.From.Truncate(time.Second)
	end := timeRange.To.Truncate(time.Second)
	historianQuery := schemas.Query{
		MeasurementUUIDs: query.Measurements,
		Start:            start,
		End:              &end,
		Tags:             query.Options.Tags,
		ValueFilters:     query.Options.ValueFilters,
		GroupBy:          query.Options.GroupBy,
		Format:           schemas.ArrowFormat,
	}

	if query.Options.Aggregation != nil {
		historianQuery.Aggregation = query.Options.Aggregation
		if query.Options.Aggregation.Period == "$__interval" {
			historianQuery.Aggregation.Period = interval.String()
		}
	}

	if query.Options.Limit != nil {
		historianQuery.Limit = *query.Options.Limit
	}

	return historianQuery
}
