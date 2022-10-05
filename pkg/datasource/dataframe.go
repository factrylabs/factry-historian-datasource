package datasource

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
	historianSchemas "gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"
)

// QueryResultToDataFrame converts a query result to data frames
func QueryResultToDataFrame(measurements []schemas.Measurement, queryResult *historianSchemas.QueryResult) (data.Frames, error) {
	dataFrames := data.Frames{}

	for _, series := range queryResult.Series {
		uom := "none"
		for _, measurement := range measurements {
			if measurement.Name == series.Measurement {
				uom = measurement.UoM
				break
			}
		}
		frame := data.NewFrame(series.Measurement, seriesToFields(series, uom)...)
		dataFrames = append(dataFrames, frame)
	}

	return dataFrames, nil
}

func seriesToFields(series *historianSchemas.Series, uom string) []*data.Field {
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
		valueField := valueField("value", values, labels)
		valueField.Config = &data.FieldConfig{
			Unit: uom,
		}
		fields = append(fields, valueField)
	}
	return fields
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
