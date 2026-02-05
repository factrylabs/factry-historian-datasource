package api

import (
	"context"
	"encoding/json"
	"maps"
	"net/url"
	"slices"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/go-playground/form"
	"github.com/google/uuid"
)

// GetMeasurements calls get measurements in the historian API
func (api *API) GetMeasurements(ctx context.Context, query string) ([]schemas.Measurement, error) {
	measurements := []schemas.Measurement{}

	queryURL := "/api/measurements"
	if query != "" {
		queryURL += "?" + query
	}

	req, err := newHTTPRequest(ctx, "GET", queryURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&measurements); err != nil {
		return nil, err
	}

	return measurements, nil
}

// GetMeasurement calls get measurement in the historian API
func (api *API) GetMeasurement(ctx context.Context, uuid string) (schemas.Measurement, error) {
	measurement := schemas.Measurement{}

	req, err := newHTTPRequest(ctx, "GET", "/api/measurements/"+url.PathEscape(uuid), nil)
	if err != nil {
		return measurement, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return measurement, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return measurement, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&measurement); err != nil {
		return measurement, err
	}

	return measurement, nil
}

// GetCollectors calls get collectors in the historian API
func (api *API) GetCollectors(ctx context.Context) ([]schemas.Collector, error) {
	collectors := []schemas.Collector{}

	req, err := newHTTPRequest(ctx, "GET", "/api/collectors", nil)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&collectors); err != nil {
		return nil, err
	}

	return collectors, nil
}

// GetTimeseriesDatabases calls get timeseries databases in the historian API
func (api *API) GetTimeseriesDatabases(ctx context.Context, query string) ([]schemas.TimeseriesDatabase, error) {
	timeseriesDatabases := []schemas.TimeseriesDatabase{}

	queryURL := "/api/timeseries-databases"
	if query != "" {
		queryURL += "?" + query
	}

	req, err := newHTTPRequest(ctx, "GET", queryURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&timeseriesDatabases); err != nil {
		return nil, err
	}

	return timeseriesDatabases, nil
}

// GetAssets calls get assets in the historian API
func (api *API) GetAssets(ctx context.Context, query string) ([]schemas.Asset, error) {
	assets := []schemas.Asset{}

	queryURL := "/api/assets"
	if query != "" {
		queryURL += "?" + query
	}

	req, err := newHTTPRequest(ctx, "GET", queryURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&assets); err != nil {
		return nil, err
	}

	return assets, nil
}

// GetAssetProperties calls get asset properties in the historian API
func (api *API) GetAssetProperties(ctx context.Context, query string) ([]schemas.AssetProperty, error) {
	assetProperties := []schemas.AssetProperty{}

	queryURL := "/api/asset-properties"
	if query != "" {
		queryURL += "?" + query
	}

	req, err := newHTTPRequest(ctx, "GET", queryURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&assetProperties); err != nil {
		return nil, err
	}

	return assetProperties, nil
}

// GetEventTypes calls get event types in the historian API
func (api *API) GetEventTypes(ctx context.Context, query string) ([]schemas.EventType, error) {
	eventTypes := []schemas.EventType{}

	queryURL := "/api/event-types"
	if query != "" {
		queryURL += "?" + query
	}

	req, err := newHTTPRequest(ctx, "GET", queryURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&eventTypes); err != nil {
		return nil, err
	}

	return eventTypes, nil
}

// GetEventTypeProperties calls get event type properties in the historian API
func (api *API) GetEventTypeProperties(ctx context.Context, query string) ([]schemas.EventTypeProperty, error) {
	eventTypeProperties := []schemas.EventTypeProperty{}

	queryURL := "/api/event-type-properties"
	if query != "" {
		queryURL += "?" + query
	}

	req, err := newHTTPRequest(ctx, "GET", queryURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&eventTypeProperties); err != nil {
		return nil, err
	}

	return eventTypeProperties, nil
}

// GetEventConfigurations calls get event configurations in the historian API
func (api *API) GetEventConfigurations(ctx context.Context) ([]schemas.EventConfiguration, error) {
	eventConfigurations := []schemas.EventConfiguration{}

	req, err := newHTTPRequest(ctx, "GET", "/api/event-configurations", nil)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&eventConfigurations); err != nil {
		return nil, err
	}

	return eventConfigurations, nil
}

// GetInfo calls get info in the historian API
func (api *API) GetInfo(ctx context.Context) (schemas.HistorianInfo, error) {
	info := schemas.HistorianInfo{}

	req, err := newHTTPRequest(ctx, "GET", "/api/info", nil)
	if err != nil {
		return info, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return info, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return info, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return info, err
	}

	return info, nil
}

// GetDistinctEventPropertyValues calls get distinct event property values in the historian API
func (api *API) GetDistinctEventPropertyValues(ctx context.Context, eventTypePropertyUUID string, request schemas.EventPropertyValuesRequest) ([]interface{}, error) {
	assets, err := api.GetFilteredAssets(ctx, request.Assets, &request.HistorianInfo)
	if err != nil {
		return nil, err
	}

	eventTypes, err := api.GetFilteredEventTypes(ctx, request.EventTypes, &request.HistorianInfo)
	if err != nil {
		return nil, err
	}

	if len(assets) == 0 || len(eventTypes) == 0 {
		return []interface{}{}, nil
	}

	filter := schemas.EventFilter{
		AssetUUIDs:     slices.AppendSeq(make([]uuid.UUID, 0, len(assets)), maps.Keys(assets)),
		EventTypeUUIDs: slices.AppendSeq(make([]uuid.UUID, 0, len(eventTypes)), maps.Keys(eventTypes)),
		Limit:          0,
		Status:         request.Statuses,
		StartTime:      &request.From,
		StopTime:       &request.To,
		PropertyFilter: request.PropertyFilter,
	}
	encoder := form.NewEncoder()
	urlValues, err := encoder.Encode(filter)
	if err != nil {
		return nil, err
	}

	eventTypePropertyValues := schemas.EventPropertyValues{}

	queryURL := "/api/event-type-properties/" + url.PathEscape(eventTypePropertyUUID) + "/values"
	if len(urlValues) > 0 {
		queryURL += "?" + urlValues.Encode()
	}

	req, err := newHTTPRequest(ctx, "GET", queryURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&eventTypePropertyValues); err != nil {
		return nil, err
	}

	return eventTypePropertyValues, nil
}
