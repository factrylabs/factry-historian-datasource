package datasource

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/pkg/errors"
)

// HistorianResourceQuery is a struct for a resource query
type HistorianResourceQuery struct {
	QueryParams interface{} `json:",omitempty"`
	Type        string      `json:"type"`
}

// GetResourceQuery unmarshals a resource query
func GetResourceQuery(body []byte) (*HistorianResourceQuery, error) {
	query := HistorianResourceQuery{}
	if err := json.Unmarshal(body, &query); err != nil {
		return nil, ErrorFailedUnmarshalingResourceQuery
	}

	if query.Type == "" {
		return nil, ErrorInvalidResourceCallQuery
	}

	return &query, nil
}

// CallResource is used to handle resource calls
func (ds *HistorianDataSource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return ds.resourceHandler.CallResource(ctx, req, sender)
}

func (ds *HistorianDataSource) initializeResourceRoutes() backend.CallResourceHandler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /measurements", handleJSON(ds.handleMeasurements))
	mux.HandleFunc("GET /measurements/{uuid}", handleJSON(ds.handleMeasurementsByUUID))
	mux.HandleFunc("GET /collectors", handleJSON(ds.handleCollectors))
	mux.HandleFunc("GET /databases", handleJSON(ds.handleDatabases))
	mux.HandleFunc("GET /assets", handleJSON(ds.handleAssets))
	mux.HandleFunc("GET /asset-properties", handleJSON(ds.handleAssetProperties))
	mux.HandleFunc("GET /event-types", handleJSON(ds.handleEventTypes))
	mux.HandleFunc("GET /event-type-properties", handleJSON(ds.handleEventTypeProperties))
	mux.HandleFunc("GET /event-configurations", handleJSON(ds.handleEventConfigurations))
	mux.HandleFunc("GET /tag-keys", handleJSON(ds.handleTagKeys))
	mux.HandleFunc("GET /tag-values", handleJSON(ds.handleTagValues))
	mux.HandleFunc("GET /info", handleJSON(ds.handleHistorianInfo))
	mux.HandleFunc("GET /event-property-values/{uuid}", handleJSON(ds.handleEventPropertyValues))
	return httpadapter.New(mux)
}

func handleJSON(f func(_ http.ResponseWriter, req *http.Request) (interface{}, error)) http.HandlerFunc {
	return func(rw http.ResponseWriter, req *http.Request) {
		response, err := f(rw, req)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusBadRequest)
			return
		}

		if response == nil {
			http.Error(rw, "response is nil", http.StatusInternalServerError)
			return
		}

		// Marshal the response to JSON
		jsonResponse, err := json.Marshal(response)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		// Set the content type and write the response
		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(http.StatusOK)
		if _, err := rw.Write(jsonResponse); err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
		}
	}
}

func (ds *HistorianDataSource) handleMeasurements(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetMeasurements(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleMeasurementsByUUID(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	uuid := req.PathValue("uuid")
	if uuid == "" {
		return nil, errors.New("uuid is required")
	}
	return ds.API.GetMeasurement(req.Context(), uuid)
}

func (ds *HistorianDataSource) handleCollectors(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetCollectors(req.Context())
}

func (ds *HistorianDataSource) handleDatabases(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetTimeseriesDatabases(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleAssets(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetAssets(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleAssetProperties(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetAssetProperties(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleEventTypes(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetEventTypes(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleEventTypeProperties(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetEventTypeProperties(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleEventConfigurations(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetEventConfigurations(req.Context())
}

func (ds *HistorianDataSource) handleTagKeys(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	resourcePath := strings.Split(req.URL.Path, "/")
	return handleGetTagKeys(req.Context(), ds.API, resourcePath, req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleTagValues(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	resourcePath := strings.Split(req.URL.Path, "/")
	return handleGetTagValues(req.Context(), ds.API, resourcePath, req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleHistorianInfo(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetInfo(req.Context())
}

func (ds *HistorianDataSource) handleEventPropertyValues(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	eventTypePropertyUUID := req.PathValue("uuid")
	if eventTypePropertyUUID == "" {
		return nil, errors.New("uuid is required")
	}

	request := schemas.EventPropertyValuesRequest{}
	if err := ds.Decoder.Decode(&request, req.URL.Query()); err != nil {
		return nil, err
	}

	o, err := ds.API.GetDistinctEventPropertyValues(req.Context(), eventTypePropertyUUID, request)
	if err != nil {
		return nil, err
	}
	return o, nil
}
