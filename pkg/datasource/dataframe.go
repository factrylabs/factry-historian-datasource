package datasource

import (
	"encoding/json"
	"math"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

// QueryResultToDataFrame converts a query result to data frames
func QueryResultToDataFrame(measurements []schemas.Measurement, useEngineeringSpecs bool, queryResult *schemas.QueryResult) (data.Frames, error) {
	dataFrames := data.Frames{}

	for _, series := range queryResult.Series {
		seriesMeasurement := schemas.Measurement{}
		for _, measurement := range measurements {
			if measurement.Name == series.Measurement {
				seriesMeasurement = measurement
				break
			}
		}
		frame := data.NewFrame(series.Measurement, seriesToFields(series, seriesMeasurement, useEngineeringSpecs)...)
		dataFrames = append(dataFrames, frame)
	}

	return dataFrames, nil
}

func seriesToFields(series *schemas.Series, measurement schemas.Measurement, useEngineeringSpecs bool) []*data.Field {
	fields := []*data.Field{}
	labels := data.Labels{}
	for k, v := range series.Tags {
		if stringValue, ok := v.(string); ok {
			labels[k] = stringValue
		}
	}

	if len(series.Fields) > 0 {
		timestamps := []time.Time{}
		values := [][]interface{}{}

		for range series.Fields {
			values = append(values, []interface{}{})
		}

		for _, dataPoint := range series.DataPoints {
			timestamps = append(timestamps, time.UnixMilli(dataPoint.Timestamp))
			if dataValues, ok := dataPoint.Value.([]interface{}); ok {
				for i, value := range dataValues {
					if i < len(values) {
						values[i] = append(values[i], value)
					}
				}
			}
		}

		fields = append(fields, data.NewField("time", data.Labels{}, timestamps))
		for i, fieldName := range series.Fields {
			fields = append(fields, valueField(fieldName, values[i], labels))
		}
	} else {
		timestamps := []time.Time{}
		values := []interface{}{}
		for _, dataPoint := range series.DataPoints {
			timestamps = append(timestamps, time.UnixMilli(dataPoint.Timestamp))
			values = append(values, dataPoint.Value)
		}
		fields = append(fields, data.NewField("time", data.Labels{}, timestamps))
		valueField := valueField(measurement.Name, values, labels)
		valueField.Config = getFieldConfig(measurement, useEngineeringSpecs)
		fields = append(fields, valueField)
	}
	return fields
}

func getFieldConfig(measurement schemas.Measurement, useEngineeringSpecs bool) *data.FieldConfig {
	fieldConfig := &data.FieldConfig{
		Unit:        "none",
		Description: measurement.Description,
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

func valueField(field string, values []interface{}, labels data.Labels) *data.Field {
	if len(values) == 0 {
		return nil
	}

	firstValueIndex := -1

	for i, value := range values {
		if value != nil {
			firstValueIndex = i
			break
		}
	}

	if firstValueIndex == -1 {
		return nil
	}

	switch values[firstValueIndex].(type) {
	case int8:
		res := make([]*int8, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(int8)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case int16:
		res := make([]*int16, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(int16)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case int32:
		res := make([]*int32, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(int32)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case int64:
		res := make([]*int64, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(int64)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case uint8:
		res := make([]*uint8, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(uint8)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case uint16:
		res := make([]*uint16, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(uint16)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case uint32:
		res := make([]*uint32, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(uint32)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case uint64:
		res := make([]*uint64, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(uint64)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case float32:
		res := make([]*float32, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(float32)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case float64:
		res := make([]*float64, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(float64)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case string:
		res := make([]*string, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(string)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case bool:
		res := make([]*bool, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(bool)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case time.Time:
		res := make([]*time.Time, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(time.Time)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case json.RawMessage:
		res := make([]*json.RawMessage, len(values))
		for i, value := range values {
			res[i] = nil
			if value != nil {
				typedValue := value.(json.RawMessage)
				res[i] = &typedValue
			}
		}
		return data.NewField(field, labels, res)
	case json.Number:
		res := make([]*float64, len(values))
		for i, value := range values {
			jsonNumber, ok := value.(json.Number)
			if ok {
				typedValue, _ := jsonNumber.Float64()
				res[i] = &typedValue
			} else {
				res[i] = nil
			}
		}
		return data.NewField(field, labels, res)
	}

	return nil
}
