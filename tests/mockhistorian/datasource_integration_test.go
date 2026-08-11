package main

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests drive the real plugin backend (pkg/datasource) against the mock
// exactly like Grafana does in the e2e suite: same instance settings, same
// query payloads as the provisioned dashboards. They catch contract breaks
// between the backend and the mock without needing a browser.

func newTestDataSource(t *testing.T) *datasource.HistorianDataSource {
	t.Helper()

	server := httptest.NewServer(newMux())
	t.Cleanup(server.Close)

	instance, err := datasource.NewDataSource(context.Background(), backend.DataSourceInstanceSettings{
		JSONData:                []byte(`{"url": "` + server.URL + `", "organization": "00000000-0000-0000-0000-000000000000"}`),
		DecryptedSecureJSONData: map[string]string{"token": "e2e-mock-token"},
	})
	require.NoError(t, err)
	ds, ok := instance.(*datasource.HistorianDataSource)
	require.True(t, ok)
	return ds
}

func testTimeRange() backend.TimeRange {
	to := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	return backend.TimeRange{From: to.Add(-6 * time.Hour), To: to}
}

// queryJSON builds the payload the frontend sends: the inner query under
// "query" plus seriesLimit (see pkg/datasource/query_handler.go Query).
func queryJSON(t *testing.T, inner string) []byte {
	t.Helper()

	raw := map[string]any{"seriesLimit": 50}
	var innerParsed any
	require.NoError(t, json.Unmarshal([]byte(inner), &innerParsed))
	raw["query"] = innerParsed
	payload, err := json.Marshal(raw)
	require.NoError(t, err)
	return payload
}

func runQuery(t *testing.T, ds *datasource.HistorianDataSource, queryType, inner string) backend.DataResponse {
	t.Helper()

	response, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
		Queries: []backend.DataQuery{{
			RefID:     "A",
			QueryType: queryType,
			TimeRange: testTimeRange(),
			Interval:  time.Minute,
			JSON:      queryJSON(t, inner),
		}},
	})
	require.NoError(t, err)
	return response.Responses["A"]
}

func TestDataSourceCheckHealth(t *testing.T) {
	t.Parallel()

	ds := newTestDataSource(t)
	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusOk, result.Status, result.Message)
}

func TestDataSourceMeasurementQuery(t *testing.T) {
	t.Parallel()

	// Same query as tests/provisioning/dashboards/measurements.json.
	response := runQuery(t, newTestDataSource(t), "MeasurementQuery", `{
		"Databases": ["historian"],
		"Measurements": ["e2e.motor.speed"],
		"IsRegex": false,
		"Options": {
			"Aggregation": { "Name": "mean", "Period": "$__interval" },
			"GroupBy": [], "Tags": {}
		}
	}`)
	require.NoError(t, response.Error)
	require.Len(t, response.Frames, 1)

	valueField, idx := response.Frames[0].FieldByName("value")
	require.NotEqual(t, -1, idx)
	assert.Positive(t, valueField.Len())
	require.NotNil(t, valueField.Config)
	assert.Contains(t, valueField.Config.DisplayNameFromDS, "e2e.motor.speed")
}

func TestDataSourceAssetMeasurementQuery(t *testing.T) {
	t.Parallel()

	// Same query as tests/provisioning/dashboards/assets.json.
	response := runQuery(t, newTestDataSource(t), "AssetMeasurementQuery", `{
		"Assets": ["66666666-6666-6666-6666-666666666666"],
		"AssetProperties": ["Speed", "Temperature"],
		"Options": {
			"Aggregation": { "Name": "mean", "Period": "$__interval" },
			"GroupBy": [], "Tags": {}
		}
	}`)
	require.NoError(t, response.Error)
	require.Len(t, response.Frames, 2)

	names := make([]string, 0, len(response.Frames))
	for _, frame := range response.Frames {
		valueField, idx := frame.FieldByName("value")
		require.NotEqual(t, -1, idx)
		require.NotNil(t, valueField.Config)
		names = append(names, valueField.Config.DisplayNameFromDS)
	}
	assert.Contains(t, names[0]+names[1], "Speed")
	assert.Contains(t, names[0]+names[1], "Temperature")
}

func TestDataSourceEventQuery(t *testing.T) {
	t.Parallel()

	// Same query as tests/provisioning/dashboards/events.json.
	response := runQuery(t, newTestDataSource(t), "EventQuery", `{
		"Type": "simple",
		"Assets": ["66666666-6666-6666-6666-666666666666"],
		"EventTypes": ["99999999-9999-9999-9999-999999999999"],
		"Statuses": [], "Properties": [], "PropertyFilter": [],
		"Limit": 1000,
		"Ascending": true
	}`)
	require.NoError(t, response.Error)
	require.Len(t, response.Frames, 1)

	codeField, idx := response.Frames[0].FieldByName("code")
	require.NotEqual(t, -1, idx, "expected a column per simple event property")
	require.Equal(t, 3, codeField.Len())

	codes := map[string]struct{}{}
	for i := 0; i < codeField.Len(); i++ {
		value, ok := codeField.ConcreteAt(i)
		require.True(t, ok)
		codes[value.(string)] = struct{}{}
	}
	assert.Contains(t, codes, "batch-42")
}

func TestDataSourceRawQuery(t *testing.T) {
	t.Parallel()

	// Same query as tests/provisioning/dashboards/raw.json.
	response := runQuery(t, newTestDataSource(t), "RawQuery", `{
		"TimeseriesDatabase": "11111111-1111-1111-1111-111111111111",
		"Query": "SELECT time, value FROM \"e2e.motor.speed\" WHERE $timeFilter",
		"Format": "arrow"
	}`)
	require.NoError(t, response.Error)
	require.Len(t, response.Frames, 1)

	labelField, idx := response.Frames[0].FieldByName("label")
	require.NotEqual(t, -1, idx)
	assert.Equal(t, "raw-row-1", labelField.At(0))
}
