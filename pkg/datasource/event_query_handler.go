package datasource

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"golang.org/x/exp/maps"
)

func handleEventQuery(ctx context.Context, eventQuery schemas.EventQuery, backendQuery backend.DataQuery, seriesLimit int, historianInfo *schemas.HistorianInfo, api *api.API) (data.Frames, error) {
	assets, err := api.GetFilteredAssets(ctx, eventQuery.Assets, historianInfo)
	if err != nil {
		return nil, err
	}

	eventTypes, err := api.GetFilteredEventTypes(ctx, eventQuery.EventTypes, historianInfo)
	if err != nil {
		return nil, err
	}

	if len(assets) == 0 || len(eventTypes) == 0 {
		return data.Frames{}, nil
	}

	filter := schemas.EventFilter{
		StartTime:         backendQuery.TimeRange.From,
		StopTime:          backendQuery.TimeRange.To,
		AssetUUIDs:        maps.Keys(assets),
		EventTypeUUIDs:    maps.Keys(eventTypes),
		PreloadProperties: true,
		Limit:             math.MaxInt32,
		PropertyFilter:    eventQuery.PropertyFilter,
		Status:            eventQuery.Statuses,
	}

	events, err := api.EventQuery(filter)
	if err != nil {
		return nil, err
	}

	eventTypeProperties := []schemas.EventTypeProperty{}
	if util.CheckMinimumVersion(historianInfo, "6.4.0") {
		eventTypeQuery := url.Values{}
		for i, eventTypeUUID := range maps.Keys(eventTypes) {
			eventTypeQuery.Add(fmt.Sprintf("EventTypeUUIDs[%d]", i), eventTypeUUID.String())
		}
		eventTypeQuery.Add("Types[0]", eventQuery.Type)
		eventTypeProperties, err = api.GetEventTypeProperties(ctx, eventTypeQuery.Encode())
		if err != nil {
			return nil, err
		}
	} else {
		allEventTypeProperties, err := api.GetEventTypeProperties(ctx, "")
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
		assetProperties, err := api.GetAssetProperties(ctx, "")
		if err != nil {
			return nil, err
		}

		for _, event := range events {
			var err error
			frames, err := handleEventAssetMeasurementQuery(eventQuery.Type, event, assetMeasurementQuery, assets, assetProperties, backendQuery, seriesLimit, api)
			if err != nil {
				return nil, err
			}

			eventAssetPropertyFrames[event.UUID] = frames
		}
	}

	switch eventQuery.Type {
	case string(schemas.EventTypePropertyTypeSimple):
		assetPropertyFieldTypes := getAssetPropertyFieldTypes(eventAssetPropertyFrames)
		return EventQueryResultToDataFrame(maps.Values(assets), events, maps.Values(eventTypes), eventTypeProperties, selectedPropertiesSet, assetPropertyFieldTypes, eventAssetPropertyFrames)
	case string(schemas.EventTypePropertyTypePeriodic):
		return EventQueryResultToTrendDataFrame(maps.Values(assets), events, maps.Values(eventTypes), eventTypeProperties, selectedPropertiesSet, eventAssetPropertyFrames)
	default:
		return nil, fmt.Errorf("unsupported event query type %s", eventQuery.Type)
	}
}

func handleEventAssetMeasurementQuery(queryType string, event schemas.Event, assetMeasurementQuery schemas.AssetMeasurementQuery, assets map[uuid.UUID]schemas.Asset, assetProperties []schemas.AssetProperty, backendQuery backend.DataQuery, seriesLimit int, api *api.API) (data.Frames, error) {
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
		Measurements: maps.Keys(measurementUUIDs),
		Options:      assetMeasurementQuery.Options,
	}

	q := historianQuery(measurementQuery, backendQuery)
	q.Start = event.StartTime
	q.End = event.StopTime
	now := time.Now()

	if q.Aggregation == nil {
		return nil, fmt.Errorf("no aggregation specified")
	}

	if queryType == "simple" {
		stopTime := now
		if event.StopTime != nil {
			stopTime = *event.StopTime
		}
		interval := stopTime.Sub(event.StartTime)
		q.Aggregation.Period = interval.String()
	}
	frames, err := handleQuery(measurementQuery, q, api)
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
