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

func (ds *HistorianDataSource) handleEventQuery(ctx context.Context, eventQuery schemas.EventQuery, timeRange backend.TimeRange, seriesLimit int, historianInfo *schemas.HistorianInfo) (data.Frames, error) {
	assets, err := ds.API.GetFilteredAssets(ctx, eventQuery.Assets, historianInfo)
	if err != nil {
		return nil, err
	}

	eventTypes, err := ds.API.GetFilteredEventTypes(ctx, eventQuery.EventTypes, historianInfo)
	if err != nil {
		return nil, err
	}

	if len(assets) == 0 || len(eventTypes) == 0 {
		return data.Frames{}, nil
	}

	filter := schemas.EventFilter{
		StartTime:         timeRange.From,
		StopTime:          timeRange.To,
		AssetUUIDs:        slices.Collect(maps.Keys(assets)),
		EventTypeUUIDs:    slices.Collect(maps.Keys(eventTypes)),
		PreloadProperties: true,
		Limit:             math.MaxInt32,
		PropertyFilter:    eventQuery.PropertyFilter,
		Status:            eventQuery.Statuses,
	}

	events, err := ds.API.EventQuery(ctx, filter)
	if err != nil {
		return nil, err
	}

	eventTypeProperties := []schemas.EventTypeProperty{}
	if util.CheckMinimumVersion(historianInfo, "6.4.0") {
		eventTypeQuery := url.Values{}
		for i, eventTypeUUID := range slices.Collect(maps.Keys(eventTypes)) {
			eventTypeQuery.Add(fmt.Sprintf("EventTypeUUIDs[%d]", i), eventTypeUUID.String())
		}
		eventTypeQuery.Add("Types[0]", eventQuery.Type)
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
			if _, ok := eventTypes[eventTypeProperty.EventTypeUUID]; ok {
				eventTypeProperties = append(eventTypeProperties, eventTypeProperty)
			}
		}
	}

	selectedPropertiesSet := map[string]struct{}{}
	for _, property := range eventQuery.Properties {
		selectedPropertiesSet[property] = struct{}{}
	}

	eventAssetPropertyFrames := make(map[uuid.UUID]data.Frames)
	if eventQuery.QueryAssetProperties && eventQuery.Options != nil {
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
			frames, err := ds.handleEventAssetMeasurementQuery(ctx, eventQuery.Type, events[i], assetMeasurementQuery, assets, assetProperties, timeRange, seriesLimit)
			if err != nil {
				return nil, err
			}

			eventAssetPropertyFrames[events[i].UUID] = frames
		}
	}

	switch eventQuery.Type {
	case string(schemas.EventTypePropertyTypeSimple):
		assetPropertyFieldTypes := getAssetPropertyFieldTypes(eventAssetPropertyFrames)
		return EventQueryResultToDataFrame(slices.Collect(maps.Values(assets)), events, slices.Collect(maps.Values(eventTypes)), eventTypeProperties, selectedPropertiesSet, assetPropertyFieldTypes, eventAssetPropertyFrames)
	case string(schemas.EventTypePropertyTypePeriodic):
		return EventQueryResultToTrendDataFrame(slices.Collect(maps.Values(assets)), events, slices.Collect(maps.Values(eventTypes)), eventTypeProperties, selectedPropertiesSet, eventAssetPropertyFrames)
	default:
		return nil, fmt.Errorf("unsupported event query type %s", eventQuery.Type)
	}
}

func (ds *HistorianDataSource) handleEventAssetMeasurementQuery(ctx context.Context, queryType string, event schemas.Event, assetMeasurementQuery schemas.AssetMeasurementQuery, assets map[uuid.UUID]schemas.Asset, assetProperties []schemas.AssetProperty, timeRange backend.TimeRange, seriesLimit int) (data.Frames, error) {
	if assetMeasurementQuery.Options.Aggregation == nil {
		return nil, errors.New("no aggregation specified")
	}

	measurementUUIDs := map[string]struct{}{}
	measurementIndexToPropertyMap := make([]schemas.AssetProperty, 0)

	for _, property := range assetMeasurementQuery.AssetProperties {
		for _, assetProperty := range assetProperties {
			if (assetProperty.Name == property && assetProperty.AssetUUID == event.AssetUUID) || assetProperty.UUID.String() == property {
				if len(measurementUUIDs) >= seriesLimit {
					if _, ok := measurementUUIDs[assetProperty.MeasurementUUID.String()]; !ok {
						break
					}
				}

				measurementUUIDs[assetProperty.MeasurementUUID.String()] = struct{}{}
				measurementIndexToPropertyMap = append(measurementIndexToPropertyMap, assetProperty)
				break
			}
		}
	}

	measurementQuery := schemas.MeasurementQuery{
		Measurements: slices.Collect(maps.Keys(measurementUUIDs)),
		Options:      assetMeasurementQuery.Options,
	}

	historianQuery := historianQuery(measurementQuery, timeRange)
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

func getAssetPropertyFieldTypes(eventAssetPropertyFrames map[uuid.UUID]data.Frames) map[string]data.FieldType {
	assetPropertyFieldTypes := map[string]data.FieldType{}
	for _, frames := range eventAssetPropertyFrames {
		for _, frame := range frames {
			custom, ok := frame.Meta.Custom.(map[string]interface{})
			if !ok {
				continue
			}

			name := custom["AssetProperty"].(string)

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
