package api

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
)

// GetMeasurements calls get measurements in the historian API
func (api *API) GetMeasurements(ctx context.Context, query string) ([]schemas.Measurement, error) {
	measurements := []schemas.Measurement{}

	response, err := api.client.R().SetContext(ctx).SetQueryString(query).Get("/api/measurements")
	if err != nil {
		return nil, err
	}

	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &measurements); err != nil {
		return nil, err
	}

	return measurements, nil
}

// GetMeasurement calls get measurement in the historian API
func (api *API) GetMeasurement(ctx context.Context, uuid string) (schemas.Measurement, error) {
	measurement := schemas.Measurement{}
	response, err := api.client.R().SetContext(ctx).Get(fmt.Sprintf("/api/measurements/%v", uuid))
	if err != nil {
		return measurement, err
	}

	if response.StatusCode() >= 300 {
		return measurement, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &measurement); err != nil {
		return measurement, err
	}

	return measurement, nil
}

// GetCollectors calls get collectors in the historian API
func (api *API) GetCollectors(ctx context.Context) ([]schemas.Collector, error) {
	collectors := []schemas.Collector{}
	response, err := api.client.R().SetContext(ctx).Get("/api/collectors")
	if err != nil {
		return nil, err
	}

	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &collectors); err != nil {
		return nil, err
	}

	return collectors, nil
}

// GetTimeseriesDatabases calls get timeseries databases in the historian API
func (api *API) GetTimeseriesDatabases(ctx context.Context, query string) ([]schemas.TimeseriesDatabase, error) {
	timeseriesDatabases := []schemas.TimeseriesDatabase{}
	response, err := api.client.R().SetContext(ctx).SetQueryString(query).Get("/api/timeseries-databases")
	if err != nil {
		return nil, err
	}

	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &timeseriesDatabases); err != nil {
		return nil, err
	}

	return timeseriesDatabases, nil
}

// GetAssets calls get assets in the historian API
func (api *API) GetAssets(ctx context.Context, query string) ([]schemas.Asset, error) {
	assets := []schemas.Asset{}
	response, err := api.client.R().SetContext(ctx).SetQueryString(query).Get("/api/assets")
	if err != nil {
		return nil, err
	}

	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &assets); err != nil {
		return nil, err
	}

	return assets, nil
}

// GetAssetProperties calls get asset properties in the historian API
func (api *API) GetAssetProperties(ctx context.Context, query string) ([]schemas.AssetProperty, error) {
	assetProperties := []schemas.AssetProperty{}
	response, err := api.client.R().SetContext(ctx).SetQueryString(query).Get("/api/asset-properties")
	if err != nil {
		return nil, err
	}

	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &assetProperties); err != nil {
		return nil, err
	}

	return assetProperties, nil
}

// GetEventTypes calls get event types in the historian API
func (api *API) GetEventTypes(ctx context.Context, query string) ([]schemas.EventType, error) {
	eventTypes := []schemas.EventType{}
	response, err := api.client.R().SetContext(ctx).SetQueryString(query).Get("/api/event-types")
	if err != nil {
		return nil, err
	}

	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &eventTypes); err != nil {
		return nil, err
	}

	return eventTypes, nil
}

// GetEventTypeProperties calls get event type properties in the historian API
func (api *API) GetEventTypeProperties(ctx context.Context, query string) ([]schemas.EventTypeProperty, error) {
	eventTypeProperties := []schemas.EventTypeProperty{}
	response, err := api.client.R().SetContext(ctx).SetQueryString(query).Get("/api/event-type-properties")
	if err != nil {
		return nil, err
	}

	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &eventTypeProperties); err != nil {
		return nil, err
	}

	return eventTypeProperties, nil
}

// GetEventConfigurations calls get event configurations in the historian API
func (api *API) GetEventConfigurations(ctx context.Context) ([]schemas.EventConfiguration, error) {
	eventConfigurations := []schemas.EventConfiguration{}
	response, err := api.client.R().SetContext(ctx).Get("/api/event-configurations")
	if err != nil {
		return nil, err
	}

	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &eventConfigurations); err != nil {
		return nil, err
	}

	return eventConfigurations, nil
}
