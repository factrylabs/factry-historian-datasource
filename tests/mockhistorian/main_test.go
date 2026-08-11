package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	arrow_pb "github.com/factrylabs/factry-historian-datasource.git/pkg/proto"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
)

func TestTimeseriesDatabasesFixture(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/timeseries-databases", "")
	require.Equal(t, http.StatusOK, rec.Code)

	var got []schemas.TimeseriesDatabase
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, "historian", got[0].Name)
	assert.Equal(t, databaseUUID, got[0].UUID)
}

func TestMeasurementsFilters(t *testing.T) {
	t.Parallel()

	tests := []struct {
		query string
		names []string
	}{
		{"", []string{"e2e.motor.speed", "e2e.motor.temperature"}},
		{"?Keyword=e2e.motor.speed", []string{"e2e.motor.speed"}},
		{"?Keyword=" + speedMeasurementUUID.String(), []string{"e2e.motor.speed"}},
		{"?Keyword=/temp.*/", []string{"e2e.motor.temperature"}},
		{"?Keyword=nomatch", nil},
		{"?DatabaseUUIDs=" + databaseUUID.String(), []string{"e2e.motor.speed", "e2e.motor.temperature"}},
		{"?DatabaseUUIDs[0]=" + motorAssetUUID.String(), nil},
		{"?Limit=1", []string{"e2e.motor.speed"}},
	}

	for _, tc := range tests {
		rec := doRequest(t, http.MethodGet, "/api/measurements"+tc.query, "")
		require.Equal(t, http.StatusOK, rec.Code, tc.query)

		var got []schemas.Measurement
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got), tc.query)
		names := make([]string, 0, len(got))
		for _, m := range got {
			names = append(names, m.Name)
		}
		assert.ElementsMatch(t, tc.names, names, tc.query)
	}
}

func TestMeasurementByUUID(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/measurements/"+speedMeasurementUUID.String(), "")
	require.Equal(t, http.StatusOK, rec.Code)

	var got schemas.Measurement
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "e2e.motor.speed", got.Name)

	rec = doRequest(t, http.MethodGet, "/api/measurements/"+eventConfigurationUUID.String(), "")
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestAssetsLazyTreeQueries(t *testing.T) {
	t.Parallel()

	// Root level query as sent by the frontend cascader (nil parent UUID).
	rec := doRequest(t, http.MethodGet, "/api/assets?ParentUUIDs=00000000-0000-0000-0000-000000000000&IncludeHasChildren=true", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var roots []schemas.Asset
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &roots))
	require.Len(t, roots, 1)
	assert.Equal(t, "Site", roots[0].Name)
	require.NotNil(t, roots[0].HasChildren)
	assert.True(t, *roots[0].HasChildren)
	// IncludeHasAssetProperties was not requested, so the field must be absent.
	assert.Nil(t, roots[0].HasAssetProperties)

	// Child level query.
	rec = doRequest(t, http.MethodGet, "/api/assets?ParentUUIDs="+lineAssetUUID.String()+"&IncludeHasAssetProperties=true", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var children []schemas.Asset
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &children))
	require.Len(t, children, 1)
	assert.Equal(t, "Motor", children[0].Name)
	require.NotNil(t, children[0].HasAssetProperties)
	assert.True(t, *children[0].HasAssetProperties)
}

func TestAssetsFilteredResolution(t *testing.T) {
	t.Parallel()

	// UUIDs[i] form used by GetFilteredAssets on historian >= 8.1.
	rec := doRequest(t, http.MethodGet, "/api/assets?UUIDs[0]="+motorAssetUUID.String(), "")
	require.Equal(t, http.StatusOK, rec.Code)
	var byUUID []schemas.Asset
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &byUUID))
	require.Len(t, byUUID, 1)
	assert.Equal(t, "Motor", byUUID[0].Name)

	// Path form (exact match).
	rec = doRequest(t, http.MethodGet, "/api/assets?Path="+url.QueryEscape(`Site\\Line 1\\Motor`), "")
	require.Equal(t, http.StatusOK, rec.Code)
	var byPath []schemas.Asset
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &byPath))
	require.Len(t, byPath, 1)
	assert.Equal(t, "Motor", byPath[0].Name)

	// Keyword search used by the cascader's async search.
	rec = doRequest(t, http.MethodGet, "/api/assets?Keyword=mot", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var byKeyword []schemas.Asset
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &byKeyword))
	require.Len(t, byKeyword, 1)
	assert.Equal(t, "Motor", byKeyword[0].Name)
}

func TestAssetProperties(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/asset-properties?AssetUUIDs="+motorAssetUUID.String(), "")
	require.Equal(t, http.StatusOK, rec.Code)
	var got []schemas.AssetProperty
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 2)

	rec = doRequest(t, http.MethodGet, "/api/asset-properties?AssetUUIDs[0]="+siteAssetUUID.String(), "")
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Empty(t, got)
}

func TestEventTypesKeywordAcceptsUUID(t *testing.T) {
	t.Parallel()

	// GetFilteredEventTypes passes the selected UUID as Keyword.
	rec := doRequest(t, http.MethodGet, "/api/event-types?Keyword="+batchEventTypeUUID.String(), "")
	require.Equal(t, http.StatusOK, rec.Code)
	var got []schemas.EventType
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, "Batch", got[0].Name)
}

func TestEventTypeProperties(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/event-type-properties?EventTypeUUIDs[0]="+batchEventTypeUUID.String()+"&Types[0]=simple", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var got []schemas.EventTypeProperty
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Len(t, got, 3)

	rec = doRequest(t, http.MethodGet, "/api/event-type-properties?Types[0]=periodic", "")
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Empty(t, got)
}

func TestEventsFilteredByWindowAssetAndStatus(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := start.Add(6 * time.Hour)
	window := fmt.Sprintf("StartTime=%s&StopTime=%s", start.Format(time.RFC3339), end.Format(time.RFC3339))

	rec := doRequest(t, http.MethodGet, "/api/events?"+window+"&AssetUUIDs[0]="+motorAssetUUID.String()+"&EventTypeUUIDs[0]="+batchEventTypeUUID.String(), "")
	require.Equal(t, http.StatusOK, rec.Code)
	var got []schemas.Event
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 3)

	// Default ordering is descending by start time; every event within window.
	assert.True(t, got[0].StartTime.After(got[1].StartTime))
	for _, event := range got {
		assert.False(t, event.StartTime.Before(start))
		assert.False(t, event.StartTime.After(end))
		require.NotNil(t, event.Properties)
	}

	// The open event has no stop time.
	assert.Nil(t, got[0].StopTime)
	assert.Equal(t, schemas.EventStatusOpen, got[0].Status)

	// Asset filter mismatch yields nothing.
	rec = doRequest(t, http.MethodGet, "/api/events?"+window+"&AssetUUIDs[0]="+siteAssetUUID.String(), "")
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Empty(t, got)

	// Status filter.
	rec = doRequest(t, http.MethodGet, "/api/events?"+window+"&Status[0]=processed", "")
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Len(t, got, 2)

	// Ascending + limit.
	rec = doRequest(t, http.MethodGet, "/api/events?"+window+"&Ascending=true&Limit=1", "")
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, "batch-41", got[0].Properties.Properties.GetString("code"))
}

func TestEventsPropertyFilter(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/events?PropertyFilter[0].Property=code&PropertyFilter[0].Operator=%3D&PropertyFilter[0].Value=batch-42", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var got []schemas.Event
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, "batch-42", got[0].Properties.Properties.GetString("code"))
}

func TestEventPropertyValues(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/event-type-properties/"+codePropertyUUID.String()+"/values", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var got []any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.ElementsMatch(t, []any{"batch-41", "batch-42", "batch-43"}, got)
}

// TestTimeseriesQueryDecodesLikeBackend proves the query response is
// byte-faithful: it decodes through the exact path pkg/api/query.go uses
// (proto.Unmarshal into arrow_pb.DataResponse, then data.UnmarshalArrowFrames).
func TestTimeseriesQueryDecodesLikeBackend(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	body := schemas.Query{
		MeasurementUUIDs: []string{speedMeasurementUUID.String(), temperatureMeasurementUUID.String()},
		Start:            start,
		End:              &end,
	}
	raw, err := json.Marshal(body)
	require.NoError(t, err)

	frames := decodeFrames(t, doRequest(t, http.MethodPost, "/api/timeseries/query", string(raw)))
	require.Len(t, frames, 2)

	for i, frame := range frames {
		require.Len(t, frame.Fields, 2)

		timeField, timeIdx := frame.FieldByName("time")
		require.NotEqual(t, -1, timeIdx)
		valueField, valueIdx := frame.FieldByName("value")
		require.NotEqual(t, -1, valueIdx)
		assert.Positive(t, timeField.Len())
		assert.Equal(t, timeField.Len(), valueField.Len())

		// The backend reads these to name frames and match asset properties.
		require.NotNil(t, frame.Meta)
		custom, ok := frame.Meta.Custom.(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, body.MeasurementUUIDs[i], custom["MeasurementUUID"])
		assert.NotEmpty(t, custom["MeasurementName"])

		// Every timestamp must sit inside the requested range so points render.
		for j := 0; j < timeField.Len(); j++ {
			ts, ok := timeField.At(j).(time.Time)
			require.True(t, ok)
			assert.False(t, ts.Before(start))
			assert.False(t, ts.After(end))
		}
	}
}

func TestTimeseriesQueryByName(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	body := schemas.Query{
		Measurements: []schemas.MeasurementByName{{Database: "historian", Measurement: "e2e.motor.speed"}},
		Start:        start,
		End:          &end,
	}
	raw, err := json.Marshal(body)
	require.NoError(t, err)

	frames := decodeFrames(t, doRequest(t, http.MethodPost, "/api/timeseries/query", string(raw)))
	require.Len(t, frames, 1)
	assert.Equal(t, "e2e.motor.speed", frames[0].Name)
}

func TestRawQuery(t *testing.T) {
	t.Parallel()

	body := `{"Query": "SELECT * FROM speed", "Format": "arrow"}`
	frames := decodeFrames(t, doRequest(t, http.MethodPost, "/api/timeseries/"+databaseUUID.String()+"/raw-query", body))
	require.Len(t, frames, 1)

	labelField, idx := frames[0].FieldByName("label")
	require.NotEqual(t, -1, idx)
	assert.Equal(t, "raw-row-1", labelField.At(0))

	rec := doRequest(t, http.MethodPost, "/api/timeseries/"+databaseUUID.String()+"/raw-query", `{"Query": ""}`)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestTagKeysAndValues(t *testing.T) {
	t.Parallel()

	frames := decodeFrames(t, doRequest(t, http.MethodGet, "/api/timeseries/measurements/"+speedMeasurementUUID.String()+"/tags", ""))
	require.Len(t, frames, 1)
	keys := stringsFromField(t, frames[0], "tagKey")
	assert.ElementsMatch(t, []string{"location", "unit"}, keys)

	frames = decodeFrames(t, doRequest(t, http.MethodGet, "/api/timeseries/measurements/"+speedMeasurementUUID.String()+"/tags/location", ""))
	require.Len(t, frames, 1)
	values := stringsFromField(t, frames[0], "value")
	assert.ElementsMatch(t, []string{"ghent", "aalst"}, values)
}

func TestFallbackReturnsEmptyArray(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/not-implemented", "")
	require.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, "[]", rec.Body.String())
}

// stringsFromField extracts nullable strings the same way the backend's
// getStringSetFromFrames does (values must decode as *string).
func stringsFromField(t *testing.T, frame *data.Frame, fieldName string) []string {
	t.Helper()

	field, idx := frame.FieldByName(fieldName)
	require.NotEqual(t, -1, idx, "field %s missing", fieldName)

	result := []string{}
	for i := 0; i < field.Len(); i++ {
		value, ok := field.At(i).(*string)
		require.True(t, ok, "field %s must decode as *string", fieldName)
		require.NotNil(t, value)
		result = append(result, *value)
	}
	return result
}

func decodeFrames(t *testing.T, rec *httptest.ResponseRecorder) data.Frames {
	t.Helper()

	require.Equal(t, http.StatusOK, rec.Code)
	dataResponse := arrow_pb.DataResponse{}
	require.NoError(t, proto.Unmarshal(rec.Body.Bytes(), &dataResponse))
	require.Empty(t, dataResponse.GetError())

	frames, err := data.UnmarshalArrowFrames(dataResponse.GetFrames())
	require.NoError(t, err)
	return frames
}

func doRequest(t *testing.T, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()

	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	// t.Context() ties the request to the test's lifetime and satisfies noctx.
	req := httptest.NewRequestWithContext(t.Context(), method, target, reader)
	rec := httptest.NewRecorder()
	newMux().ServeHTTP(rec, req)
	return rec
}
