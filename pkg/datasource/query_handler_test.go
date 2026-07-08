package datasource

import (
	"context"
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
