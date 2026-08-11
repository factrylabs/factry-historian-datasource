package main

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"time"

	arrow_pb "github.com/factrylabs/factry-historian-datasource.git/pkg/proto"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"google.golang.org/protobuf/proto"
)

// writeFrames marshals frames to Arrow and wraps them in the protobuf
// DataResponse, exactly what pkg/api/query.go expects to unmarshal.
func writeFrames(w http.ResponseWriter, frames data.Frames) {
	frameBytes := make([][]byte, 0, len(frames))
	for _, frame := range frames {
		b, err := frame.MarshalArrow()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		frameBytes = append(frameBytes, b)
	}

	out, err := proto.Marshal(&arrow_pb.DataResponse{Frames: frameBytes})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/protobuf")
	if _, err := w.Write(out); err != nil {
		log.Printf("write query response: %v", err)
	}
}

// handleTimeseriesQuery answers POST /api/timeseries/query with one Arrow
// frame per requested measurement, carrying the same Meta.Custom keys the
// real historian sets (MeasurementUUID etc.), which the backend uses to name
// frames and resolve asset properties.
func handleTimeseriesQuery(w http.ResponseWriter, r *http.Request) {
	defer func() { _ = r.Body.Close() }()

	query := schemas.Query{}
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	requested := []schemas.Measurement{}
	for _, raw := range query.MeasurementUUIDs {
		if id, err := uuid.Parse(raw); err == nil {
			if measurement, ok := measurementByUUID(id); ok {
				requested = append(requested, measurement)
			}
		}
	}
	for _, byName := range query.Measurements {
		for i := range measurements {
			if measurements[i].Name == byName.Measurement {
				requested = append(requested, measurements[i])
			}
		}
	}

	frames := make(data.Frames, 0, len(requested))
	for i := range requested {
		frames = append(frames, buildFrame(query, requested[i], float64(i)))
	}
	writeFrames(w, frames)
}

// buildFrame produces a deterministic sine-wave series spanning the query
// range. The offset separates the series of different measurements so tests
// can tell them apart.
func buildFrame(query schemas.Query, measurement schemas.Measurement, offset float64) *data.Frame {
	const points = 10

	start := query.Start
	end := time.Now()
	if query.End != nil {
		end = *query.End
	}
	if !end.After(start) {
		end = start.Add(time.Hour)
	}
	step := end.Sub(start) / time.Duration(points)

	times := make([]time.Time, points)
	values := make([]float64, points)
	for i := range points {
		times[i] = start.Add(step * time.Duration(i))
		values[i] = 20 + 10*offset + 5*math.Sin(float64(i))
	}

	frame := data.NewFrame(measurement.Name,
		data.NewField("time", nil, times),
		data.NewField("value", nil, values),
	)
	frame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
			"MeasurementUUID": measurement.UUID.String(),
			"MeasurementName": measurement.Name,
			"DatabaseUUID":    measurement.DatabaseUUID.String(),
			"DatabaseName":    database.Name,
			"Description":     measurement.Description,
			"Labels":          map[string]interface{}{"status": "Good"},
		},
	}
	return frame
}

// handleRawQuery answers POST /api/timeseries/{uuid}/raw-query with a fixed
// table-shaped frame, enough for the Raw query editor to render rows.
func handleRawQuery(w http.ResponseWriter, r *http.Request) {
	defer func() { _ = r.Body.Close() }()

	if _, err := uuid.Parse(r.PathValue("uuid")); err != nil {
		http.Error(w, "invalid database uuid", http.StatusBadRequest)
		return
	}

	query := schemas.RawQuery{}
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if query.Query == "" {
		http.Error(w, "empty query", http.StatusBadRequest)
		return
	}

	now := time.Now().UTC().Truncate(time.Minute)
	frame := data.NewFrame("",
		data.NewField("time", nil, []time.Time{now.Add(-2 * time.Minute), now.Add(-time.Minute), now}),
		data.NewField("raw_value", nil, []float64{1, 2, 3}),
		data.NewField("label", nil, []string{"raw-row-1", "raw-row-2", "raw-row-3"}),
	)
	writeFrames(w, data.Frames{frame})
}

// handleTagKeys answers GET /api/timeseries/measurements/{uuid}/tags. The
// backend extracts nullable strings from the "tagKey" column.
func handleTagKeys(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("uuid"))
	if err != nil {
		http.Error(w, "invalid uuid", http.StatusBadRequest)
		return
	}

	keys := []*string{}
	for key := range tagsPerMeasurement[id] {
		k := key
		keys = append(keys, &k)
	}
	frame := data.NewFrame("tags", data.NewField("tagKey", nil, keys))
	writeFrames(w, data.Frames{frame})
}

// handleTagValues answers GET /api/timeseries/measurements/{uuid}/tags/{key}.
// The backend extracts nullable strings from the "value" column.
func handleTagValues(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("uuid"))
	if err != nil {
		http.Error(w, "invalid uuid", http.StatusBadRequest)
		return
	}

	values := []*string{}
	for _, value := range tagsPerMeasurement[id][r.PathValue("tagKey")] {
		v := value
		values = append(values, &v)
	}
	frame := data.NewFrame("tagValues", data.NewField("value", nil, values))
	writeFrames(w, data.Frames{frame})
}
