package datasource

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

const (
	StartTimeIndex  = 0
	StopTimeIndex   = 1
	PropertiesIndex = 2
)

// EventLabels ...
type EventLabels struct {
	Status        string
	AssetUUID     uuid.UUID
	EventTypeUUID uuid.UUID
}

// EventQueryResultToDataFrame converts a event query result to data frames
func EventQueryResultToDataFrame(assets []schemas.Asset, events []schemas.Event, eventTypes []schemas.EventType, eventTypeProperties []schemas.EventTypeProperty) (data.Frames, error) {
	dataFrames := data.Frames{}
	groupedEvents := map[EventLabels][]schemas.Event{}
	eventTypePropertiesForEventType := map[uuid.UUID][]schemas.EventTypeProperty{}

	for _, event := range events {
		eventLabels := EventLabels{
			AssetUUID:     event.AssetUUID,
			EventTypeUUID: event.EventTypeUUID,
			Status:        string(event.Status),
		}
		groupedEvents[eventLabels] = append(groupedEvents[eventLabels], event)
	}
	for _, eventType := range eventTypes {
		eventTypePropertiesForEventType[eventType.UUID] = []schemas.EventTypeProperty{}
		for _, eventTypeProperty := range eventTypeProperties {
			if eventTypeProperty.EventTypeUUID == eventType.UUID {
				eventTypePropertiesForEventType[eventType.UUID] = append(eventTypePropertiesForEventType[eventType.UUID], eventTypeProperty)
			}
		}
	}

	for group, groupedEvents := range groupedEvents {
		dataFrames = append(dataFrames, dataFrameForEventType(assets, eventTypes, groupedEvents, group, eventTypePropertiesForEventType[group.EventTypeUUID]))
	}

	return dataFrames, nil
}

func dataFrameForEventType(assets []schemas.Asset, eventTypes []schemas.EventType, events []schemas.Event, group EventLabels, eventTypeProperties []schemas.EventTypeProperty) *data.Frame {
	assetPath := ""
	UUIDToAssetMap := make(map[uuid.UUID]schemas.Asset)
	for _, asset := range assets {
		UUIDToAssetMap[asset.UUID] = asset
	}

	assetPath = getAssetPath(UUIDToAssetMap, group.AssetUUID)

	groupEventType := schemas.EventType{}
	for _, eventType := range eventTypes {
		if eventType.UUID == group.EventTypeUUID {
			groupEventType = eventType
			break
		}
	}

	labels := data.Labels{
		"Asset":      assetPath,
		"Event type": groupEventType.Name,
		"Status":     group.Status,
	}
	fields := []*data.Field{
		data.NewField("StartTime", labels, []*time.Time{}),
		data.NewField("StopTime", labels, []*time.Time{}),
	}

	for _, eventTypeProperty := range eventTypeProperties {
		if eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic {
			continue // skip periodic properties for now
		}

		switch eventTypeProperty.Datatype {
		case schemas.EventTypePropertyDatatypeBool:
			fields = append(fields, data.NewField(eventTypeProperty.Name, labels, []*bool{}))
		case schemas.EventTypePropertyDatatypeNumber:
			fields = append(fields, data.NewField(eventTypeProperty.Name, labels, []*float64{}))
		case schemas.EventTypePropertyDatatypeString:
			fields = append(fields, data.NewField(eventTypeProperty.Name, labels, []*string{}))
		default:
			fields = append(fields, data.NewField(eventTypeProperty.Name, labels, []interface{}{}))
		}
	}

	for _, event := range events {
		fields[StartTimeIndex].Append(event.StartTime)
		fields[StopTimeIndex].Append(event.StopTime)

		if event.Properties == nil {
			propertyIndexOffset := 0
			for _, eventType := range eventTypeProperties {
				if eventType.Type == schemas.EventTypePropertyTypePeriodic {
					continue // skip periodic properties for now
				}

				fields[PropertiesIndex+propertyIndexOffset].Append(nil)
				propertyIndexOffset++
			}
			continue
		}

		propertyIndexOffset := 0
		for _, eventTypeProperty := range eventTypeProperties {
			if eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic {
				continue // skip periodic properties for now
			}

			propertyFound := false
			for property, value := range event.Properties.Properties {
				if property == eventTypeProperty.Name {
					propertyFound = true
					switch eventTypeProperty.Datatype {
					case schemas.EventTypePropertyDatatypeBool:
						boolValue, ok := value.(bool)
						if ok {
							fields[PropertiesIndex+propertyIndexOffset].Append(&boolValue)
						} else {
							fields[PropertiesIndex+propertyIndexOffset].Append(nil)
						}
					case schemas.EventTypePropertyDatatypeNumber:
						numberValue, ok := value.(float64)
						if ok {
							fields[PropertiesIndex+propertyIndexOffset].Append(&numberValue)
						} else {
							fields[PropertiesIndex+propertyIndexOffset].Append(nil)
						}
					case schemas.EventTypePropertyDatatypeString:
						stringValue, ok := value.(string)
						if ok {
							fields[PropertiesIndex+propertyIndexOffset].Append(&stringValue)
						} else {
							fields[PropertiesIndex+propertyIndexOffset].Append(nil)
						}
					}
					break
				}
			}

			if !propertyFound {
				fields[PropertiesIndex+propertyIndexOffset].Append(nil)
			}
			propertyIndexOffset++
		}
	}

	return data.NewFrame(fmt.Sprintf("%s - %s - %s", assetPath, groupEventType.Name, group.Status), fields...)
}
