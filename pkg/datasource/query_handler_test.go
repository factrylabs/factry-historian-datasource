package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
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

// handleAssetMeasurementQuery builds the asset-property query from a map of
// assets, so its AssetUUIDs[i] order is random unless the UUIDs are sorted
// first. The encoded query is the resolution cache key, so an unstable order
// makes a repeat of the same panel query miss the cache.
func TestAssetMeasurementQueryEncodesAssetUUIDsInAStableOrder(t *testing.T) {
	t.Parallel()

	const assetCount = 6
	assets := make([]schemas.Asset, 0, assetCount)
	properties := make([]schemas.AssetProperty, 0, assetCount)
	for i := range assetCount {
		assetUUID := uuid.New()
		assets = append(assets, schemas.Asset{
			BaseModel: schemas.BaseModel{UUID: assetUUID, Name: fmt.Sprintf("asset-%d", i)},
			AssetPath: fmt.Sprintf("plant\\asset-%d", i),
		})
		properties = append(properties, schemas.AssetProperty{
			BaseModel:       schemas.BaseModel{UUID: uuid.New(), Name: "temperature"},
			AssetUUID:       assetUUID,
			MeasurementUUID: uuid.New(),
		})
	}

	ds, recorder := multiAssetQueryFixture(t, assets, properties, 0)
	timeRange := backend.TimeRange{From: time.Unix(0, 0).UTC(), To: time.Unix(3600, 0).UTC()}
	for range 20 {
		_, err := ds.handleAssetMeasurementQuery(context.Background(), schemas.AssetMeasurementQuery{
			Assets: []string{"plant"},
		}, timeRange, time.Minute, 0, &schemas.HistorianInfo{Version: "v8.1.0"})
		require.NoError(t, err)
	}

	queries := recorder.queriesFor("/api/asset-properties")
	require.Len(t, queries, 20)
	for i := range queries {
		require.Equal(t, queries[0], queries[i], "every repeat of the same query must encode to the same string")
	}
}

// A dashboard refresh must not re-resolve asset properties it already resolved.
// Only the timeseries query, whose time window actually changes, still reaches
// the historian.
func TestAssetMeasurementQueryServesRepeatedResolutionFromCache(t *testing.T) {
	t.Parallel()

	assetUUID := uuid.New()
	measurementUUID := uuid.New()
	assets := []schemas.Asset{{
		BaseModel: schemas.BaseModel{UUID: assetUUID, Name: "mixer"},
		AssetPath: `plant\line 1\mixer`,
	}}
	properties := []schemas.AssetProperty{{
		BaseModel:       schemas.BaseModel{UUID: uuid.New(), Name: "temperature"},
		AssetUUID:       assetUUID,
		MeasurementUUID: measurementUUID,
	}}

	ds, recorder := multiAssetQueryFixture(t, assets, properties, time.Minute)
	query := schemas.AssetMeasurementQuery{
		Assets:          []string{`plant\line 1\mixer`},
		AssetProperties: []string{"temperature"},
	}
	timeRange := backend.TimeRange{From: time.Unix(0, 0).UTC(), To: time.Unix(3600, 0).UTC()}

	first, err := ds.handleAssetMeasurementQuery(context.Background(), query, timeRange, time.Minute, 0, &schemas.HistorianInfo{Version: "v8.1.0"})
	require.NoError(t, err)
	second, err := ds.handleAssetMeasurementQuery(context.Background(), query, timeRange, time.Minute, 0, &schemas.HistorianInfo{Version: "v8.1.0"})
	require.NoError(t, err)

	assert.Len(t, recorder.queriesFor("/api/assets"), 1, "the asset lookup must be served from the cache on the repeat")
	assert.Len(t, recorder.queriesFor("/api/asset-properties"), 1, "the resolution must not reach the historian twice")
	assert.Len(t, recorder.queriesFor("/api/timeseries/query"), 2, "the timeseries query itself is never cached")

	require.Len(t, first, 1)
	require.Len(t, second, 1)
	assert.Equal(t, first[0].Name, second[0].Name, "a cached resolution must produce the same frames")
	assert.Equal(t, first[0].Rows(), second[0].Rows())
}

// A cold dashboard load is many panels resolving the same assets at once. They
// share one resolution request instead of one per panel.
func TestAssetMeasurementQueryCollapsesConcurrentPanelResolutions(t *testing.T) {
	t.Parallel()

	assetUUID := uuid.New()
	assets := []schemas.Asset{{
		BaseModel: schemas.BaseModel{UUID: assetUUID, Name: "mixer"},
		AssetPath: "mixer",
	}}
	properties := []schemas.AssetProperty{{
		BaseModel:       schemas.BaseModel{UUID: uuid.New(), Name: "temperature"},
		AssetUUID:       assetUUID,
		MeasurementUUID: uuid.New(),
	}}

	// The resolution is held open for the whole test, so a panel that fails to
	// join the in-flight request has to issue its own and be counted. A slow
	// scheduler can only delay a panel, so this cannot fail spuriously.
	release := make(chan struct{})
	resolutions := &atomic.Int64{}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/assets", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, assets)
	})
	mux.HandleFunc("GET /api/asset-properties", func(w http.ResponseWriter, _ *http.Request) {
		resolutions.Add(1)
		<-release
		writeJSON(w, properties)
	})
	mux.HandleFunc("POST /api/timeseries/query", func(w http.ResponseWriter, r *http.Request) {
		query := schemas.Query{}
		assert.NoError(t, json.NewDecoder(r.Body).Decode(&query))
		frames := make(data.Frames, 0, len(query.MeasurementUUIDs))
		for _, measurementUUID := range query.MeasurementUUIDs {
			frames = append(frames, measurementFrame(measurementUUID, 2))
		}
		writeArrowResponse(t, w, frames)
	})
	ds := newFakeHistorianDataSourceWithTTL(t, mux, time.Minute)

	query := schemas.AssetMeasurementQuery{Assets: []string{"mixer"}}
	timeRange := backend.TimeRange{From: time.Unix(0, 0).UTC(), To: time.Unix(3600, 0).UTC()}

	const panels = 12
	done := sync.WaitGroup{}
	done.Add(panels)
	for range panels {
		go func() {
			defer done.Done()
			_, err := ds.handleAssetMeasurementQuery(context.Background(), query, timeRange, time.Minute, 0, &schemas.HistorianInfo{Version: "v8.1.0"})
			assert.NoError(t, err)
		}()
	}

	require.Eventually(t, func() bool { return resolutions.Load() >= 1 }, time.Second, time.Millisecond,
		"no panel ever reached the resolution")
	assert.Never(t, func() bool { return resolutions.Load() > 1 }, 200*time.Millisecond, 5*time.Millisecond,
		"a cold dashboard load must resolve once, not once per panel")

	close(release)
	done.Wait()

	assert.Equal(t, int64(1), resolutions.Load())
}

// Reconfiguring an asset must reach dashboards once the TTL passes. The TTL is
// the documented bound on how long a stale measurement can be served.
func TestAssetMeasurementQueryPicksUpReconfiguredAssetAfterTTL(t *testing.T) {
	t.Parallel()

	assetUUID := uuid.New()
	oldMeasurementUUID := uuid.New()
	newMeasurementUUID := uuid.New()

	var (
		mu         sync.Mutex
		properties = []schemas.AssetProperty{{
			BaseModel:       schemas.BaseModel{UUID: uuid.New(), Name: "temperature"},
			AssetUUID:       assetUUID,
			MeasurementUUID: oldMeasurementUUID,
		}}
		queried []string
	)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/assets", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, []schemas.Asset{{
			BaseModel: schemas.BaseModel{UUID: assetUUID, Name: "mixer"},
			AssetPath: "mixer",
		}})
	})
	mux.HandleFunc("GET /api/asset-properties", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		current := slices.Clone(properties)
		mu.Unlock()
		writeJSON(w, current)
	})
	mux.HandleFunc("POST /api/timeseries/query", func(w http.ResponseWriter, r *http.Request) {
		query := schemas.Query{}
		assert.NoError(t, json.NewDecoder(r.Body).Decode(&query))
		mu.Lock()
		queried = append(queried, query.MeasurementUUIDs...)
		mu.Unlock()
		frames := make(data.Frames, 0, len(query.MeasurementUUIDs))
		for _, measurementUUID := range query.MeasurementUUIDs {
			frames = append(frames, measurementFrame(measurementUUID, 2))
		}
		writeArrowResponse(t, w, frames)
	})

	// A short TTL keeps the test fast. The cache unit tests cover expiry on a
	// fake clock; this one checks the reconfigured measurement reaches the panel.
	const ttl = 20 * time.Millisecond
	ds := newFakeHistorianDataSourceWithTTL(t, mux, ttl)
	query := schemas.AssetMeasurementQuery{Assets: []string{"mixer"}}
	timeRange := backend.TimeRange{From: time.Unix(0, 0).UTC(), To: time.Unix(3600, 0).UTC()}

	_, err := ds.handleAssetMeasurementQuery(context.Background(), query, timeRange, time.Minute, 0, &schemas.HistorianInfo{Version: "v8.1.0"})
	require.NoError(t, err)

	mu.Lock()
	properties[0].MeasurementUUID = newMeasurementUUID
	mu.Unlock()

	time.Sleep(20 * ttl)
	_, err = ds.handleAssetMeasurementQuery(context.Background(), query, timeRange, time.Minute, 0, &schemas.HistorianInfo{Version: "v8.1.0"})
	require.NoError(t, err)

	mu.Lock()
	defer mu.Unlock()
	assert.Equal(t, []string{oldMeasurementUUID.String(), newMeasurementUUID.String()}, queried,
		"the second refresh must query the reconfigured measurement")
}

// A health check reports whether the historian is reachable right now, so it
// must never be served from the cache.
func TestCheckHealthAlwaysReachesTheHistorian(t *testing.T) {
	t.Parallel()

	recorder := &requestRecorder{}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/timeseries-databases", func(w http.ResponseWriter, r *http.Request) {
		recorder.record(r.URL.Path, r.URL.RawQuery)
		writeJSON(w, []schemas.TimeseriesDatabase{{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "factory"}}})
	})
	ds := newFakeHistorianDataSourceWithTTL(t, mux, time.Minute)

	for range 3 {
		result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
		require.NoError(t, err)
		require.Equal(t, backend.HealthStatusOk, result.Status)
	}

	assert.Len(t, recorder.queriesFor("/api/timeseries-databases"), 3, "the health check must not be cached")
}

// A measurement query filtered on a database name that resolves to nothing must
// return no measurements. Dropping the filter instead would search every
// database, and with the resolution cache a just-created database stays
// unresolvable for up to the TTL.
func TestGetMeasurementsWithUnresolvableDatabaseFilterReturnsNothing(t *testing.T) {
	t.Parallel()

	factory := schemas.TimeseriesDatabase{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "factory"}}
	measurement := schemas.Measurement{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "temperature"}}

	newFixture := func(t *testing.T) (*HistorianDataSource, *requestRecorder) {
		t.Helper()
		recorder := &requestRecorder{}
		mux := http.NewServeMux()
		mux.HandleFunc("GET /api/timeseries-databases", func(w http.ResponseWriter, _ *http.Request) {
			_ = json.NewEncoder(w).Encode([]schemas.TimeseriesDatabase{factory})
		})
		mux.HandleFunc("GET /api/measurements", func(w http.ResponseWriter, r *http.Request) {
			recorder.record(r.URL.Path, r.URL.RawQuery)
			_ = json.NewEncoder(w).Encode([]schemas.Measurement{measurement})
		})
		return newFakeHistorianDataSource(t, mux), recorder
	}

	t.Run("an unresolvable name yields no measurements and no search", func(t *testing.T) {
		t.Parallel()
		ds, recorder := newFixture(t)
		measurements, err := ds.getMeasurements(t.Context(), schemas.MeasurementQuery{
			Measurement: "temperature",
			Databases:   []string{"just-created"},
		}, 50)
		require.NoError(t, err)

		assert.Empty(t, measurements, "a database filter that resolves to nothing must not match any measurement")
		assert.Empty(t, recorder.queriesFor("/api/measurements"), "the search must not go out without the database filter")
	})

	t.Run("a resolvable name keeps its filter", func(t *testing.T) {
		t.Parallel()
		ds, recorder := newFixture(t)
		measurements, err := ds.getMeasurements(t.Context(), schemas.MeasurementQuery{
			Measurement: "temperature",
			Databases:   []string{"factory"},
		}, 50)
		require.NoError(t, err)

		require.Equal(t, []string{measurement.UUID.String()}, measurements)
		queries := recorder.queriesFor("/api/measurements")
		require.Len(t, queries, 1)
		parsed, err := url.ParseQuery(queries[0])
		require.NoError(t, err)
		assert.Equal(t, factory.UUID.String(), parsed.Get("DatabaseUUIDs[0]"), "the resolved filter must reach the historian")
	})
}
