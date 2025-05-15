package datasource

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"
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
	mux.HandleFunc("GET /measurements", handleJSON(ds.handleGetMeasurements))
	mux.HandleFunc("GET /measurements/{uuid}", handleJSON(ds.handleGetMeasurementByUUID))
	mux.HandleFunc("GET /measurements/{uuid}/tags", handleJSON(ds.handleGetTagKeysForMeasurement))
	mux.HandleFunc("GET /measurements/{uuid}/tags/{tagKey}", handleJSON(ds.handleGetTagValueForMeasurementAndTagKey))

	mux.HandleFunc("GET /collectors", handleJSON(ds.handleGetCollectors))

	mux.HandleFunc("GET /databases", handleJSON(ds.handleGetDatabases))

	mux.HandleFunc("GET /assets", handleJSON(ds.handleGetAssets))

	mux.HandleFunc("GET /asset-properties", handleJSON(ds.handleGetAssetProperties))

	mux.HandleFunc("GET /event-types", handleJSON(ds.handleGetEventTypes))

	mux.HandleFunc("GET /event-type-properties", handleJSON(ds.handleGetEventTypeProperties))

	mux.HandleFunc("GET /event-configurations", handleJSON(ds.handleGetEventConfigurations))

	mux.HandleFunc("GET /tags", handleJSON(ds.handleGetTagKeys))
	mux.HandleFunc("GET /tags/{tagKey}", handleJSON(ds.handleGetTagValues))

	mux.HandleFunc("GET /info", handleJSON(ds.handleGetHistorianInfo))

	mux.HandleFunc("GET /event-property-values/{uuid}", handleJSON(ds.handleGetEventPropertyValues))

	mux.HandleFunc("/", handleJSON(ds.fallBackHandler))
	return httpadapter.New(mux)
}

func (*HistorianDataSource) fallBackHandler(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return nil, errors.Errorf("resource %s %s not found", req.Method, req.URL.Path)
}

func (ds *HistorianDataSource) handleGetMeasurements(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetMeasurements(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleGetMeasurementByUUID(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	uuid := req.PathValue("uuid")
	if uuid == "" {
		return nil, errors.New("uuid is required")
	}
	return ds.API.GetMeasurement(req.Context(), uuid)
}

func (ds *HistorianDataSource) handleGetCollectors(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetCollectors(req.Context())
}

func (ds *HistorianDataSource) handleGetDatabases(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetTimeseriesDatabases(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleGetAssets(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetAssets(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleGetAssetProperties(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetAssetProperties(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleGetEventTypes(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetEventTypes(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleGetEventTypeProperties(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetEventTypeProperties(req.Context(), req.URL.RawQuery)
}

func (ds *HistorianDataSource) handleGetEventConfigurations(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetEventConfigurations(req.Context())
}

func (ds *HistorianDataSource) handleGetTagKeys(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	measurements, err := ds.API.GetMeasurements(req.Context(), req.URL.RawQuery)
	if err != nil {
		return nil, err
	}

	frames := data.Frames{}

	errGroup, ctx := errgroup.WithContext(req.Context())
	errGroup.SetLimit(10)
	resultsChan := make(chan data.Frames, len(measurements))

	for i := range measurements {
		measurement := measurements[i]
		errGroup.Go(func() error {
			result, err := ds.API.GetTagKeys(ctx, measurement.UUID.String())
			if err != nil {
				return err
			}

			resultsChan <- result
			return nil
		})
	}

	if err := errGroup.Wait(); err != nil {
		return nil, err
	}
	close(resultsChan)

	for result := range resultsChan {
		frames = mergeFrames(frames, result)
	}

	return getStringSetFromFrames(frames, "tagKey"), nil
}

func (ds *HistorianDataSource) handleGetTagKeysForMeasurement(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	measurementUUID := req.PathValue("uuid")
	if measurementUUID == "" {
		return nil, errors.New("uuid is required")
	}

	frames, err := ds.API.GetTagKeys(req.Context(), measurementUUID)
	if err != nil {
		return nil, err
	}

	return getStringSetFromFrames(frames, "tagKey"), nil
}

func (ds *HistorianDataSource) handleGetTagValueForMeasurementAndTagKey(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	measurementUUID := req.PathValue("uuid")
	if measurementUUID == "" {
		return nil, errors.New("uuid is required")
	}
	tagKey := req.PathValue("tagKey")
	if tagKey == "" {
		return nil, errors.New("tagKey is required")
	}
	frames, err := ds.API.GetTagValues(req.Context(), measurementUUID, tagKey)
	if err != nil {
		return nil, err
	}
	return getStringSetFromFrames(frames, "value"), nil
}

func (ds *HistorianDataSource) handleGetTagValues(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	// if no measurement in the path use the query parameters to get the measurements
	measurements, err := ds.API.GetMeasurements(req.Context(), req.URL.RawQuery)
	if err != nil {
		return nil, err
	}

	frames := data.Frames{}
	key := req.PathValue("tagKey")
	if key == "" {
		return nil, errors.New("tagKey is required")
	}

	errGroup, ctx := errgroup.WithContext(req.Context())
	errGroup.SetLimit(10)
	resultsChan := make(chan data.Frames, len(measurements))

	for i := range measurements {
		measurement := measurements[i]
		errGroup.Go(func() error {
			result, err := ds.API.GetTagValues(ctx, measurement.UUID.String(), key)
			if err != nil {
				return err
			}
			resultsChan <- result

			return nil
		})
	}

	if err := errGroup.Wait(); err != nil {
		return nil, err
	}
	close(resultsChan)

	for result := range resultsChan {
		frames = mergeFrames(frames, result)
	}

	return getStringSetFromFrames(frames, "value"), nil
}

func (ds *HistorianDataSource) handleGetHistorianInfo(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
	return ds.API.GetInfo(req.Context())
}

func (ds *HistorianDataSource) handleGetEventPropertyValues(_ http.ResponseWriter, req *http.Request) (interface{}, error) {
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
