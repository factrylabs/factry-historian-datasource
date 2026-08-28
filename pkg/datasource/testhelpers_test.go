package datasource

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	arrow_pb "github.com/factrylabs/factry-historian-datasource.git/pkg/proto"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/go-playground/form"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
)

// measurementFrame builds a frame in the shape the historian returns for a
// timeseries query: a time and a value column plus the standard custom meta.
func measurementFrame(measurementUUID string, rows int) *data.Frame {
	times := make([]time.Time, 0, rows)
	values := make([]*float64, 0, rows)
	for i := range rows {
		times = append(times, time.Unix(int64(60*i), 0).UTC())
		values = append(values, new(float64(i)))
	}
	frame := data.NewFrame("",
		data.NewField("time", nil, times),
		data.NewField(valueFieldName, nil, values),
	)
	frame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
			"MeasurementUUID": measurementUUID,
			"MeasurementName": "measurement-" + measurementUUID,
			"DatabaseName":    "factory",
			"Labels":          map[string]interface{}{},
		},
	}
	return frame
}

// newFakeHistorianDataSource spins up a fake historian HTTP server and returns
// a HistorianDataSource whose API client points at it. The resolution caches are
// disabled, so every lookup reaches the fake historian.
func newFakeHistorianDataSource(t *testing.T, mux *http.ServeMux) *HistorianDataSource {
	t.Helper()
	return newFakeHistorianDataSourceWithTTL(t, mux, 0)
}

// newFakeHistorianDataSourceWithTTL is newFakeHistorianDataSource with the
// resolution caches enabled for the given TTL.
func newFakeHistorianDataSourceWithTTL(t *testing.T, mux *http.ServeMux, resolutionCacheTTL time.Duration) *HistorianDataSource {
	t.Helper()
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	historianAPI, err := api.NewAPIWithOptions(api.Options{
		URL:                server.URL,
		Token:              "token",
		Organization:       "org",
		ResolutionCacheTTL: resolutionCacheTTL,
	})
	require.NoError(t, err)

	return &HistorianDataSource{
		API:     historianAPI,
		Decoder: form.NewDecoder(),
	}
}

func writeArrowResponse(t *testing.T, w http.ResponseWriter, frames data.Frames) {
	t.Helper()
	encoded := make([][]byte, 0, len(frames))
	for _, frame := range frames {
		b, err := frame.MarshalArrow()
		require.NoError(t, err)
		encoded = append(encoded, b)
	}
	body, err := proto.Marshal(&arrow_pb.DataResponse{Frames: encoded})
	require.NoError(t, err)
	w.Header().Set("Content-Type", "application/protobuf")
	_, err = w.Write(body)
	require.NoError(t, err)
}

// requestRecorder collects the raw query string of every request a fixture
// serves, keyed by request path. Tests use it to assert how often the
// datasource reached the historian and with which query.
type requestRecorder struct {
	mu      sync.Mutex
	queries map[string][]string
}

func (r *requestRecorder) record(path string, rawQuery string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.queries == nil {
		r.queries = map[string][]string{}
	}
	r.queries[path] = append(r.queries[path], rawQuery)
}

// queriesFor returns the raw query strings seen on path, in arrival order.
func (r *requestRecorder) queriesFor(path string) []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.queries[path])
}

// assetQueryFixture wires up a fake historian with one asset and the given
// asset properties. The timeseries endpoint returns one frame per requested
// measurement UUID.
func assetQueryFixture(t *testing.T, assetUUID uuid.UUID, properties []schemas.AssetProperty) *HistorianDataSource {
	t.Helper()
	ds, _ := multiAssetQueryFixture(t, []schemas.Asset{{
		BaseModel: schemas.BaseModel{UUID: assetUUID, Name: "plant"},
		AssetPath: "plant",
	}}, properties, 0)
	return ds
}

// multiAssetQueryFixture wires up a fake historian that serves the given assets
// and asset properties, and records every request it receives. The timeseries
// endpoint returns one frame per requested measurement UUID.
func multiAssetQueryFixture(t *testing.T, assets []schemas.Asset, properties []schemas.AssetProperty, resolutionCacheTTL time.Duration) (*HistorianDataSource, *requestRecorder) {
	t.Helper()
	recorder := &requestRecorder{}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/assets", func(w http.ResponseWriter, r *http.Request) {
		recorder.record(r.URL.Path, r.URL.RawQuery)
		writeJSON(w, assets)
	})
	mux.HandleFunc("GET /api/asset-properties", func(w http.ResponseWriter, r *http.Request) {
		recorder.record(r.URL.Path, r.URL.RawQuery)
		writeJSON(w, properties)
	})
	mux.HandleFunc("POST /api/timeseries/query", func(w http.ResponseWriter, r *http.Request) {
		query := schemas.Query{}
		assert.NoError(t, json.NewDecoder(r.Body).Decode(&query))
		recorder.record(r.URL.Path, r.URL.RawQuery)
		frames := data.Frames{}
		for _, measurementUUID := range query.MeasurementUUIDs {
			frames = append(frames, measurementFrame(measurementUUID, 2))
		}
		writeArrowResponse(t, w, frames)
	})
	return newFakeHistorianDataSourceWithTTL(t, mux, resolutionCacheTTL), recorder
}
