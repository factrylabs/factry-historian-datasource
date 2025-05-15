package datasource

import (
	"fmt"
	"maps"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Constants for the event frames
const (
	StartTimeColumnName       = "StartTime"
	StopTimeColumnName        = "StopTime"
	AssetUUIDColumnName       = "AssetUUID"
	AssetColumnName           = "Asset"
	AssetPathColumnName       = "AssetPath"
	DurationColumnName        = "Duration"
	PropertyColumnName        = "Property"
	EventTypeColumnName       = "EventType"
	EventUUIDColumnName       = "EventUUID"
	ParentEventUUIDColumnName = "ParentEventUUID"
	EventTypeUUIDColumnName   = "EventTypeUUID"

	parentEventPrefix = "Parent_"
)

// EventQueryResultToDataFrame converts a event query result to data frames
func EventQueryResultToDataFrame(includeParentInfo bool, multipleAssetsSelected bool, assets []schemas.Asset, events []schemas.Event, eventTypes []schemas.EventType, eventTypeProperties []schemas.EventTypeProperty, selectedProperties map[string]struct{}, assetPropertyFieldTypes map[string]data.FieldType, eventAssetPropertyFrames map[uuid.UUID]data.Frames) (data.Frames, error) {
	dataFrames := data.Frames{}
	groupedEvents := map[uuid.UUID][]schemas.Event{}
	eventTypePropertiesForEventType := map[uuid.UUID][]schemas.EventTypeProperty{}
	eventTypesByUUID := map[uuid.UUID]schemas.EventType{}
	for _, eventType := range eventTypes {
		eventTypesByUUID[eventType.UUID] = eventType
		eventTypePropertiesForEventType[eventType.UUID] = []schemas.EventTypeProperty{}
		for _, eventTypeProperty := range eventTypeProperties {
			if eventTypeProperty.EventTypeUUID != eventType.UUID {
				continue
			}

			eventTypePropertiesForEventType[eventType.UUID] = append(eventTypePropertiesForEventType[eventType.UUID], eventTypeProperty)
		}
	}

	for i := range events {
		groupedEvents[events[i].EventTypeUUID] = append(groupedEvents[events[i].EventTypeUUID], events[i])
	}

	for eventTypeUUID, groupedEvents := range groupedEvents {
		dataFrames = append(dataFrames, dataFrameForEventType(includeParentInfo, multipleAssetsSelected, assets, eventTypesByUUID[eventTypeUUID], selectedProperties, eventTypesByUUID, groupedEvents, eventTypePropertiesForEventType, assetPropertyFieldTypes, eventAssetPropertyFrames))
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
func EventQueryResultToTrendDataFrame(includeParentInfo bool, assets []schemas.Asset, events []schemas.Event, eventTypes map[uuid.UUID]schemas.EventType, eventTypePropertiesForEventType map[uuid.UUID][]schemas.EventTypeProperty, selectedProperties map[string]struct{}, eventAssetPropertyFrames map[uuid.UUID]data.Frames, byDimension bool) (data.Frames, error) {
	uuidToAssetMap := make(map[uuid.UUID]schemas.Asset)
	for _, asset := range assets {
		uuidToAssetMap[asset.UUID] = asset
	}

	simpleEventTypeProperties := []schemas.EventTypeProperty{}
	periodicEventTypeProperties := []schemas.EventTypeProperty{}

	for _, eventType := range eventTypes {
		eventTypeProperties := eventTypePropertiesForEventType[eventType.UUID]
		for _, eventTypeProperty := range eventTypeProperties {
			if (!byDimension && eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic) || eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodicWithDimension {
				if _, ok := selectedProperties[eventTypeProperty.Name]; len(selectedProperties) == 0 || ok {
					periodicEventTypeProperties = append(periodicEventTypeProperties, eventTypeProperty)
				} else if _, ok := selectedProperties[eventTypeProperty.UUID.String()]; len(selectedProperties) == 0 || ok {
					periodicEventTypeProperties = append(periodicEventTypeProperties, eventTypeProperty)
				}
			}
			if eventTypeProperty.Type == schemas.EventTypePropertyTypeSimple {
				simpleEventTypeProperties = append(simpleEventTypeProperties, eventTypeProperty)
			}
		}
	}

	periodicPropertyData := map[float64]map[eventFrameColumn]interface{}{}
	columns := []eventFrameColumn{}

	for i := range events {
		eventLabels := data.Labels{}
		for j := range simpleEventTypeProperties {
			name := simpleEventTypeProperties[j].Name
			if events[i].Properties == nil {
				break
			}

			if value, ok := events[i].Properties.Properties[name]; ok {
				eventLabels[name] = fmt.Sprintf("%v", value)
			}
		}

		eventLabels[AssetPathColumnName] = getAssetPath(uuidToAssetMap, events[i].AssetUUID)
		eventLabels[AssetColumnName] = uuidToAssetMap[events[i].AssetUUID].Name
		eventLabels[EventTypeColumnName] = eventTypes[events[i].EventTypeUUID].Name
		eventLabels[StartTimeColumnName] = events[i].StartTime.Format(time.RFC3339)
		eventLabels[StopTimeColumnName] = ""
		eventLabels[EventUUIDColumnName] = events[i].UUID.String()
		eventLabels[EventTypeUUIDColumnName] = events[i].EventTypeUUID.String()
		eventLabels[AssetUUIDColumnName] = events[i].AssetUUID.String()
		if events[i].StopTime != nil {
			eventLabels[StopTimeColumnName] = events[i].StopTime.Format(time.RFC3339)
		}
		if events[i].ParentUUID != nil {
			eventLabels[ParentEventUUIDColumnName] = events[i].ParentUUID.String()
		}

		for j := range periodicEventTypeProperties {
			labels := data.Labels{}
			maps.Copy(labels, eventLabels)
			periodicPropertyValues := util.PeriodicPropertyValues{}
			if events[i].Properties == nil {
				continue
			}

			if err := events[i].Properties.Properties.Get(periodicEventTypeProperties[j].Name, &periodicPropertyValues); err != nil {
				continue
			}

			identifier := eventFrameColumn{
				Name:      periodicEventTypeProperties[j].UUID.String(),
				EventUUID: events[i].UUID,
			}

			labels[PropertyColumnName] = periodicEventTypeProperties[j].Name

			name := fmt.Sprintf("%s (%s)", periodicEventTypeProperties[j].Name, events[i].UUID)

			// Add parent event details as labels if `includeParentInfo` is true
			if includeParentInfo && events[i].Parent != nil {
				parentEvent := *events[i].Parent
				parentType := eventTypes[parentEvent.EventTypeUUID]
				parentPrefix := parentEventPrefix

				// Add parent event details
				labels[parentPrefix+EventUUIDColumnName] = parentEvent.UUID.String()
				labels[parentPrefix+StartTimeColumnName] = parentEvent.StartTime.Format(time.RFC3339)
				labels[parentPrefix+StopTimeColumnName] = ""
				if parentEvent.StopTime != nil {
					eventLabels[parentPrefix+StopTimeColumnName] = parentEvent.StopTime.Format(time.RFC3339)
				}
				labels[parentPrefix+AssetUUIDColumnName] = parentEvent.AssetUUID.String()
				labels[parentPrefix+AssetColumnName] = uuidToAssetMap[parentEvent.AssetUUID].Name
				labels[parentPrefix+AssetPathColumnName] = getAssetPath(uuidToAssetMap, parentEvent.AssetUUID)
				labels[parentPrefix+EventTypeUUIDColumnName] = parentEvent.EventTypeUUID.String()
				labels[parentPrefix+EventTypeColumnName] = parentType.Name

				// Add parent event properties
				for _, parentProperty := range eventTypePropertiesForEventType[parentEvent.EventTypeUUID] {
					if parentProperty.Type == schemas.EventTypePropertyTypePeriodic {
						continue
					}

					name := parentPrefix + parentProperty.Name
					if parentEvent.Properties == nil || parentEvent.Properties.Properties == nil {
						labels[name] = ""
						continue
					}

					if value, ok := parentEvent.Properties.Properties[parentProperty.Name]; ok {
						labels[name] = fmt.Sprintf("%v", value)
					} else {
						labels[name] = ""
					}
				}
			}

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

			for offset, value := range periodicPropertyValues.ValuesByOffset {
				if byDimension {
					if dimensionValue, ok := periodicPropertyValues.DimensionValuesByOffset[offset].(float64); ok {
						offset = dimensionValue
					}
				}

				if _, ok := periodicPropertyData[offset]; !ok {
					periodicPropertyData[offset] = map[eventFrameColumn]interface{}{}
				}
				periodicPropertyData[offset][identifier] = value
			}
		}

		assetPropertyFrames := eventAssetPropertyFrames[events[i].UUID]
		for _, assetPropertyFrame := range assetPropertyFrames {
			labels := data.Labels{}
			maps.Copy(labels, eventLabels)

			timeField, found := assetPropertyFrame.FieldByName("time")
			if found == -1 {
				break
			}
			valueField, found := assetPropertyFrame.FieldByName("value")
			if found == -1 {
				break
			}

			propertyName := getMetaValueFromFrame(assetPropertyFrame, "AssetProperty")
			labels[PropertyColumnName] = propertyName
			name := fmt.Sprintf("%s (%s)", propertyName, events[i].UUID)
			valueField.Name = name

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
			identifier.Field.Config = &data.FieldConfig{
				Unit: valueField.Config.Unit,
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

	if !byDimension {
		fields[0].Config = &data.FieldConfig{
			Unit: "dtdhms",
		}
	}

	offsets := slices.Sorted(maps.Keys(periodicPropertyData))

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

func buildSimpleFieldsForEvent(prefix string, eventTypeProperties []schemas.EventTypeProperty, selectedProperties map[string]struct{}) []*data.Field {
	fields := []*data.Field{
		data.NewField(prefix+EventUUIDColumnName, nil, []*string{}),
		data.NewField(prefix+ParentEventUUIDColumnName, nil, []string{}),
		data.NewField(prefix+AssetUUIDColumnName, nil, []*string{}),
		data.NewField(prefix+EventTypeUUIDColumnName, nil, []*string{}),
		data.NewField(prefix+AssetColumnName, nil, []*string{}),
		data.NewField(prefix+AssetPathColumnName, nil, []*string{}),
		data.NewField(prefix+EventTypeColumnName, nil, []*string{}),
		data.NewField(prefix+StartTimeColumnName, nil, []*time.Time{}),
		data.NewField(prefix+StopTimeColumnName, nil, []*time.Time{}),
		data.NewField(prefix+DurationColumnName, nil, []*float64{}).SetConfig(&data.FieldConfig{
			Unit: "dtdhms",
		}),
	}

	for _, parentEventTypeProperty := range eventTypeProperties {
		if parentEventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic {
			continue
		}

		if len(selectedProperties) > 0 {
			if _, ok := selectedProperties[parentEventTypeProperty.Name]; !ok {
				if _, ok := selectedProperties[parentEventTypeProperty.UUID.String()]; !ok {
					continue
				}
			}
		}

		parentPropertyFieldName := prefix + parentEventTypeProperty.Name
		var parentField *data.Field
		switch parentEventTypeProperty.Datatype {
		case schemas.EventTypePropertyDatatypeBool:
			parentField = data.NewField(parentPropertyFieldName, nil, []*bool{})
		case schemas.EventTypePropertyDatatypeNumber:
			parentField = data.NewField(parentPropertyFieldName, nil, []*float64{})
		case schemas.EventTypePropertyDatatypeString:
			parentField = data.NewField(parentPropertyFieldName, nil, []*string{})
		default:
			parentField = data.NewField(parentPropertyFieldName, nil, []interface{}{})
		}
		fields = append(fields, parentField)
	}
	return fields
}

func fillFields(prefix string, fieldByColumn map[string]*data.Field, event *schemas.Event, uuidToAssetMap map[uuid.UUID]schemas.Asset, eventType schemas.EventType, eventTypeProperties []schemas.EventTypeProperty) {
	parentUUID := ""
	if event.ParentUUID != nil {
		parentUUID = event.ParentUUID.String()
	}
	addValueToField(fieldByColumn[prefix+EventUUIDColumnName], event.UUID.String())
	addValueToField(fieldByColumn[prefix+ParentEventUUIDColumnName], parentUUID)
	addValueToField(fieldByColumn[prefix+AssetUUIDColumnName], event.AssetUUID.String())
	addValueToField(fieldByColumn[prefix+EventTypeUUIDColumnName], event.EventTypeUUID.String())
	addValueToField(fieldByColumn[prefix+AssetColumnName], uuidToAssetMap[event.AssetUUID].Name)
	addValueToField(fieldByColumn[prefix+AssetPathColumnName], getAssetPath(uuidToAssetMap, event.AssetUUID))
	addValueToField(fieldByColumn[prefix+EventTypeColumnName], eventType.Name)
	addValueToField(fieldByColumn[prefix+StartTimeColumnName], &event.StartTime)
	addValueToField(fieldByColumn[prefix+StopTimeColumnName], event.StopTime)

	if event.StopTime != nil {
		duration := event.StopTime.Sub(event.StartTime).Seconds()
		fieldByColumn[prefix+DurationColumnName].Append(&duration)
	} else {
		fieldByColumn[prefix+DurationColumnName].Append(nil)
	}

	if event.Properties == nil {
		for _, eventPropertyType := range eventTypeProperties {
			if eventPropertyType.Type == schemas.EventTypePropertyTypePeriodic {
				continue
			}

			fieldByColumn[prefix+eventPropertyType.Name].Append(nil)
		}
		return
	}

	for _, eventTypeProperty := range eventTypeProperties {
		if eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic {
			continue
		}

		if _, ok := fieldByColumn[prefix+eventTypeProperty.Name]; !ok {
			continue
		}

		setUOMFieldConfig(fieldByColumn[prefix+eventTypeProperty.Name], eventTypeProperty)
		addValueToField(fieldByColumn[prefix+eventTypeProperty.Name], event.Properties.Properties[eventTypeProperty.Name])
	}
}

func dataFrameForEventType(includeParentInfo bool, multipleAssetsSelected bool, assets []schemas.Asset, eventType schemas.EventType, selectedProperties map[string]struct{}, eventTypes map[uuid.UUID]schemas.EventType, events []schemas.Event, eventTypePropertiesForEventType map[uuid.UUID][]schemas.EventTypeProperty, assetPropertyFieldTypes map[string]data.FieldType, eventAssetPropertyFrames map[uuid.UUID]data.Frames) *data.Frame {
	uuidToAssetMap := make(map[uuid.UUID]schemas.Asset)
	for _, asset := range assets {
		uuidToAssetMap[asset.UUID] = asset
	}

	eventTypeProperties := eventTypePropertiesForEventType[eventType.UUID]
	fields := buildSimpleFieldsForEvent("", eventTypeProperties, selectedProperties)

	fieldByColumn := map[string]*data.Field{}
	for _, field := range fields {
		fieldByColumn[field.Name] = field
	}

	for assetProperty := range assetPropertyFieldTypes {
		switch assetPropertyFieldTypes[assetProperty] {
		case data.FieldTypeNullableFloat64:
			fieldByColumn[assetProperty] = data.NewField(assetProperty, nil, []*float64{})
		case data.FieldTypeNullableBool:
			fieldByColumn[assetProperty] = data.NewField(assetProperty, nil, []*bool{})
		case data.FieldTypeNullableString:
			fieldByColumn[assetProperty] = data.NewField(assetProperty, nil, []*string{})
		}
		fields = append(fields, fieldByColumn[assetProperty])
	}

	for _, eventTypeProperty := range eventTypeProperties {
		if eventTypeProperty.Type == schemas.EventTypePropertyTypePeriodic {
			continue
		}

		if _, ok := fieldByColumn[eventTypeProperty.Name]; ok {
			continue
		}

		if len(selectedProperties) > 0 {
			if _, ok := selectedProperties[eventTypeProperty.Name]; !ok {
				if _, ok := selectedProperties[eventTypeProperty.UUID.String()]; !ok {
					continue
				}
			}
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

	parentFields := []*data.Field{}
	parentFieldsAdded := make(map[string]bool) // Track added fields for parent event types

	for i := range events {
		if events[i].ParentUUID != nil {
			if includeParentInfo {
				parentEvent := *events[i].Parent
				_, parentEventTypeExists := eventTypes[parentEvent.EventTypeUUID]
				if !parentEventTypeExists {
					continue
				}

				parentPrefix := parentEventPrefix
				if !parentFieldsAdded[parentPrefix] {
					parentFieldsAdded[parentPrefix] = true

					parentFieldsForEventType := buildSimpleFieldsForEvent(parentPrefix, eventTypePropertiesForEventType[parentEvent.EventTypeUUID], selectedProperties)
					for _, parentField := range parentFieldsForEventType {
						fieldByColumn[parentField.Name] = parentField
						parentFields = append(parentFields, parentField)
					}
				}
			}
		}

		fillFields("", fieldByColumn, &events[i], uuidToAssetMap, eventType, eventTypeProperties)
		assetPropertyFrames := eventAssetPropertyFrames[events[i].UUID]
		for assetProperty := range assetPropertyFieldTypes {
			found := false
			field := fieldByColumn[assetProperty]
			for _, assetPropertyFrame := range assetPropertyFrames {
				// custom := assetPropertyFrame.Meta.Custom.(map[string]interface{})
				// assetPath := custom["AssetPath"].(string)
				// name := custom["AssetProperty"].(string)
				// fullName := fmt.Sprintf("%s.%s", assetPath, name)
				name, ok := getAssetPropertyFieldName(assetPropertyFrame, multipleAssetsSelected)
				if !ok {
					continue
				}

				if assetProperty != name {
					continue
				}

				valueField, exists := assetPropertyFrame.FieldByName("value")
				if exists == -1 {
					break
				}

				found = true
				wantedType := field.Type()
				actualType := valueField.Type()
				value := valueField.At(0)

				if wantedType == actualType {
					field.Append(value)
				} else {
					stringValue := ""

					switch actualType {
					case data.FieldTypeNullableFloat64:
						stringValue = fmt.Sprintf("%v", *value.(*float64))
					case data.FieldTypeNullableBool:
						stringValue = strconv.FormatBool(*value.(*bool))
					case data.FieldTypeNullableString:
						stringValue = *value.(*string)
					}
					field.Append(&stringValue)
				}
			}
			if !found {
				field.Append(nil)
			}
		}
	}

	if includeParentInfo {
		// Populate parent data or append nil for rows without a parent
		for i := range events {
			if events[i].Parent != nil {
				if _, ok := eventTypes[events[i].Parent.EventTypeUUID]; ok {
					parentEvent := *events[i].Parent
					parentEventType := eventTypes[parentEvent.EventTypeUUID]
					parentPrefix := parentEventPrefix

					fillFields(parentPrefix, fieldByColumn, &parentEvent, uuidToAssetMap, parentEventType, eventTypePropertiesForEventType[parentEvent.EventTypeUUID])

					// Append nil for other parent-related fields if there are multiple parent event types
					for otherParentPrefix := range parentFieldsAdded {
						if otherParentPrefix == parentPrefix {
							continue
						}

						for _, field := range fieldByColumn {
							// skip if field is not a parent-related field
							if !strings.HasPrefix(field.Name, otherParentPrefix) {
								continue
							}

							addValueToField(field, nil)
						}
					}
				}
				continue
			}

			// Append nil for all parent-related fields if no parent exists
			for parentPrefix := range parentFieldsAdded {
				for _, parentField := range fieldByColumn {
					if !strings.HasPrefix(parentField.Name, parentPrefix) {
						continue
					}

					addValueToField(parentField, nil)
				}
			}
		}

		fields = append(parentFields, fields...)
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
