package datasource

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	arrow_pb "github.com/factrylabs/factry-historian-datasource.git/pkg/proto"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
)

// queryResponseFrame builds a single frame carrying the metadata getFrameID relies on
// (MeasurementUUID + optional groupby Labels) so it survives the arrow round-trip.
func queryResponseFrame(t *testing.T, measurementUUID string, labels map[string]interface{}, values []float64) *data.Frame {
	t.Helper()
	times := make([]time.Time, len(values))
	for i := range values {
		times[i] = time.Unix(int64(i*60), 0)
	}
	frame := data.NewFrame("",
		data.NewField("time", nil, times),
		data.NewField(valueFieldName, nil, values),
	)
	custom := map[string]interface{}{
		"MeasurementUUID": measurementUUID,
		"MeasurementName": "Level",
	}
	if labels != nil {
		custom["Labels"] = labels
	}
	frame.Meta = &data.FrameMeta{Custom: custom}
	return frame
}

// TestHandleQuery_IncludeLastKnownPoint_NoTags_SingleSeries reproduces the duplicate-series bug:
// with "include last known point" enabled and no tag filter, handleQuery must return a single
// merged series. The historian echoes any query tag back as a groupby label, so the catch-all
// status=Good last-known query (which should only run when the user supplied tags) produces a
// spurious second series {status: Good}.
func TestHandleQuery_IncludeLastKnownPoint_NoTags_SingleSeries(t *testing.T) {
	var mu sync.Mutex
	var queries []schemas.Query

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		var q schemas.Query
		require.NoError(t, json.Unmarshal(body, &q))

		mu.Lock()
		queries = append(queries, q)
		mu.Unlock()

		var frames data.Frames
		switch {
		case q.Aggregation == nil:
			// Main query: the real series, no groupby labels.
			frames = data.Frames{queryResponseFrame(t, "uuid-1", nil, []float64{10, 20, 30})}
		case q.Tags["status"] == "Good":
			// Catch-all last-known query: the historian echoes the status tag as a label.
			frames = data.Frames{queryResponseFrame(t, "uuid-1", map[string]interface{}{"status": "Good"}, []float64{5})}
		default:
			// Per-frame last-known query: same identity as the main series.
			frames = data.Frames{queryResponseFrame(t, "uuid-1", nil, []float64{5})}
		}

		arrowBytes, err := frames.MarshalArrow()
		require.NoError(t, err)
		out, err := proto.Marshal(&arrow_pb.DataResponse{Frames: arrowBytes})
		require.NoError(t, err)
		_, _ = w.Write(out)
	}))
	defer srv.Close()

	client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
	require.NoError(t, err)
	ds := &HistorianDataSource{API: client}

	start := time.Unix(0, 0)
	end := time.Unix(3600, 0)
	query := schemas.Query{
		MeasurementUUIDs: []string{"uuid-1"},
		Start:            start,
		End:              &end,
	}
	options := schemas.MeasurementQueryOptions{IncludeLastKnownPoint: true}

	result, err := ds.handleQuery(context.Background(), query, options)
	require.NoError(t, err)

	require.Len(t, result, 1, "include last known point with no tags must return a single merged series, not a spurious {status: Good} series")

	mu.Lock()
	defer mu.Unlock()
	for _, q := range queries {
		if q.Aggregation != nil && q.Tags["status"] == "Good" {
			t.Fatalf("catch-all last-known query with status=Good tag must not be issued when the query has no tags")
		}
	}
}

// TestHandleQuery_IncludeLastKnownPoint_WithTags_RunsSingleLastQuery verifies that when the user
// supplies tags, handleQuery issues exactly one last-known query carrying those tags (and no
// per-frame queries).
func TestHandleQuery_IncludeLastKnownPoint_WithTags_RunsSingleLastQuery(t *testing.T) {
	var mu sync.Mutex
	var lastQueries []schemas.Query

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		var q schemas.Query
		require.NoError(t, json.Unmarshal(body, &q))

		var frames data.Frames
		if q.Aggregation == nil {
			frames = data.Frames{queryResponseFrame(t, "uuid-1", nil, []float64{10, 20, 30})}
		} else {
			mu.Lock()
			lastQueries = append(lastQueries, q)
			mu.Unlock()
			frames = data.Frames{queryResponseFrame(t, "uuid-1", nil, []float64{5})}
		}

		arrowBytes, err := frames.MarshalArrow()
		require.NoError(t, err)
		out, err := proto.Marshal(&arrow_pb.DataResponse{Frames: arrowBytes})
		require.NoError(t, err)
		_, _ = w.Write(out)
	}))
	defer srv.Close()

	client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
	require.NoError(t, err)
	ds := &HistorianDataSource{API: client}

	start := time.Unix(0, 0)
	end := time.Unix(3600, 0)
	query := schemas.Query{
		MeasurementUUIDs: []string{"uuid-1"},
		Start:            start,
		End:              &end,
		Tags:             map[string]string{"line": "1"},
	}
	options := schemas.MeasurementQueryOptions{IncludeLastKnownPoint: true}

	result, err := ds.handleQuery(context.Background(), query, options)
	require.NoError(t, err)
	require.Len(t, result, 1)

	mu.Lock()
	defer mu.Unlock()
	require.Len(t, lastQueries, 1, "exactly one last-known query must run when tags are supplied")
	assert.Equal(t, "1", lastQueries[0].Tags["line"], "the last-known query must carry the user's tags")
}
