package datasource

import (
	"fmt"
	"maps"
	"math"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// fieldLabelsFromMeta are the field labels that are extracted from the metadata
var fieldLabelsFromMeta = []string{"MeasurementUUID", "MeasurementName", "DatabaseUUID", "DatabaseName", "AssetProperty", "AssetPropertyUUID", "AssetUUID", "AssetPath", "AssetName", "Description"}

// getLabelsFromFrame returns the tag from a frame
func getLabelsFromFrame(frame *data.Frame) map[string]interface{} {
	if frame == nil || frame.Meta == nil {
		return nil
	}

	meta, ok := frame.Meta.Custom.(map[string]interface{})
	if !ok {
		return nil
	}

	labels, ok := meta["Labels"].(map[string]interface{})
	if !ok {
		return nil
	}

	return labels
}

// mergeFrames merges 2 set of frames based on the metadata and name of each frame
func mergeFrames(lastKnown data.Frames, result data.Frames) data.Frames {
	if len(lastKnown) == 0 {
		return result
	}

	if len(result) == 0 {
		return lastKnown
	}

	frameMap := make(map[string]*data.Frame)
	for _, aFrame := range lastKnown {
		frameMap[getFrameID(aFrame)] = aFrame
	}

frameLoop:
	for _, bFrame := range result {
		bFrameID := getFrameID(bFrame)
		aFrame, ok := frameMap[bFrameID]
		if !ok {
			frameMap[bFrameID] = bFrame
		} else {
			if len(aFrame.Fields) != len(bFrame.Fields) {
				continue
			}

			for i := 0; i < len(aFrame.Fields); i++ {
				if aFrame.Fields[i].Type() != bFrame.Fields[i].Type() {
					continue frameLoop
				}
			}

			for i := 0; i < bFrame.Rows(); i++ {
				aFrame.AppendRow(bFrame.RowCopy(i)...)
			}

			if aFrame.Meta != nil && bFrame.Meta != nil {
				aFrame.Meta.ExecutedQueryString = fmt.Sprintf("%s; %s", aFrame.Meta.ExecutedQueryString, bFrame.Meta.ExecutedQueryString)
			}
		}
	}

	return slices.Collect(maps.Values(frameMap))
}

// getFrameSuffix returns the frame name for a given frame
func getFrameSuffix(frame *data.Frame, includeDatabaseName, includeDescription bool) string {
	if frame == nil || frame.Meta == nil {
		return ""
	}

	meta, ok := frame.Meta.Custom.(map[string]interface{})
	if !ok {
		return ""
	}

	labels, ok := meta["Labels"].(map[string]interface{})
	if !ok {
		return ""
	}

	labelPairs := []string{}
	for key, value := range labels {
		labelPairs = append(labelPairs, fmt.Sprintf("%s: %s", key, value))
	}

	if includeDescription && meta["Description"] != nil {
		if description, ok := meta["Description"].(string); ok && description != "" {
			labelPairs = append(labelPairs, "Description: "+description)
		}
	}

	if includeDatabaseName && meta["DatabaseName"] != nil {
		labelPairs = append(labelPairs, fmt.Sprintf("Database: %s", meta["DatabaseName"]))
	}

	if len(labelPairs) == 0 {
		return ""
	}

	return fmt.Sprintf(" {%s}", strings.Join(labelPairs, ", "))
}

// getMeasurementFrameName returns the frame name for a given frame based on the measurement
func getMeasurementFrameName(frame *data.Frame, includeDatabaseName, includeDescription bool) string {
	return getMetaValueFromFrame(frame, "MeasurementName") + getFrameSuffix(frame, includeDatabaseName, includeDescription)
}

// setFieldLabels sets the labels for a given field
func setFieldLabels(frames data.Frames) {
	for _, frame := range frames {
		if frame == nil {
			continue
		}

		if frame.Meta == nil {
			continue
		}

		meta, ok := frame.Meta.Custom.(map[string]interface{})
		if !ok {
			continue
		}

		metaLabels, ok := meta["Labels"].(map[string]interface{})
		if !ok {
			metaLabels = make(map[string]interface{})
		}

		labels := data.Labels{}
		for key, value := range metaLabels {
			labels[key] = fmt.Sprintf("%v", value)
		}

		for _, key := range fieldLabelsFromMeta {
			if value, ok := meta[key].(string); ok {
				labels[key] = value
			}
		}

		for _, field := range frame.Fields {
			if field.Name == "time" {
				continue
			}

			if field.Labels == nil {
				field.Labels = make(map[string]string)
			}

			maps.Copy(field.Labels, labels)
		}
	}
}

// getMetaValueFromFrame returns the value of a given meta key from a frame
func getMetaValueFromFrame(frame *data.Frame, key string) string {
	if frame == nil {
		return ""
	}

	if frame.Meta == nil {
		return ""
	}

	meta, ok := frame.Meta.Custom.(map[string]interface{})
	if !ok {
		return ""
	}

	value, ok := meta[key].(string)
	if !ok {
		return ""
	}

	return value
}

// getMeasurementUUIDFromFrame returns the measurement UUID for a given frame
func getMeasurementUUIDFromFrame(frame *data.Frame) string {
	return getMetaValueFromFrame(frame, "MeasurementUUID")
}

// getFrameID returns the frame ID for a given frame
func getFrameID(frame *data.Frame) string {
	measurementUUID := getMeasurementUUIDFromFrame(frame)
	return fmt.Sprintf("%s%s", measurementUUID, getFrameSuffix(frame, false, false))
}

// getAssetName returns the asset name for a given asset
func getAssetName(uuidToAssetMap map[uuid.UUID]schemas.Asset, assetUUID uuid.UUID) string {
	asset, ok := uuidToAssetMap[assetUUID]
	if !ok {
		return ""
	}

	return asset.Name
}

// getAssetPath returns the asset path for a given asset
func getAssetPath(uuidToAssetMap map[uuid.UUID]schemas.Asset, assetUUID uuid.UUID) string {
	asset, ok := uuidToAssetMap[assetUUID]
	if !ok {
		return ""
	}

	return asset.AssetPath
}

// setMeasurementFrameNames sets the name of each frame to the measurement name
func setMeasurementFrameNames(frames data.Frames, options schemas.MeasurementQueryOptions) {
	for _, frame := range frames {
		if frame.Meta == nil {
			continue
		}

		if field, _ := frame.FieldByName("value"); field != nil {
			if field.Config == nil {
				field.Config = &data.FieldConfig{}
			}
			field.Config.DisplayNameFromDS = getMeasurementFrameName(frame, options.DisplayDatabaseName, options.DisplayDescription)
		}
	}
}

// setMeasurementFrameNames sets the name of each frame to the measurement name
func setRawFrameNames(frames data.Frames) {
	for _, frame := range frames {
		for _, field := range frame.Fields {
			if field.Name == "time" {
				continue
			}

			if field.Config == nil {
				field.Config = &data.FieldConfig{}
			}

			labelPairs := []string{}
			for key, value := range field.Labels {
				labelPairs = append(labelPairs, fmt.Sprintf("%s: %s", key, value))
			}

			suffix := ""
			if len(labelPairs) > 0 {
				suffix = fmt.Sprintf(" {%s}", strings.Join(labelPairs, ", "))
			}

			displayName := field.Name + suffix
			if frame.Name != "" {
				displayName = frame.Name + displayName
			}
			field.Config.DisplayNameFromDS = displayName
		}
	}
}

func copyFrame(frame *data.Frame) (*data.Frame, error) {
	bytes, err := frame.MarshalArrow()
	if err != nil {
		return nil, err
	}

	frameCopy, err := data.UnmarshalArrowFrame(bytes)
	if err != nil {
		return nil, err
	}

	return frameCopy, nil
}

// setAssetFrameNames sets the name of each frame to the asset path
func setAssetFrameNames(frames data.Frames, assets map[uuid.UUID]schemas.Asset, assetProperties []schemas.AssetProperty, options schemas.MeasurementQueryOptions) data.Frames {
	measurementUUIDToPropertyMap := make(map[uuid.UUID][]schemas.AssetProperty)
	for _, property := range assetProperties {
		measurementUUIDToPropertyMap[property.MeasurementUUID] = append(measurementUUIDToPropertyMap[property.MeasurementUUID], property)
	}

	additionalFrames := make([]*data.Frame, 0)

	for _, frame := range frames {
		if frame.Meta == nil {
			continue
		}

		measurementUUIDString := getMeasurementUUIDFromFrame(frame)
		measurementUUID, err := uuid.Parse(measurementUUIDString)
		if err != nil {
			continue
		}
		properties := measurementUUIDToPropertyMap[measurementUUID]

		for i, property := range properties {
			if i > 0 {
				frameCopy, err := copyFrame(frame)
				if err != nil {
					continue
				}

				frame = frameCopy
				additionalFrames = append(additionalFrames, frame)
			}

			assetPath := getAssetPath(assets, property.AssetUUID)
			asstName := getAssetName(assets, property.AssetUUID)
			custom := frame.Meta.Custom.(map[string]interface{})
			custom["AssetProperty"] = property.Name
			custom["AssetPropertyUUID"] = property.UUID
			custom["AssetUUID"] = property.AssetUUID
			custom["AssetPath"] = assetPath
			custom["AssetName"] = asstName
			if field, _ := frame.FieldByName("value"); field != nil {
				if field.Config == nil {
					field.Config = &data.FieldConfig{}
				}

				field.Config.DisplayNameFromDS = assetPath + "\\\\" + property.Name + getFrameSuffix(frame, options.DisplayDatabaseName, options.DisplayDescription)
			}
		}
	}

	return append(frames, additionalFrames...)
}

func fillInitialEmptyIntervals(frames data.Frames, query schemas.Query) data.Frames {
	for _, frame := range frames {
		valueField, _ := frame.FieldByName("value")
		if valueField == nil {
			continue
		}

		// Concrete at returns ok = false when the value is nil for pointer types
		if _, ok := valueField.ConcreteAt(0); !ok {
			continue
		}

		initialValue := valueField.At(0)
		if valueField.Len() > 1 {
			for i := 1; i < valueField.Len(); i++ {
				if _, ok := valueField.ConcreteAt(i); ok {
					break
				}
				valueField.Set(i, initialValue)
			}
		} else {
			timeField, _ := frame.FieldByName("time")
			if timeField == nil {
				continue
			}
			if query.End == nil {
				return frames
			}
			duration, err := time.ParseDuration(query.Aggregation.Period)
			if err != nil {
				return frames
			}
			for time := query.Start; time.Before(*query.End); time = time.Add(duration) {
				valueField.Append(initialValue)
				timestamp := time
				timeField.Append(timestamp)
			}
		}
	}

	return frames
}

func deleteFirstRow(frames data.Frames) data.Frames {
	for _, frame := range frames {
		frame.DeleteRow(0)
	}
	return frames
}

// addMetaData adds metadata from measurements to data frames
func addMetaData(frames data.Frames, useEngineeringSpecs bool) data.Frames {
	for _, frame := range frames {
		setFieldConfig(frame, useEngineeringSpecs)
	}
	return frames
}

func setFieldConfig(frame *data.Frame, useEngineeringSpecs bool) {
	field, _ := frame.FieldByName("value")
	if field == nil {
		return
	}

	if frame.Meta == nil || frame.Meta.Custom == nil {
		return
	}

	meta, ok := frame.Meta.Custom.(map[string]interface{})
	if !ok {
		return
	}

	custom := schemas.Attributes(meta)
	attributes, err := custom.GetAttributes("Attributes")
	if err != nil {
		return
	}

	config, err := attributes.GetAttributes("Config")
	if err != nil || !useEngineeringSpecs {
		return
	}

	if field.Config == nil {
		field.Config = &data.FieldConfig{
			Unit: "none",
		}
	}

	if uom := config.GetString("UoM"); uom != "" {
		field.Config.Unit = uom
	}
	if valueMin, err := config.GetFloat64("ValueMin"); err == nil {
		field.Config.SetMin(valueMin)
	}
	if valueMax, err := config.GetFloat64("ValueMax"); err == nil {
		field.Config.SetMax(valueMax)
	}

	thresholdConfig := &data.ThresholdsConfig{
		Mode: data.ThresholdsModeAbsolute,
		Steps: []data.Threshold{
			{
				Value: data.ConfFloat64(math.NaN()),
				Color: "red",
			},
		},
	}

	if limitLo, err := config.GetFloat64("LimitLo"); err == nil {
		threshold := data.Threshold{
			Value: data.ConfFloat64(limitLo),
			Color: "green",
		}
		thresholdConfig.Steps = append(thresholdConfig.Steps, threshold)
	}
	if limitHi, err := config.GetFloat64("LimitHi"); err == nil {
		threshold := data.Threshold{
			Value: data.ConfFloat64(limitHi),
			Color: "red",
		}
		thresholdConfig.Steps = append(thresholdConfig.Steps, threshold)
	}
	if len(thresholdConfig.Steps) > 1 {
		field.Config.Thresholds = thresholdConfig
	}
}

func sortByStatus(frames data.Frames) data.Frames {
	sort.Slice(frames, func(i, _ int) bool {
		custom, ok := frames[i].Meta.Custom.(map[string]interface{})
		if !ok {
			return false
		}

		labels, ok := custom["Labels"].(map[string]interface{})
		if !ok {
			return false
		}

		status, ok := labels["status"]
		if !ok {
			return false
		}

		return status == "Good"
	})
	return frames
}

// add value to field
func addValueToField(field *data.Field, value interface{}) {
	if value == nil && field.Nullable() {
		field.Append(nil)
		return
	}

	switch field.Type() {
	case data.FieldTypeNullableBool:
		switch v := value.(type) {
		case bool:
			field.Append(&v)
		case *bool:
			field.Append(v)
		default:
			field.Append(nil)
		}
		return
	case data.FieldTypeNullableFloat64:
		switch v := value.(type) {
		case float64:
			field.Append(&v)
		case *float64:
			field.Append(v)
		default:
			field.Append(nil)
		}
		return
	case data.FieldTypeNullableString:
		switch v := value.(type) {
		case string:
			field.Append(&v)
		case *string:
			field.Append(v)
		default:
			field.Append(nil)
		}
		return
	case data.FieldTypeNullableTime:
		switch v := value.(type) {
		case time.Time:
			field.Append(&v)
		case *time.Time:
			field.Append(v)
		default:
			field.Append(nil)
		}
		return
	}

	if value == nil && !field.Nullable() {
		switch field.Type() {
		case data.FieldTypeBool:
			field.Append(false)
		case data.FieldTypeFloat64:
			field.Append(0.0)
		case data.FieldTypeString:
			field.Append("")
		case data.FieldTypeTime:
			field.Append(time.Time{})
		}
		return
	}

	switch field.Type() {
	case data.FieldTypeBool:
		switch v := value.(type) {
		case bool:
			field.Append(v)
		case *bool:
			field.Append(*v)
		}
		return
	case data.FieldTypeFloat64:
		switch v := value.(type) {
		case float64:
			field.Append(v)
		case *float64:
			field.Append(*v)
		}
		return
	case data.FieldTypeString:
		switch v := value.(type) {
		case string:
			field.Append(v)
		case *string:
			field.Append(*v)
		}
		return
	case data.FieldTypeTime:
		switch v := value.(type) {
		case time.Time:
			field.Append(v)
		case *time.Time:
			field.Append(*v)
		}
		return
	}
}
