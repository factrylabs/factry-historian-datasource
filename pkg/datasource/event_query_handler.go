package datasource

import (
	"context"
	"fmt"
	"maps"
	"math"
	"net/url"
	"slices"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/pkg/errors"
)

func (ds *HistorianDataSource) handleEventQuery(ctx context.Context, eventQuery schemas.EventQuery, timeRange backend.TimeRange, interval time.Duration, seriesLimit int, historianInfo *schemas.HistorianInfo) (data.Frames, error) {
	assets, err := ds.API.GetFilteredAssets(ctx, eventQuery.Assets, historianInfo)
	if err != nil {
		return nil, err
	}

	eventTypes, err := ds.API.GetFilteredEventTypes(ctx, eventQuery.EventTypes, historianInfo)
	if err != nil {
		return nil, err
	}

	allEventTypes, err := ds.API.GetEventTypes(ctx, "")
	if err != nil {
		return nil, err
	}

	if len(assets) == 0 || len(eventTypes) == 0 {
		return data.Frames{}, nil
	}

	limit := math.MaxInt
	if eventQuery.Limit > 0 {
		limit = eventQuery.Limit
	}

	var startTime *time.Time = &timeRange.From
	var stopTime *time.Time = &timeRange.To

	if eventQuery.OverrideTimeRange {
		startTime = eventQuery.TimeRange.From
		stopTime = eventQuery.TimeRange.To
	}

	filter := schemas.EventFilter{
		StartTime:         startTime,
		StopTime:          stopTime,
		AssetUUIDs:        slices.Collect(maps.Keys(assets)),
		EventTypeUUIDs:    slices.Collect(maps.Keys(eventTypes)),
		PreloadProperties: true,
		Limit:             limit,
		PropertyFilter:    eventQuery.PropertyFilter,
		Status:            eventQuery.Statuses,
	}

	events, err := ds.API.EventQuery(ctx, filter)
	if err != nil {
		return nil, err
	}

	// get all unique event types from the events
	eventTypeUUIDs := map[uuid.UUID]struct{}{}
	for i := range events {
		eventTypeUUIDs[events[i].EventTypeUUID] = struct{}{}
		if events[i].Parent != nil {
			eventTypeUUIDs[events[i].Parent.EventTypeUUID] = struct{}{}
		}
	}

	var eventTypeProperties []schemas.EventTypeProperty
	if util.CheckMinimumVersion(historianInfo, "6.4.0", false) {
		eventTypeQuery := url.Values{}
		for i, eventTypeUUID := range slices.Collect(maps.Keys(eventTypeUUIDs)) {
			eventTypeQuery.Add(fmt.Sprintf("EventTypeUUIDs[%d]", i), eventTypeUUID.String())
		}
		if eventQuery.Type == string(schemas.EventTypePropertyTypeSimple) {
			eventTypeQuery.Add("Types[0]", eventQuery.Type)
		}
		eventTypeProperties, err = ds.API.GetEventTypeProperties(ctx, eventTypeQuery.Encode())
		if err != nil {
			return nil, err
		}
	} else {
		allEventTypeProperties, err := ds.API.GetEventTypeProperties(ctx, "")
		if err != nil {
			return nil, err
		}

		for _, eventTypeProperty := range allEventTypeProperties {
			if _, ok := eventTypeUUIDs[eventTypeProperty.EventTypeUUID]; !ok {
				continue
			}
			if eventQuery.Type == string(schemas.EventTypePropertyTypeSimple) && eventTypeProperty.Type != schemas.EventTypePropertyTypeSimple {
				continue
			}
			eventTypeProperties = append(eventTypeProperties, eventTypeProperty)
		}
	}

	selectedPropertiesSet := map[string]struct{}{}
	for _, property := range eventQuery.Properties {
		selectedPropertiesSet[property] = struct{}{}
	}

	eventAssetPropertyFrames := make(map[uuid.UUID]data.Frames)
	multipleAssetsSelected := len(assets) > 1
	if eventQuery.QueryAssetProperties && eventQuery.Options != nil {
		assetMeasurementQueryAssets := assets
		if len(eventQuery.OverrideAssets) > 0 {
			assetMeasurementQueryAssets, err = ds.API.GetFilteredAssets(ctx, eventQuery.OverrideAssets, historianInfo)
			if err != nil {
				return nil, err
			}

			multipleAssetsSelected = len(assetMeasurementQueryAssets) > 1
		}
		assetMeasurementQuery := schemas.AssetMeasurementQuery{
			AssetProperties: eventQuery.AssetProperties,
			Options:         *eventQuery.Options,
		}
		assetProperties, err := ds.API.GetAssetProperties(ctx, "")
		if err != nil {
			return nil, err
		}

		for i := range events {
			var err error
			frames, err := ds.handleEventAssetMeasurementQuery(ctx, eventQuery.Type, events[i], assetMeasurementQuery, assetMeasurementQueryAssets, assetProperties, timeRange, interval, seriesLimit)
			if err != nil {
				return nil, err
			}

			if len(frames) > 0 {
				eventAssetPropertyFrames[events[i].UUID] = frames
			}
		}
	}

	eventTypePropertiesByEventType := map[uuid.UUID][]schemas.EventTypeProperty{}
	for _, eventTypeProperty := range eventTypeProperties {
		if _, ok := eventTypePropertiesByEventType[eventTypeProperty.EventTypeUUID]; !ok {
			eventTypePropertiesByEventType[eventTypeProperty.EventTypeUUID] = []schemas.EventTypeProperty{}
		}
		eventTypePropertiesByEventType[eventTypeProperty.EventTypeUUID] = append(eventTypePropertiesByEventType[eventTypeProperty.EventTypeUUID], eventTypeProperty)
	}

	switch eventQuery.Type {
	case string(schemas.EventTypePropertyTypeSimple):
		assetPropertyFieldTypes := getAssetPropertyFieldTypes(eventAssetPropertyFrames, multipleAssetsSelected)
		return EventQueryResultToDataFrame(eventQuery.IncludeParentInfo, multipleAssetsSelected, slices.Collect(maps.Values(assets)), events, allEventTypes, eventTypeProperties, selectedPropertiesSet, assetPropertyFieldTypes, eventAssetPropertyFrames)
	case string(schemas.EventTypePropertyTypePeriodic):
		return EventQueryResultToTrendDataFrame(eventQuery.IncludeParentInfo, slices.Collect(maps.Values(assets)), events, util.ByUUID(allEventTypes), eventTypePropertiesByEventType, selectedPropertiesSet, eventAssetPropertyFrames, false)
	case string(schemas.EventTypePropertyTypePeriodicWithDimension):
		return EventQueryResultToTrendDataFrame(eventQuery.IncludeParentInfo, slices.Collect(maps.Values(assets)), events, util.ByUUID(allEventTypes), eventTypePropertiesByEventType, selectedPropertiesSet, eventAssetPropertyFrames, true)
	default:
		return nil, fmt.Errorf("unsupported event query type %s", eventQuery.Type)
	}
}

func (ds *HistorianDataSource) handleEventAssetMeasurementQuery(ctx context.Context, queryType string, event schemas.Event, assetMeasurementQuery schemas.AssetMeasurementQuery, assets map[uuid.UUID]schemas.Asset, assetProperties []schemas.AssetProperty, timeRange backend.TimeRange, interval time.Duration, seriesLimit int) (data.Frames, error) {
	if assetMeasurementQuery.Options.Aggregation == nil {
		return nil, errors.New("no aggregation specified")
	}

	measurementUUIDs := map[string]struct{}{}
	measurementIndexToPropertyMap := make([]schemas.AssetProperty, 0)

	for _, assetProperty := range assetProperties {
		if _, ok := assets[assetProperty.AssetUUID]; !ok {
			continue
		}

		if len(assetMeasurementQuery.AssetProperties) == 0 || slices.Contains(assetMeasurementQuery.AssetProperties, assetProperty.UUID.String()) || slices.Contains(assetMeasurementQuery.AssetProperties, assetProperty.Name) {
			if len(measurementUUIDs) >= seriesLimit {
				if _, ok := measurementUUIDs[assetProperty.MeasurementUUID.String()]; !ok {
					break
				}
			}

			measurementUUIDs[assetProperty.MeasurementUUID.String()] = struct{}{}
			measurementIndexToPropertyMap = append(measurementIndexToPropertyMap, assetProperty)
		}
	}

	if len(measurementUUIDs) == 0 {
		return nil, nil
	}

	measurementQuery := schemas.MeasurementQuery{
		Measurements: slices.Collect(maps.Keys(measurementUUIDs)),
		Options:      assetMeasurementQuery.Options,
	}

	historianQuery := historianQuery(measurementQuery, timeRange, interval)
	historianQuery.Start = event.StartTime
	historianQuery.End = event.StopTime

	if queryType == "simple" {
		stopTime := time.Now()
		if event.StopTime != nil {
			stopTime = *event.StopTime
		}
		interval := stopTime.Sub(event.StartTime)
		historianQuery.Aggregation.Period = interval.String()
	}

	frames, err := ds.handleQuery(ctx, historianQuery, measurementQuery.Options)
	if err != nil {
		return nil, err
	}

	return sortByStatus(setAssetFrameNames(frames, assets, measurementIndexToPropertyMap, measurementQuery.Options)), nil
}

func getAssetPropertyFieldTypes(eventAssetPropertyFrames map[uuid.UUID]data.Frames, includeAssetPath bool) map[string]data.FieldType {
	assetPropertyFieldTypes := map[string]data.FieldType{}
	for _, frames := range eventAssetPropertyFrames {
		for _, frame := range frames {
			name, ok := getAssetPropertyFieldName(frame, includeAssetPath)
			if !ok {
				continue
			}

			fieldType, ok := assetPropertyFieldTypes[name]
			if !ok {
				assetPropertyFieldTypes[name] = frame.Fields[1].Type()
				continue
			}

			if fieldType != frame.Fields[1].Type() {
				assetPropertyFieldTypes[name] = data.FieldTypeNullableString
			}
		}
	}
	return assetPropertyFieldTypes
}

func getAssetPropertyFieldName(frame *data.Frame, includeAssetPath bool) (string, bool) {
	custom, ok := frame.Meta.Custom.(map[string]interface{})
	if !ok {
		return "", false
	}

	name, ok := custom["AssetProperty"].(string)
	if !ok {
		return "", false
	}

	if !includeAssetPath {
		return name, true
	}

	assetPath, ok := custom["AssetPath"].(string)
	if !ok {
		return "", false
	}

	return fmt.Sprintf("%s.%s", assetPath, name), true
}
