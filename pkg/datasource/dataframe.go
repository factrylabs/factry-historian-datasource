package datasource

import (
	"fmt"
	"math"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
	"golang.org/x/exp/maps"
)

// MergeFrames merges 2 set of frames based on the metadata and name of each frame
func MergeFrames(a data.Frames, b data.Frames) data.Frames {
	if len(a) == 0 {
		return b
	}

	if len(b) == 0 {
		return a
	}

	frameMap := make(map[string]*data.Frame)
	for _, aFrame := range a {
		frameMap[aFrame.Name] = aFrame
	}

frameLoop:
	for _, bFrame := range b {
		aFrame, ok := frameMap[bFrame.Name]
		if !ok {
			frameMap[bFrame.Name] = bFrame
		} else {
			if len(aFrame.Fields) != len(bFrame.Fields) {
				continue
			}

			for i := 0; i < len(aFrame.Fields); i++ {
				if aFrame.Fields[0].Type() != bFrame.Fields[i].Type() {
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

// AddMetaData adds metadata from measurements to data frames
func AddMetaData(measurements []schemas.Measurement, useEngineeringSpecs bool, frames data.Frames) data.Frames {
	for _, frame := range frames {
		seriesMeasurement := schemas.Measurement{}
		for _, measurement := range measurements {
			if measurement.Name == frame.Name {
				seriesMeasurement = measurement
				break
			}
		}

		for _, field := range frame.Fields {
			if field.Name == "value" {
				field.Config = getFieldConfig(frame.Name, seriesMeasurement, useEngineeringSpecs)
			}
		}
	}

	return frames
}

func getFieldConfig(frameName string, measurement schemas.Measurement, useEngineeringSpecs bool) *data.FieldConfig {
	fieldConfig := &data.FieldConfig{
		Unit:              "none",
		Description:       measurement.Description,
		DisplayNameFromDS: frameName,
	}
	config, err := measurement.Attributes.GetAttributes("Config")
	if err != nil || !useEngineeringSpecs {
		return fieldConfig
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

	return fieldConfig
}
