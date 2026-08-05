package datasource

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// An asset measurement query without a property filter must not return every
// series twice. Properties are registered under both name and UUID in
// propertiesByAssetUUIDAndID and the selection loop iterates all map entries,
// so without deduplication each property is appended twice to the property map
// and setAssetFrameNames then duplicates the frame.
func TestAssetMeasurementQueryWithoutPropertyFilterDoesNotDuplicateSeries(t *testing.T) {
	t.Parallel()

	assetUUID := uuid.New()
	measurementUUID := uuid.New()
	ds := assetQueryFixture(t, assetUUID, []schemas.AssetProperty{{
		BaseModel:       schemas.BaseModel{UUID: uuid.New(), Name: "temperature"},
		AssetUUID:       assetUUID,
		MeasurementUUID: measurementUUID,
	}})

	timeRange := backend.TimeRange{From: time.Unix(0, 0).UTC(), To: time.Unix(3600, 0).UTC()}
	frames, err := ds.handleAssetMeasurementQuery(context.Background(), schemas.AssetMeasurementQuery{
		Assets:          []string{"plant"},
		AssetProperties: []string{}, // no filter: query all properties of the asset
	}, timeRange, time.Minute, 50, &schemas.HistorianInfo{Version: "v7.0.0"})

	require.NoError(t, err)
	assert.Len(t, frames, 1, "one asset property backed by one measurement must produce exactly one series")
}

// fillQueryVariables computes UnixNano()%interval unconditionally.
// backend.Query.Interval is 0 for API/alerting callers that omit intervalMs,
// so every raw query from such a caller must not die on an integer divide by
// zero.
func TestFillQueryVariablesZeroIntervalDoesNotPanic(t *testing.T) {
	t.Parallel()

	timeRange := backend.TimeRange{From: time.Unix(0, 0).UTC(), To: time.Unix(3600, 0).UTC()}
	assert.NotPanics(t, func() {
		fillQueryVariables("SELECT * FROM measurement WHERE $timeFilter", "Influx", timeRange, 0)
	})
}

// A query with seriesLimit 0 (older saved queries, alerting or API callers that
// bypass the frontend default) must not be silently truncated to a single
// series instead of returning all matching series.
func TestSeriesLimitZeroDoesNotTruncateToOneSeries(t *testing.T) {
	t.Parallel()

	assetUUID := uuid.New()
	ds := assetQueryFixture(t, assetUUID, []schemas.AssetProperty{
		{
			BaseModel:       schemas.BaseModel{UUID: uuid.New(), Name: "temperature"},
			AssetUUID:       assetUUID,
			MeasurementUUID: uuid.New(),
		},
		{
			BaseModel:       schemas.BaseModel{UUID: uuid.New(), Name: "pressure"},
			AssetUUID:       assetUUID,
			MeasurementUUID: uuid.New(),
		},
	})

	timeRange := backend.TimeRange{From: time.Unix(0, 0).UTC(), To: time.Unix(3600, 0).UTC()}
	frames, err := ds.handleAssetMeasurementQuery(context.Background(), schemas.AssetMeasurementQuery{
		Assets:          []string{"plant"},
		AssetProperties: []string{"temperature", "pressure"},
	}, timeRange, time.Minute, 0, &schemas.HistorianInfo{Version: "v7.0.0"})

	require.NoError(t, err)
	assert.Len(t, frames, 2, "seriesLimit 0 must not silently truncate the result to one series")
}

// Historian returns 429 when its admission queue is full and 504 when a query
// exceeds the server timeout. Both are downstream failures, but a DataResponse
// that only carries Error leaves Status at its zero value, which Grafana maps to
// a 500 attributed to the plugin. That hides the real cause in Grafana's error
// UI and in its plugin error metrics.
func TestQueryDataAttributesHistorianErrorsToDownstream(t *testing.T) {
	t.Parallel()

	assetUUID := uuid.New()
	measurementUUID := uuid.New()
	databaseUUID := uuid.New()

	testCases := []struct {
		name           string
		statusCode     int
		body           string
		queryType      string
		query          interface{}
		expectedStatus backend.Status
	}{
		{
			name:           "raw query rate limited",
			statusCode:     http.StatusTooManyRequests,
			body:           `{"error":"admission queue full"}`,
			queryType:      QueryTypeRaw,
			query:          schemas.RawQuery{Query: "SELECT 1", TimeseriesDatabase: databaseUUID.String()},
			expectedStatus: backend.StatusTooManyRequests,
		},
		{
			name:           "asset measurement query timed out",
			statusCode:     http.StatusGatewayTimeout,
			body:           `{"error":"query exceeded timeout"}`,
			queryType:      QueryTypeAsset,
			query:          schemas.AssetMeasurementQuery{Assets: []string{"plant"}},
			expectedStatus: backend.StatusTimeout,
		},
		{
			name:           "measurement query rejected",
			statusCode:     http.StatusBadRequest,
			body:           `{"error":"error executing query"}`,
			queryType:      QueryTypeQuery,
			query:          schemas.MeasurementQuery{Measurements: []string{measurementUUID.String()}},
			expectedStatus: backend.StatusBadRequest,
		},
		{
			name:           "event query rate limited",
			statusCode:     http.StatusTooManyRequests,
			body:           `{"error":"admission queue full"}`,
			queryType:      QueryTypeEvent,
			query:          schemas.EventQuery{Assets: []string{"plant"}, EventTypes: []string{"batch"}, Type: string(schemas.EventTypePropertyTypeSimple)},
			expectedStatus: backend.StatusTooManyRequests,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			fail := func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(testCase.statusCode)
				_, _ = w.Write([]byte(testCase.body))
			}

			mux := http.NewServeMux()
			mux.HandleFunc("GET /api/assets", func(w http.ResponseWriter, _ *http.Request) {
				writeJSON(w, []schemas.Asset{{
					BaseModel: schemas.BaseModel{UUID: assetUUID, Name: "plant"},
					AssetPath: "plant",
				}})
			})
			mux.HandleFunc("GET /api/asset-properties", func(w http.ResponseWriter, _ *http.Request) {
				writeJSON(w, []schemas.AssetProperty{{
					BaseModel:       schemas.BaseModel{UUID: uuid.New(), Name: "temperature"},
					AssetUUID:       assetUUID,
					MeasurementUUID: measurementUUID,
				}})
			})
			mux.HandleFunc("GET /api/timeseries-databases", func(w http.ResponseWriter, _ *http.Request) {
				writeJSON(w, []schemas.TimeseriesDatabase{{BaseModel: schemas.BaseModel{UUID: databaseUUID, Name: "factory"}}})
			})
			mux.HandleFunc("GET /api/measurements", func(w http.ResponseWriter, _ *http.Request) {
				writeJSON(w, []schemas.Measurement{{BaseModel: schemas.BaseModel{UUID: measurementUUID, Name: "temperature"}, DatabaseUUID: databaseUUID}})
			})
			mux.HandleFunc("GET /api/event-types", func(w http.ResponseWriter, _ *http.Request) {
				writeJSON(w, []schemas.EventType{{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "batch"}}})
			})
			mux.HandleFunc("POST /api/timeseries/query", fail)
			mux.HandleFunc("POST /api/timeseries/{uuid}/raw-query", fail)
			mux.HandleFunc("GET /api/events", fail)

			ds := newFakeHistorianDataSource(t, mux)

			rawQuery, err := json.Marshal(testCase.query)
			require.NoError(t, err)
			queryJSON, err := json.Marshal(Query{
				Query:         rawQuery,
				HistorianInfo: &schemas.HistorianInfo{Version: "v8.2.0"},
			})
			require.NoError(t, err)

			response, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
				Queries: []backend.DataQuery{{RefID: "A", QueryType: testCase.queryType, JSON: queryJSON}},
			})
			require.NoError(t, err)
			require.Contains(t, response.Responses, "A")

			dataResponse := response.Responses["A"]
			require.Error(t, dataResponse.Error)
			assert.Contains(t, dataResponse.Error.Error(), "error", "the historian error body must reach the panel")
			assert.Equal(t, testCase.expectedStatus, dataResponse.Status, "the historian status code must be forwarded")
			assert.Equal(t, backend.ErrorSourceDownstream, dataResponse.ErrorSource, "a historian failure is not a plugin failure")
		})
	}
}
