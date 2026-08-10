// Command mockhistorian is a minimal fake Factry Historian REST API used by the
// Playwright e2e suite. It serves only the endpoints the datasource backend
// calls during the health check and a Measurements query, returning
// deterministic fixtures. Timeseries data is returned as protobuf-wrapped Arrow
// frames, matching the real API contract that pkg/api/query.go decodes.
package main

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"strconv"
	"time"

	arrow_pb "github.com/factrylabs/factry-historian-datasource.git/pkg/proto"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"google.golang.org/protobuf/proto"
)

// listenAddr is the address the datasource points at via the e2e provisioning
// (http://mockhistorian:8000).
const listenAddr = ":8000"

// Fixtures returned by the metadata endpoints. UUIDs are fixed so tests can
// assert against them if needed.
var (
	databaseUUID    = uuid.MustParse("11111111-1111-1111-1111-111111111111")
	measurementUUID = uuid.MustParse("22222222-2222-2222-2222-222222222222")

	database = schemas.TimeseriesDatabase{
		BaseModel:              schemas.BaseModel{UUID: databaseUUID, Name: "historian"},
		TimeseriesDatabaseType: &schemas.TimeseriesDatabaseType{Name: "QuestDB"},
		Description:            "Mock timeseries database for e2e tests",
	}

	measurement = schemas.Measurement{
		BaseModel:    schemas.BaseModel{UUID: measurementUUID, Name: "e2e.motor.speed"},
		Database:     &database,
		DatabaseUUID: databaseUUID,
		Datatype:     "float64",
		Status:       "Good",
		Description:  "Mock measurement for e2e tests",
	}
)

func main() {
	server := &http.Server{
		Addr:              listenAddr,
		Handler:           logRequests(newMux()),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
	}

	log.Printf("mock historian listening on %s", listenAddr)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("mock historian: %v", err)
	}
}

// logRequests logs every request the mock serves. When an e2e spec fails, this
// log is the quickest way to see which calls the datasource actually made.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// strconv.Quote escapes any CR/LF, so a crafted path cannot forge extra
		// lines in the log.
		log.Printf("%s %s", strconv.Quote(r.Method), strconv.Quote(r.URL.RequestURI()))
		next.ServeHTTP(w, r)
	})
}

// newMux wires the routes. It is a separate function so tests can exercise the
// handlers without binding a socket.
func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/timeseries-databases", writeJSON([]schemas.TimeseriesDatabase{database}))
	mux.HandleFunc("GET /api/info", writeJSON(schemas.HistorianInfo{Version: "8.2.0", APIVersion: "1.0"}))
	mux.HandleFunc("GET /api/measurements", writeJSON([]schemas.Measurement{measurement}))
	mux.HandleFunc("POST /api/timeseries/query", handleTimeseriesQuery)
	mux.HandleFunc("/", handleFallback)
	return mux
}

// writeJSON returns a handler that encodes a fixed value as JSON. The datasource
// unmarshals into pkg/schemas structs, so reusing those structs here keeps the
// field names (PascalCase) in lockstep with the code under test.
func writeJSON(v any) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(v); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

// handleTimeseriesQuery answers POST /api/timeseries/query with a single Arrow
// frame (time column + float64 value column) wrapped in a protobuf
// arrow_pb.DataResponse, exactly what pkg/api/query.go expects to unmarshal.
// Points are spread across the requested [Start, End] range so they always fall
// inside the panel's time window.
func handleTimeseriesQuery(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	query := schemas.Query{}
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	frameBytes, err := buildFrame(query).MarshalArrow()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	out, err := proto.Marshal(&arrow_pb.DataResponse{Frames: [][]byte{frameBytes}})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/protobuf")
	if _, err := w.Write(out); err != nil {
		log.Printf("write query response: %v", err)
	}
}

// buildFrame produces a deterministic sine-wave series spanning the query range.
func buildFrame(query schemas.Query) *data.Frame {
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
		values[i] = 20 + 5*math.Sin(float64(i))
	}

	return data.NewFrame(measurement.Name,
		data.NewField("time", nil, times),
		data.NewField(measurement.Name, nil, values),
	)
}

// handleFallback keeps the plugin UI from erroring on resource calls this mock
// does not implement (assets, events, tags, ...) by returning an empty array.
func handleFallback(w http.ResponseWriter, r *http.Request) {
	log.Printf("unhandled %s %s -> empty array", strconv.Quote(r.Method), strconv.Quote(r.URL.Path))
	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write([]byte("[]")); err != nil {
		log.Printf("write fallback response: %v", err)
	}
}
