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
