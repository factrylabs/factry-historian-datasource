package datasource

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
	"golang.org/x/exp/maps"
)

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
				if aFrame.Meta != nil && bFrame.Meta != nil {
					aFrame.Meta.ExecutedQueryString = fmt.Sprintf("%s; %s", aFrame.Meta.ExecutedQueryString, bFrame.Meta.ExecutedQueryString)
				}
				aFrame.AppendRow(bFrame.RowCopy(i)...)
			}
		}
	}

	return maps.Values(frameMap)
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
			labelPairs = append(labelPairs, fmt.Sprintf("Description: %s", description))
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
	if frame == nil {
		return ""
	}

	if frame.Meta == nil {
		return frame.Name
	}

	meta, ok := frame.Meta.Custom.(map[string]interface{})
	if !ok {
		return frame.Name
	}

	measurementName, ok := meta["MeasurementName"].(string)
	if !ok {
		return frame.Name
	}

	return measurementName + getFrameSuffix(frame, includeDatabaseName, includeDescription)
}

// getMeasurementUUIDFromFrame returns the measurement UUID for a given frame
func getMeasurementUUIDFromFrame(frame *data.Frame) string {
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

	measurementUUID, ok := meta["MeasurementUUID"].(string)
	if !ok {
		return ""
	}

	return measurementUUID
}

// getFrameID returns the frame ID for a given frame
func getFrameID(frame *data.Frame) string {
	measurementUUID := getMeasurementUUIDFromFrame(frame)
	return fmt.Sprintf("%s%s", measurementUUID, getFrameSuffix(frame, false, false))
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
func setMeasurementFrameNames(frames data.Frames, options schemas.MeasurementQueryOptions) data.Frames {
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
	return frames
}

// setMeasurementFrameNames sets the name of each frame to the measurement name
func setRawFrameNames(frames data.Frames) data.Frames {
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

			field.Config.DisplayNameFromDS = frame.Name + "." + field.Name + suffix
		}
	}
	return frames
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
func setAssetFrameNames(frames data.Frames, assets []schemas.Asset, assetProperties []schemas.AssetProperty, options schemas.MeasurementQueryOptions) data.Frames {
	UUIDToAssetMap := make(map[uuid.UUID]schemas.Asset)
	for _, asset := range assets {
		UUIDToAssetMap[asset.UUID] = asset
	}

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

			if field, _ := frame.FieldByName("value"); field != nil {
				if field.Config == nil {
					field.Config = &data.FieldConfig{}
				}

				field.Config.DisplayNameFromDS = getAssetPath(UUIDToAssetMap, property.AssetUUID) + "\\\\" + property.Name + getFrameSuffix(frame, options.DisplayDatabaseName, options.DisplayDescription)
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
				_, ok := valueField.ConcreteAt(i)
				if !ok {
					valueField.Set(i, initialValue)
				} else {
					break
				}
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

	if field.Config == nil {
		field.Config = &data.FieldConfig{
			Unit: "none",
		}

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

	if uom := config.GetString("UoM"); uom != "" {
		field.Config.Unit = uom
	}
	if min, err := config.GetFloat64("ValueMin"); err == nil {
		field.Config.SetMin(min)
	}
	if max, err := config.GetFloat64("ValueMax"); err == nil {
		field.Config.SetMax(max)
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

	if LimitLo, err := config.GetFloat64("LimitLo"); err == nil {
		threshold := data.Threshold{
			Value: data.ConfFloat64(LimitLo),
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
