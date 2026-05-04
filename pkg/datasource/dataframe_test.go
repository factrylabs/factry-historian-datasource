package datasource

import (
	"testing"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// makeFrame builds a single-row frame with a value field of the requested type. Custom metadata
// includes the standard metadata fields plus a Labels map (the groupby labels source).
func makeFrame(t *testing.T, valueField *data.Field, displayName string) *data.Frame {
	t.Helper()
	timeField := data.NewField("time", nil, []time.Time{time.Unix(0, 0)})
	if valueField.Config == nil {
		valueField.Config = &data.FieldConfig{}
	}
	valueField.Config.DisplayNameFromDS = displayName
	frame := data.NewFrame("", timeField, valueField)
	frame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
			"MeasurementUUID": "uuid-123",
			"MeasurementName": "temperature",
			"DatabaseName":    "factory",
			"Labels": map[string]interface{}{
				"status": "Good",
			},
		},
	}
	return frame
}

func fieldNames(frame *data.Frame) []string {
	names := make([]string, 0, len(frame.Fields))
	for _, f := range frame.Fields {
		names = append(names, f.Name)
	}
	return names
}

func TestApplyFrameFormat_AutoNumeric(t *testing.T) {
	t.Parallel()
	value := data.NewField("value", nil, []float64{42})
	frame := makeFrame(t, value, "temperature")

	out := applyFrameFormat(data.Frames{frame}, schemas.FrameFormatAuto)

	require.Len(t, out, 1)
	assert.Equal(t, data.FrameTypeTimeSeriesMulti, out[0].Meta.Type)
	assert.Equal(t, []string{"time", "value"}, fieldNames(out[0]))
}

func TestApplyFrameFormat_AutoString(t *testing.T) {
	t.Parallel()
	value := data.NewField("value", nil, []string{"running"})
	frame := makeFrame(t, value, "state")

	out := applyFrameFormat(data.Frames{frame}, schemas.FrameFormatAuto)

	require.Len(t, out, 1)
	assert.Equal(t, data.FrameTypeTimeSeriesMulti, out[0].Meta.Type,
		"string default must keep the panel-friendly shape; users opt into Table for SQL expressions")
	assert.Equal(t, []string{"time", "value"}, fieldNames(out[0]))
}

func TestApplyFrameFormat_TableNumeric(t *testing.T) {
	t.Parallel()
	value := data.NewField("value", nil, []float64{42})
	frame := makeFrame(t, value, "temperature")

	out := applyFrameFormat(data.Frames{frame}, schemas.FrameFormatTable)

	require.Len(t, out, 1)
	assert.Equal(t, data.FrameTypeUnknown, out[0].Meta.Type,
		"Table flattens numeric frames too for consistency")
	assertFlatLayout(t, out[0], "temperature")
}

func TestApplyFrameFormat_TableString(t *testing.T) {
	t.Parallel()
	value := data.NewField("value", nil, []string{"running"})
	frame := makeFrame(t, value, "state")

	out := applyFrameFormat(data.Frames{frame}, schemas.FrameFormatTable)

	require.Len(t, out, 1)
	assert.Equal(t, data.FrameTypeUnknown, out[0].Meta.Type)
	assertFlatLayout(t, out[0], "state")
}

func TestApplyFrameFormat_TableBool(t *testing.T) {
	t.Parallel()
	value := data.NewField("value", nil, []bool{true})
	frame := makeFrame(t, value, "running")

	out := applyFrameFormat(data.Frames{frame}, schemas.FrameFormatTable)

	require.Len(t, out, 1)
	assert.Equal(t, data.FrameTypeUnknown, out[0].Meta.Type)
	assertFlatLayout(t, out[0], "running")

	valueField, _ := out[0].FieldByName(sseValueFieldName)
	require.NotNil(t, valueField)
	assert.Equal(t, data.FieldTypeBool, valueField.Type(),
		"bool value field type must be preserved end-to-end so SSE's single-frame bypass hands it to SQL as a bool column")
}

// assertFlatLayout verifies that a flattened frame has the expected SSE-friendly columns and
// that no field carries labels (SSE's single-frame bypass requires labels-free fields).
func assertFlatLayout(t *testing.T, frame *data.Frame, wantDisplayName string) {
	t.Helper()
	names := fieldNames(frame)
	expected := []string{
		"time", sseValueFieldName, sseMetricNameFieldName, sseDisplayNameFieldName,
		"DatabaseName", "MeasurementName", "MeasurementUUID", "status",
	}
	assert.Equal(t, expected, names)

	for _, f := range frame.Fields {
		assert.Empty(t, f.Labels, "field %q must have no labels — SSE's single-frame bypass requires labels-free fields", f.Name)
	}

	valueField, _ := frame.FieldByName(sseValueFieldName)
	require.NotNil(t, valueField)
	assert.Empty(t, valueField.Config.DisplayNameFromDS,
		"DisplayNameFromDS must be cleared so SSE uses the field Name as the SQL column name")

	metricField, _ := frame.FieldByName(sseMetricNameFieldName)
	require.NotNil(t, metricField)
	got, _ := metricField.ConcreteAt(0)
	assert.Equal(t, valueFieldName, got)

	displayField, _ := frame.FieldByName(sseDisplayNameFieldName)
	require.NotNil(t, displayField)
	gotDisplay, ok := displayField.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, wantDisplayName, gotDisplay)

	statusField, _ := frame.FieldByName("status")
	require.NotNil(t, statusField)
	gotStatus, _ := statusField.ConcreteAt(0)
	assert.Equal(t, "Good", gotStatus)
}

// TestApplyFrameFormat_PreservesLabelsMap guards against an earlier regression where the
// flatten step deleted Custom["Labels"] and broke downstream consumers of the metadata.
func TestApplyFrameFormat_PreservesLabelsMap(t *testing.T) {
	t.Parallel()
	value := data.NewField("value", nil, []string{"running"})
	frame := makeFrame(t, value, "state")
	custom, ok := frame.Meta.Custom.(map[string]interface{})
	require.True(t, ok)

	applyFrameFormat(data.Frames{frame}, schemas.FrameFormatTable)

	labels, ok := custom["Labels"].(map[string]interface{})
	require.True(t, ok, "Labels map must remain in Meta.Custom")
	assert.Equal(t, "Good", labels["status"])
}

// TestApplyFrameFormat_EmptyDisplayName covers the nullable-pointer branch in finalizeFlatFrames.
func TestApplyFrameFormat_EmptyDisplayName(t *testing.T) {
	t.Parallel()
	value := data.NewField("value", nil, []string{"running"})
	frame := makeFrame(t, value, "")

	out := applyFrameFormat(data.Frames{frame}, schemas.FrameFormatTable)

	displayField, _ := out[0].FieldByName(sseDisplayNameFieldName)
	require.NotNil(t, displayField)
	_, ok := displayField.ConcreteAt(0)
	assert.False(t, ok, "display name column should be null when no display name is set")
}

func TestConvertFieldType_NullableToNonNullablePreservesValues(t *testing.T) {
	t.Parallel()
	one, two := 1.5, 2.5
	src := data.NewField("value", nil, []*float64{&one, nil, &two})

	dst := convertFieldType(src, data.FieldTypeFloat64)

	require.Equal(t, data.FieldTypeFloat64, dst.Type())
	require.Equal(t, 3, dst.Len())
	assert.InDelta(t, 1.5, dst.At(0), 0)
	assert.InDelta(t, 0.0, dst.At(1), 0, "nil source value falls back to zero of target type")
	assert.InDelta(t, 2.5, dst.At(2), 0)
}

func TestConvertFieldType_BoolToFloat(t *testing.T) {
	t.Parallel()
	src := data.NewField("value", nil, []bool{true, false})

	dst := convertFieldType(src, data.FieldTypeFloat64)

	require.Equal(t, data.FieldTypeFloat64, dst.Type())
	assert.InDelta(t, 1.0, dst.At(0), 0)
	assert.InDelta(t, 0.0, dst.At(1), 0)
}

func TestConvertFieldType_FloatToString(t *testing.T) {
	t.Parallel()
	src := data.NewField("value", nil, []float64{3.14, 42})

	dst := convertFieldType(src, data.FieldTypeString)

	require.Equal(t, data.FieldTypeString, dst.Type())
	assert.Equal(t, "3.14", dst.At(0))
	assert.Equal(t, "42", dst.At(1))
}

func TestConvertFieldType_UnparseableStringToFloatFallsBackToZero(t *testing.T) {
	t.Parallel()
	src := data.NewField("value", nil, []string{"running"})

	dst := convertFieldType(src, data.FieldTypeFloat64)

	require.Equal(t, data.FieldTypeFloat64, dst.Type())
	assert.InDelta(t, 0.0, dst.At(0), 0, "unparseable strings keep the zero pre-allocated by NewFieldFromFieldType")
}

func TestConvertFieldType_PreservesNameLabelsConfig(t *testing.T) {
	t.Parallel()
	src := data.NewField("value", data.Labels{"k": "v"}, []bool{true})
	src.Config = &data.FieldConfig{DisplayNameFromDS: "label"}

	dst := convertFieldType(src, data.FieldTypeFloat64)

	assert.Equal(t, "value", dst.Name)
	assert.Equal(t, data.Labels{"k": "v"}, dst.Labels)
	require.NotNil(t, dst.Config)
	assert.Equal(t, "label", dst.Config.DisplayNameFromDS)
}

// TestMergeFrames_BoolLastKnownIntoFloatResult covers bug 34075: when the
// lastKnown frame's value type differs from the result frame, mergeFrames must
// coerce the lastKnown values instead of dropping them silently.
func TestMergeFrames_BoolLastKnownIntoFloatResult(t *testing.T) {
	t.Parallel()
	lastKnown := makeFrame(t, data.NewField("value", nil, []bool{true}), "running")
	result := makeFrame(t, data.NewField("value", nil, []float64{42}), "running")

	merged := mergeFrames(data.Frames{lastKnown}, data.Frames{result})

	require.Len(t, merged, 1)
	value, _ := merged[0].FieldByName("value")
	require.NotNil(t, value)
	require.Equal(t, data.FieldTypeFloat64, value.Type())
	require.Equal(t, 2, value.Len())
	assert.InDelta(t, 1.0, value.At(0), 0, "bool last-known value must coerce to 1.0 on a numeric series")
	assert.InDelta(t, 42.0, value.At(1), 0)
}

func TestMergeFrames_SameTypesAppendsRows(t *testing.T) {
	t.Parallel()
	lastKnown := makeFrame(t, data.NewField("value", nil, []float64{1}), "v")
	result := makeFrame(t, data.NewField("value", nil, []float64{2}), "v")

	merged := mergeFrames(data.Frames{lastKnown}, data.Frames{result})

	require.Len(t, merged, 1)
	value, _ := merged[0].FieldByName("value")
	require.NotNil(t, value)
	require.Equal(t, 2, value.Len())
	assert.InDelta(t, 1.0, value.At(0), 0)
	assert.InDelta(t, 2.0, value.At(1), 0)
}

func TestMergeFrames_EmptyInputs(t *testing.T) {
	t.Parallel()
	frame := makeFrame(t, data.NewField("value", nil, []float64{1}), "v")

	assert.Equal(t, data.Frames{frame}, mergeFrames(nil, data.Frames{frame}))
	assert.Equal(t, data.Frames{frame}, mergeFrames(data.Frames{frame}, nil))
}

func TestConvertFieldForAggregation_CountReplacesValuesWithOne(t *testing.T) {
	t.Parallel()
	src := data.NewField("value", data.Labels{"k": "v"}, []bool{true, false})
	src.Config = &data.FieldConfig{DisplayNameFromDS: "running"}

	dst := convertFieldForAggregation(src, schemas.Count)

	require.Equal(t, data.FieldTypeNullableFloat64, dst.Type())
	require.Equal(t, 2, dst.Len())
	for i := 0; i < dst.Len(); i++ {
		got, ok := dst.ConcreteAt(i)
		require.True(t, ok)
		gotFloat, isFloat := got.(float64)
		require.True(t, isFloat)
		assert.InDelta(t, 1.0, gotFloat, 0)
	}
	assert.Equal(t, "value", dst.Name, "downstream FieldByName lookups need the value name preserved")
	assert.Equal(t, data.Labels{"k": "v"}, dst.Labels)
	require.NotNil(t, dst.Config)
	assert.Equal(t, "running", dst.Config.DisplayNameFromDS)
}

func TestConvertFieldForAggregation_NumericCoercesToNullableFloat64(t *testing.T) {
	t.Parallel()
	src := data.NewField("value", nil, []bool{true, false})

	for _, agg := range []schemas.AggregationType{schemas.Mean, schemas.Sum, schemas.TWA, schemas.Stddev, schemas.Spread, schemas.Median, schemas.Integral} {
		t.Run(string(agg), func(t *testing.T) {
			t.Parallel()
			dst := convertFieldForAggregation(src, agg)
			require.Equal(t, data.FieldTypeNullableFloat64, dst.Type())
			got, _ := dst.ConcreteAt(0)
			gotFloat, isFloat := got.(float64)
			require.True(t, isFloat)
			assert.InDelta(t, 1.0, gotFloat, 0)
		})
	}
}

func TestConvertFieldForAggregation_NonNumericReturnsSameField(t *testing.T) {
	t.Parallel()
	src := data.NewField("value", nil, []bool{true})

	for _, agg := range []schemas.AggregationType{schemas.First, schemas.Last, schemas.Max, schemas.Min, schemas.Mode} {
		t.Run(string(agg), func(t *testing.T) {
			t.Parallel()
			assert.Same(t, src, convertFieldForAggregation(src, agg),
				"type-preserving aggregations must leave the field untouched")
		})
	}
}

func TestConvertLastKnownFramesForAggregation_OnlyTouchesValueField(t *testing.T) {
	t.Parallel()
	frame := makeFrame(t, data.NewField("value", nil, []bool{true}), "v")
	timeField := frame.Fields[0]

	convertLastKnownFramesForAggregation(data.Frames{frame}, schemas.Mean)

	assert.Same(t, timeField, frame.Fields[0], "time field must not be rewritten")
	value, _ := frame.FieldByName("value")
	require.NotNil(t, value)
	assert.Equal(t, data.FieldTypeNullableFloat64, value.Type())
}
