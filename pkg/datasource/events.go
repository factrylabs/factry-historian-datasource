package datasource

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

const (
	StartTimeIndex     = 0
	StopTimeIndex      = 1
	AssetUUIDIndex     = 2
	EventTypeUUIDIndex = 3
	SourceIndex        = 4
	StatusIndex        = 5
	PropertiesIndex    = 6
)

// EventQueryResultToDataFrame converts a event query result to data frames
func EventQueryResultToDataFrame(events []schemas.Event, eventTypes []schemas.EventType, eventTypeProperties []schemas.EventTypeProperty) (data.Frames, error) {
	dataFrames := data.Frames{}

	for _, eventType := range eventTypes {
		eventsForEventType := []schemas.Event{}
		for _, event := range events {
			if event.EventTypeUUID == eventType.UUID {
				eventsForEventType = append(eventsForEventType, event)
			}
		}
		if len(eventsForEventType) > 0 {
			eventTypePropertiesForEventType := []schemas.EventTypeProperty{}
			for _, eventTypeProperty := range eventTypeProperties {
				if eventTypeProperty.EventTypeUUID == eventType.UUID {
					eventTypePropertiesForEventType = append(eventTypePropertiesForEventType, eventTypeProperty)
				}
			}
			dataFrames = append(dataFrames, dataFrameForEventType(eventsForEventType, eventType, eventTypePropertiesForEventType))
		}
	}

	return dataFrames, nil
}

func dataFrameForEventType(events []schemas.Event, eventType schemas.EventType, eventTypeProperties []schemas.EventTypeProperty) *data.Frame {
	fields := []*data.Field{
		data.NewField("StartTime", data.Labels{}, []*time.Time{}),
		data.NewField("StopTime", data.Labels{}, []*time.Time{}),
		data.NewField("AssetUUID", data.Labels{}, []string{}),
		data.NewField("EventTypeUUID", data.Labels{}, []string{}),
		data.NewField("Source", data.Labels{}, []string{}),
		data.NewField("Status", data.Labels{}, []string{}),
	}

	for _, eventTypeProperty := range eventTypeProperties {
		if eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic {
			continue // skip periodic properties for now
		}
		switch eventTypeProperty.Datatype {
		case schemas.EventTypePropertyDatatypeBool:
			fields = append(fields, data.NewField(eventTypeProperty.Name, data.Labels{}, []*bool{}))
		case schemas.EventTypePropertyDatatypeNumber:
			fields = append(fields, data.NewField(eventTypeProperty.Name, data.Labels{}, []*float64{}))
		case schemas.EventTypePropertyDatatypeString:
			fields = append(fields, data.NewField(eventTypeProperty.Name, data.Labels{}, []*string{}))
		default:
			fields = append(fields, data.NewField(eventTypeProperty.Name, data.Labels{}, []interface{}{}))
		}
	}

	for _, event := range events {
		fields[StartTimeIndex].Append(event.StartTime)
		fields[StopTimeIndex].Append(event.StopTime)
		fields[AssetUUIDIndex].Append(event.AssetUUID.String())
		fields[EventTypeUUIDIndex].Append(event.EventTypeUUID.String())
		fields[SourceIndex].Append(string(event.Source))
		fields[StatusIndex].Append(string(event.Status))

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

	return data.NewFrame(eventType.Name, fields...)
}
