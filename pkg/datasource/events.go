package datasource

import (
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/util"
	"golang.org/x/exp/maps"
)

// Constants for the event frames
const (
	StartTimeColumnName     = "StartTime"
	StopTimeColumnName      = "StopTime"
	AssetUUIDColumnName     = "AssetUUID"
	AssetColumnName         = "Asset"
	AssetPathColumnName     = "AssetPath"
	DurationColumnName      = "Duration"
	PropertyColumnName      = "Property"
	EventTypeColumnName     = "EventType"
	EventUUIDColumnName     = "EventUUID"
	EventTypeUUIDColumnName = "EventTypeUUID"
)

// EventQueryResultToDataFrame converts a event query result to data frames
func EventQueryResultToDataFrame(assets []schemas.Asset, events []schemas.Event, eventTypes []schemas.EventType, eventTypeProperties []schemas.EventTypeProperty, selectedProperties map[string]struct{}) (data.Frames, error) {
	dataFrames := data.Frames{}
	groupedEvents := map[uuid.UUID][]schemas.Event{}
	eventTypePropertiesForEventType := map[uuid.UUID][]schemas.EventTypeProperty{}
	eventTypesByUUID := map[uuid.UUID]schemas.EventType{}
	for _, eventType := range eventTypes {
		eventTypesByUUID[eventType.UUID] = eventType
		eventTypePropertiesForEventType[eventType.UUID] = []schemas.EventTypeProperty{}
		for _, eventTypeProperty := range eventTypeProperties {
			if _, ok := selectedProperties[eventTypeProperty.Name]; (len(selectedProperties) == 0 || ok) && eventTypeProperty.EventTypeUUID == eventType.UUID {
				eventTypePropertiesForEventType[eventType.UUID] = append(eventTypePropertiesForEventType[eventType.UUID], eventTypeProperty)
			}
		}
	}

	for _, event := range events {
		groupedEvents[event.EventTypeUUID] = append(groupedEvents[event.EventTypeUUID], event)
	}

	for eventTypeUUID, groupedEvents := range groupedEvents {
		dataFrames = append(dataFrames, dataFrameForEventType(assets, eventTypesByUUID[eventTypeUUID], groupedEvents, eventTypePropertiesForEventType[eventTypeUUID]))
	}

	return dataFrames, nil
}

// eventFrameColumn is used to keep track of the columns in the event frame
type eventFrameColumn struct {
	Field     *data.Field
	Name      string
	EventUUID uuid.UUID
}

// EventQueryResultToTrendDataFrame converts a event query result to data frames
func EventQueryResultToTrendDataFrame(assets []schemas.Asset, events []schemas.Event, eventTypes []schemas.EventType, eventTypeProperties []schemas.EventTypeProperty, selectedProperties map[string]struct{}, eventAssetPropertyFrames map[uuid.UUID]data.Frames) (data.Frames, error) {
	uuidToAssetMap := make(map[uuid.UUID]schemas.Asset)
	for _, asset := range assets {
		uuidToAssetMap[asset.UUID] = asset
	}

	uuidToEventTypeMap := make(map[uuid.UUID]schemas.EventType)
	for _, eventType := range eventTypes {
		uuidToEventTypeMap[eventType.UUID] = eventType
	}

	simpleEventTypeProperties := []schemas.EventTypeProperty{}
	periodicEventTypeProperties := []schemas.EventTypeProperty{}

	for _, eventTypeProperty := range eventTypeProperties {
		if eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic {
			if _, ok := selectedProperties[eventTypeProperty.Name]; len(selectedProperties) == 0 || ok {
				periodicEventTypeProperties = append(periodicEventTypeProperties, eventTypeProperty)
			}
		} else {
			simpleEventTypeProperties = append(simpleEventTypeProperties, eventTypeProperty)
		}
	}

	periodicPropertyData := map[float64]map[eventFrameColumn]interface{}{}

	columns := []eventFrameColumn{}

	for i := range events {
		labels := data.Labels{}
		for j := range simpleEventTypeProperties {
			name := simpleEventTypeProperties[j].Name
			if value, ok := events[i].Properties.Properties[name]; ok {
				labels[name] = fmt.Sprintf("%v", value)
			}
		}
		for j := range periodicEventTypeProperties {
			periodicPropertyValues := util.PeriodicPropertyValues{}
			if err := events[i].Properties.Properties.Get(periodicEventTypeProperties[j].Name, &periodicPropertyValues); err != nil {
				continue
			}

			identifier := eventFrameColumn{
				Name:      periodicEventTypeProperties[j].UUID.String(),
				EventUUID: events[i].UUID,
			}

			labels[PropertyColumnName] = periodicEventTypeProperties[j].Name
			labels[AssetPathColumnName] = getAssetPath(uuidToAssetMap, events[i].AssetUUID)
			labels[AssetColumnName] = uuidToAssetMap[events[i].AssetUUID].Name
			labels[EventTypeColumnName] = uuidToEventTypeMap[events[i].EventTypeUUID].Name
			labels[StartTimeColumnName] = events[i].StartTime.Format(time.RFC3339)
			labels[StopTimeColumnName] = ""
			labels[EventUUIDColumnName] = events[i].UUID.String()
			labels[EventTypeUUIDColumnName] = events[i].EventTypeUUID.String()
			labels[AssetUUIDColumnName] = events[i].AssetUUID.String()

			if events[i].StopTime != nil {
				labels[StopTimeColumnName] = events[i].StopTime.Format(time.RFC3339)
			}

			name := fmt.Sprintf("%s - %s - %s - %s - %s", labels[AssetPathColumnName], labels[EventTypeColumnName], labels[PropertyColumnName], labels[StartTimeColumnName], labels[StopTimeColumnName])

			switch periodicEventTypeProperties[j].Datatype {
			case schemas.EventTypePropertyDatatypeBool:
				identifier.Field = data.NewField(name, labels, []*bool{})
			case schemas.EventTypePropertyDatatypeNumber:
				identifier.Field = data.NewField(name, labels, []*float64{})
			case schemas.EventTypePropertyDatatypeString:
				identifier.Field = data.NewField(name, labels, []*string{})
			default:
				continue
			}

			setUOMFieldConfig(identifier.Field, periodicEventTypeProperties[j])
			columns = append(columns, identifier)

			for k := range periodicPropertyValues.Offsets {
				offset := periodicPropertyValues.Offsets[k]
				if _, ok := periodicPropertyData[offset]; !ok {
					periodicPropertyData[offset] = map[eventFrameColumn]interface{}{}
				}
				periodicPropertyData[offset][identifier] = periodicPropertyValues.Values[k]
			}
		}

		assetPropertyFrames := eventAssetPropertyFrames[events[i].UUID]
		for _, assetPropertyFrame := range assetPropertyFrames {
			timeField, found := assetPropertyFrame.FieldByName("time")
			if found == -1 {
				break
			}
			valueField, found := assetPropertyFrame.FieldByName("value")
			if found == -1 {
				break
			}

			identifier := eventFrameColumn{
				Name:      valueField.Name,
				EventUUID: events[i].UUID,
			}
			switch valueField.Type() {
			case data.FieldTypeNullableFloat64:
				identifier.Field = data.NewField(valueField.Config.DisplayNameFromDS, labels, []*float64{})
			case data.FieldTypeNullableString:
				identifier.Field = data.NewField(valueField.Config.DisplayNameFromDS, labels, []*string{})
			case data.FieldTypeNullableBool:
				identifier.Field = data.NewField(valueField.Config.DisplayNameFromDS, labels, []*bool{})
			}
			columns = append(columns, identifier)

			for k := 0; k < timeField.Len(); k++ {
				timestamp, ok := timeField.At(k).(time.Time)
				if !ok {
					continue
				}

				offset := timestamp.Sub(events[i].StartTime).Seconds()
				if _, ok := periodicPropertyData[offset]; !ok {
					periodicPropertyData[offset] = map[eventFrameColumn]interface{}{}
				}
				periodicPropertyData[offset][identifier] = valueField.CopyAt(k)
			}
		}
	}

	fields := []*data.Field{
		data.NewField("Offset", nil, []float64{}),
	}

	fields[0].Config = &data.FieldConfig{
		Unit: "s",
	}

	offsets := maps.Keys(periodicPropertyData)
	sort.Float64s(offsets)

	for _, offset := range offsets {
		fields[0].Append(offset)
	}

	for i := range columns {
		fields = append(fields, columns[i].Field)

		for _, offset := range offsets {
			addValueToField(columns[i].Field, periodicPropertyData[offset][columns[i]])
		}

	}

	return data.Frames{
		data.NewFrame("Result", fields...),
	}, nil
}

func dataFrameForEventType(assets []schemas.Asset, eventType schemas.EventType, events []schemas.Event, eventTypeProperties []schemas.EventTypeProperty) *data.Frame {
	UUIDToAssetMap := make(map[uuid.UUID]schemas.Asset)
	for _, asset := range assets {
		UUIDToAssetMap[asset.UUID] = asset
	}

	fieldByColumn := map[string]*data.Field{}
	fieldByColumn[StartTimeColumnName] = data.NewField(StartTimeColumnName, nil, []*time.Time{})
	fieldByColumn[StopTimeColumnName] = data.NewField(StopTimeColumnName, nil, []*time.Time{})
	fieldByColumn[EventUUIDColumnName] = data.NewField(EventUUIDColumnName, nil, []string{})
	fieldByColumn[AssetUUIDColumnName] = data.NewField(AssetUUIDColumnName, nil, []string{})
	fieldByColumn[AssetColumnName] = data.NewField(AssetColumnName, nil, []string{})
	fieldByColumn[AssetPathColumnName] = data.NewField(AssetPathColumnName, nil, []string{})
	fieldByColumn[DurationColumnName] = data.NewField(DurationColumnName, nil, []*float64{})
	fieldByColumn[EventTypeUUIDColumnName] = data.NewField(EventTypeUUIDColumnName, nil, []string{})
	fieldByColumn[EventTypeColumnName] = data.NewField(EventTypeColumnName, nil, []string{})

	fields := []*data.Field{
		fieldByColumn[EventUUIDColumnName],
		fieldByColumn[AssetUUIDColumnName],
		fieldByColumn[EventTypeUUIDColumnName],
		fieldByColumn[AssetColumnName],
		fieldByColumn[AssetPathColumnName],
		fieldByColumn[EventTypeColumnName],
		fieldByColumn[StartTimeColumnName],
		fieldByColumn[StopTimeColumnName],
		fieldByColumn[DurationColumnName],
	}

	for _, eventTypeProperty := range eventTypeProperties {
		if eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic {
			continue
		}

		var field *data.Field
		switch eventTypeProperty.Datatype {
		case schemas.EventTypePropertyDatatypeBool:
			field = data.NewField(eventTypeProperty.Name, nil, []*bool{})
		case schemas.EventTypePropertyDatatypeNumber:
			field = data.NewField(eventTypeProperty.Name, nil, []*float64{})
		case schemas.EventTypePropertyDatatypeString:
			field = data.NewField(eventTypeProperty.Name, nil, []*string{})
		default:
			field = data.NewField(eventTypeProperty.Name, nil, []interface{}{})
		}

		fields = append(fields, field)
		fieldByColumn[eventTypeProperty.Name] = field
	}

	for _, event := range events {
		fieldByColumn[EventUUIDColumnName].Append(event.UUID.String())
		fieldByColumn[AssetUUIDColumnName].Append(event.AssetUUID.String())
		fieldByColumn[EventTypeUUIDColumnName].Append(event.EventTypeUUID.String())
		fieldByColumn[AssetColumnName].Append(UUIDToAssetMap[event.AssetUUID].Name)
		fieldByColumn[AssetPathColumnName].Append(getAssetPath(UUIDToAssetMap, event.AssetUUID))
		fieldByColumn[EventTypeColumnName].Append(eventType.Name)
		fieldByColumn[StartTimeColumnName].Append(&event.StartTime)
		fieldByColumn[StopTimeColumnName].Append(event.StopTime)

		if event.StopTime != nil {
			duration := event.StopTime.Sub(event.StartTime).Seconds()
			fieldByColumn[DurationColumnName].Append(&duration)
		} else {
			fieldByColumn[DurationColumnName].Append(nil)
		}

		if event.Properties == nil {
			for _, eventPropertyType := range eventTypeProperties {
				if eventPropertyType.Type == schemas.EventTypePropertyTypePeriodic {
					continue
				}

				fieldByColumn[eventPropertyType.Name].Append(nil)
			}
			continue
		}

		for _, eventTypeProperty := range eventTypeProperties {
			if eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic {
				continue
			}

			setUOMFieldConfig(fieldByColumn[eventTypeProperty.Name], eventTypeProperty)
			addValueToField(fieldByColumn[eventTypeProperty.Name], event.Properties.Properties[eventTypeProperty.Name])
		}
	}

	return data.NewFrame(eventType.Name, fields...)
}

func setUOMFieldConfig(field *data.Field, eventTypeProperty schemas.EventTypeProperty) {
	uom := eventTypeProperty.UoM
	if uom == "" {
		return
	}

	field.Config = &data.FieldConfig{
		Unit: uom,
	}
}
