package datasource

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
// a HistorianDataSource whose API client points at it.
func newFakeHistorianDataSource(t *testing.T, mux *http.ServeMux) *HistorianDataSource {
	t.Helper()
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	historianAPI, err := api.NewAPIWithToken(server.URL, "token", "org")
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

// assetQueryFixture wires up a fake historian with one asset and the given
// asset properties. The timeseries endpoint returns one frame per requested
// measurement UUID.
func assetQueryFixture(t *testing.T, assetUUID uuid.UUID, properties []schemas.AssetProperty) *HistorianDataSource {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/assets", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, []schemas.Asset{{
			BaseModel: schemas.BaseModel{UUID: assetUUID, Name: "plant"},
			AssetPath: "plant",
		}})
	})
	mux.HandleFunc("GET /api/asset-properties", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, properties)
	})
	mux.HandleFunc("POST /api/timeseries/query", func(w http.ResponseWriter, r *http.Request) {
		query := schemas.Query{}
		assert.NoError(t, json.NewDecoder(r.Body).Decode(&query))
		frames := data.Frames{}
		for _, measurementUUID := range query.MeasurementUUIDs {
			frames = append(frames, measurementFrame(measurementUUID, 2))
		}
		writeArrowResponse(t, w, frames)
	})
	return newFakeHistorianDataSource(t, mux)
}
