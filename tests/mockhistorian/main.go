// Command mockhistorian is a fake Factry Historian REST API used by the
// Playwright e2e suite. It serves the endpoints the datasource backend calls
// (health check, metadata, timeseries, events), returning deterministic
// fixtures. Timeseries data is returned as protobuf-wrapped Arrow frames,
// matching the real API contract that pkg/api/query.go decodes; JSON payloads
// reuse pkg/schemas so field names stay in lockstep with the code under test.
//
// Fixtures live in fixtures.go, the JSON metadata handlers in handlers.go, the
// Arrow/protobuf handlers in timeseries.go and the event handlers in events.go.
package main

import (
	"log"
	"net/http"
	"strconv"
	"time"
)

// listenAddr is the address the datasource points at via the e2e provisioning
// (http://mockhistorian:8000).
const listenAddr = ":8000"

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
	mux.HandleFunc("GET /api/info", handleInfo)
	mux.HandleFunc("GET /api/timeseries-databases", handleTimeseriesDatabases)
	mux.HandleFunc("GET /api/collectors", handleCollectors)
	mux.HandleFunc("GET /api/measurements", handleMeasurements)
	mux.HandleFunc("GET /api/measurements/{uuid}", handleMeasurementByUUID)
	mux.HandleFunc("GET /api/assets", handleAssets)
	mux.HandleFunc("GET /api/asset-properties", handleAssetProperties)
	mux.HandleFunc("GET /api/event-types", handleEventTypes)
	mux.HandleFunc("GET /api/event-type-properties", handleEventTypeProperties)
	mux.HandleFunc("GET /api/event-type-properties/{uuid}/values", handleEventPropertyValues)
	mux.HandleFunc("GET /api/event-configurations", handleEventConfigurations)
	mux.HandleFunc("GET /api/events", handleEvents)
	mux.HandleFunc("POST /api/timeseries/query", handleTimeseriesQuery)
	mux.HandleFunc("POST /api/timeseries/{uuid}/raw-query", handleRawQuery)
	mux.HandleFunc("GET /api/timeseries/measurements/{uuid}/tags", handleTagKeys)
	mux.HandleFunc("GET /api/timeseries/measurements/{uuid}/tags/{tagKey}", handleTagValues)
	mux.HandleFunc("/", handleFallback)
	return mux
}

// handleFallback keeps the plugin UI from erroring on calls this mock does not
// implement by returning an empty array.
func handleFallback(w http.ResponseWriter, r *http.Request) {
	log.Printf("unhandled %s %s -> empty array", strconv.Quote(r.Method), strconv.Quote(r.URL.Path))
	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write([]byte("[]")); err != nil {
		log.Printf("write fallback response: %v", err)
	}
}
