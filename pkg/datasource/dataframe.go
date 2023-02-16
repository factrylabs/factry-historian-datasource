package datasource

import (
	"fmt"
	"math"
	"strings"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
	"golang.org/x/exp/maps"
)

// MergeFrames merges 2 set of frames based on the metadata and name of each frame
func MergeFrames(lastKnown data.Frames, result data.Frames) data.Frames {
	if len(lastKnown) == 0 {
		return result
	}

	if len(result) == 0 {
		return lastKnown
	}

	frameMap := make(map[string]*data.Frame)
	for _, aFrame := range lastKnown {
		frameMap[GetFrameID(aFrame)] = aFrame
	}

frameLoop:
	for _, bFrame := range result {
		bFrameID := GetFrameID(bFrame)
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

// GetFrameSuffix returns the frame suffix for a given frame
func GetFrameSuffix(frame *data.Frame) string {
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
		labelPairs = append(labelPairs, fmt.Sprintf("%s=%s", key, value))
	}

	if len(labelPairs) == 0 {
		return ""
	}

	return fmt.Sprintf(" {%s}", strings.Join(labelPairs, ", "))
}

// GetMeasurementFrameName returns the frame name for a given frame based on the measurement
func GetMeasurementFrameName(frame *data.Frame) string {
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

	return measurementName + GetFrameSuffix(frame)
}

// GetFrameID returns the frame ID for a given frame
func GetFrameID(frame *data.Frame) string {
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

	measurementUUID, ok := meta["MeasurementUUID"].(string)
	if !ok {
		return frame.Name
	}

	labels, ok := meta["Labels"].(map[string]interface{})
	if !ok {
		return measurementUUID
	}

	labelString := ""
	for key, value := range labels {
		labelString += fmt.Sprintf("%s=%s", key, value)
	}

	return fmt.Sprintf("%s%s", measurementUUID, GetFrameSuffix(frame))
}

// GetAssetPath returns the asset path for a given asset
func GetAssetPath(uuidToAssetMap map[uuid.UUID]schemas.Asset, assetUUID uuid.UUID) string {
	asset, ok := uuidToAssetMap[assetUUID]
	if !ok {
		return ""
	}

	parentUUID := asset.ParentUUID
	if parentUUID == nil {
		return asset.Name
	}

	return GetAssetPath(uuidToAssetMap, *parentUUID) + "\\\\" + asset.Name
}

// SetFrameNamesByAsset sets the name of each frame to the asset path
func SetFrameNamesByAsset(assets []schemas.Asset, assetProperties []schemas.AssetProperty, frames data.Frames) data.Frames {
	measurementUUIDToPropertyMap := make(map[uuid.UUID]schemas.AssetProperty)
	for _, property := range assetProperties {
		measurementUUIDToPropertyMap[property.MeasurementUUID] = property
	}

	UUIDToAssetMap := make(map[uuid.UUID]schemas.Asset)
	for _, asset := range assets {
		UUIDToAssetMap[asset.UUID] = asset
	}

	for _, frame := range frames {
		if frame.Meta == nil {
			continue
		}

		if field, _ := frame.FieldByName("value"); field != nil {
			if field.Config == nil {
				field.Config = &data.FieldConfig{}
			}
			custom, ok := frame.Meta.Custom.(map[string]interface{})
			if ok {
				measurementUUIDString, ok := custom["MeasurementUUID"].(string)
				if !ok {
					continue
				}

				measurementUUID, err := uuid.Parse(measurementUUIDString)
				if err != nil {
					continue
				}

				property, ok := measurementUUIDToPropertyMap[measurementUUID]
				if ok {
					field.Config.DisplayNameFromDS = GetAssetPath(UUIDToAssetMap, property.AssetUUID) + "\\\\" + property.Name + GetFrameSuffix(frame)
				}
			}
		}
	}

	return frames
}

// AddMetaData adds metadata from measurements to data frames
func AddMetaData(frames data.Frames, useEngineeringSpecs bool) data.Frames {
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
	fieldConfig := &data.FieldConfig{
		Unit:              "none",
		DisplayNameFromDS: GetMeasurementFrameName(frame),
	}
	field.Config = fieldConfig

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
		fieldConfig.Unit = uom
	}
	if min, err := config.GetFloat64("ValueMin"); err == nil {
		fieldConfig.SetMin(min)
	}
	if max, err := config.GetFloat64("ValueMax"); err == nil {
		fieldConfig.SetMax(max)
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
		fieldConfig.Thresholds = thresholdConfig
	}
}
