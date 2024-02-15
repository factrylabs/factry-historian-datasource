package datasource

import (
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/api"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
	"golang.org/x/exp/maps"
)

func handleEventQuery(eventQuery schemas.EventQuery, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	assets, err := api.GetAssets("")
	if err != nil {
		return nil, err
	}

	eventTypes, err := api.GetEventTypes("")
	if err != nil {
		return nil, err
	}

	assetUUIDs := []uuid.UUID{}
	eventTypeUUIDs := []uuid.UUID{}
	for _, assetString := range eventQuery.Assets {
		if filteredAssetUUIDs := filterAssetUUIDs(assets, assetString); len(filteredAssetUUIDs) > 0 {
			assetUUIDs = append(assetUUIDs, filteredAssetUUIDs...)
		}
	}
	for _, eventTypeString := range eventQuery.EventTypes {
		if filteredEventTypeUUIDs := filterEventTypeUUIDs(eventTypes, eventTypeString); len(filteredEventTypeUUIDs) > 0 {
			eventTypeUUIDs = append(eventTypeUUIDs, filteredEventTypeUUIDs...)
		}
	}
	if len(assetUUIDs) == 0 || len(eventTypeUUIDs) == 0 {
		return data.Frames{}, nil
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

	allEventTypeProperties, err := api.GetEventTypeProperties("")
	if err != nil {
		return nil, err
	}

	eventTypeSet := map[uuid.UUID]struct{}{}
	for _, eventTypeUUID := range eventTypeUUIDs {
		eventTypeSet[eventTypeUUID] = struct{}{}
	}

	eventTypeProperties := []schemas.EventTypeProperty{}
	for _, eventTypeProperty := range allEventTypeProperties {
		if _, ok := eventTypeSet[eventTypeProperty.EventTypeUUID]; ok {
			eventTypeProperties = append(eventTypeProperties, eventTypeProperty)
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
		assetProperties, err := api.GetAssetProperties("")
		if err != nil {
			return nil, err
		}

		for _, event := range events {
			var err error
			frames, err := handleEventAssetMeasurementQuery(eventQuery.Type, event, assetMeasurementQuery, assets, assetProperties, backendQuery, api)
			if err != nil {
				return nil, err
			}

			eventAssetPropertyFrames[event.UUID] = frames
		}
	}

	switch eventQuery.Type {
	case string(schemas.EventTypePropertyTypeSimple):
		assetPropertyFieldTypes := getAssetPropertyFieldTypes(eventAssetPropertyFrames)
		return EventQueryResultToDataFrame(assets, events, eventTypes, eventTypeProperties, selectedPropertiesSet, assetPropertyFieldTypes, eventAssetPropertyFrames)
	case string(schemas.EventTypePropertyTypePeriodic):
		return EventQueryResultToTrendDataFrame(assets, events, eventTypes, eventTypeProperties, selectedPropertiesSet, eventAssetPropertyFrames)
	default:
		return nil, fmt.Errorf("unsupported event query type %s", eventQuery.Type)

	}
}

func handleEventAssetMeasurementQuery(queryType string, event schemas.Event, assetMeasurementQuery schemas.AssetMeasurementQuery, assets []schemas.Asset, assetProperties []schemas.AssetProperty, backendQuery backend.DataQuery, api *api.API) (data.Frames, error) {
	measurementUUIDs := map[string]struct{}{}
	measurementIndexToPropertyMap := make([]schemas.AssetProperty, 0)

	for _, property := range assetMeasurementQuery.AssetProperties {
		for _, assetProperty := range assetProperties {
			if (assetProperty.Name == property && assetProperty.AssetUUID == event.AssetUUID) || assetProperty.UUID.String() == property {
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
