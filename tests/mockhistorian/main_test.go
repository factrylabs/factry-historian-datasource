package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
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

func TestMeasurementsFixture(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/measurements?Keyword=e2e.motor.speed", "")
	require.Equal(t, http.StatusOK, rec.Code)

	var got []schemas.Measurement
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, measurementUUID, got[0].UUID)
	assert.Equal(t, databaseUUID, got[0].DatabaseUUID)
}

// TestTimeseriesQueryDecodesLikeBackend proves the query response is
// byte-faithful: it decodes through the exact path pkg/api/query.go uses
// (proto.Unmarshal into arrow_pb.DataResponse, then data.UnmarshalArrowFrames).
func TestTimeseriesQueryDecodesLikeBackend(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	body := schemas.Query{
		MeasurementUUIDs: []string{measurementUUID.String()},
		Start:            start,
		End:              &end,
	}
	raw, err := json.Marshal(body)
	require.NoError(t, err)

	rec := doRequest(t, http.MethodPost, "/api/timeseries/query", string(raw))
	require.Equal(t, http.StatusOK, rec.Code)

	dataResponse := arrow_pb.DataResponse{}
	require.NoError(t, proto.Unmarshal(rec.Body.Bytes(), &dataResponse))
	require.Empty(t, dataResponse.GetError())

	frames, err := data.UnmarshalArrowFrames(dataResponse.GetFrames())
	require.NoError(t, err)
	require.Len(t, frames, 1)
	require.Len(t, frames[0].Fields, 2)

	timeField := frames[0].Fields[0]
	valueField := frames[0].Fields[1]
	assert.Equal(t, "time", timeField.Name)
	assert.Positive(t, timeField.Len())
	assert.Equal(t, timeField.Len(), valueField.Len())

	// Every timestamp must sit inside the requested range so points render.
	for i := 0; i < timeField.Len(); i++ {
		ts, ok := timeField.At(i).(time.Time)
		require.True(t, ok)
		assert.False(t, ts.Before(start))
		assert.False(t, ts.After(end))
	}
}

func TestFallbackReturnsEmptyArray(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/assets", "")
	require.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, "[]", rec.Body.String())
}

func doRequest(t *testing.T, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()

	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequestWithContext(t.Context(), method, target, reader)
	rec := httptest.NewRecorder()
	newMux().ServeHTTP(rec, req)
	return rec
}
