package api

import (
	"fmt"

	"github.com/google/uuid"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

// GetMeasurements calls get measurements in the historian API
func (api *API) GetMeasurements(query string) ([]schemas.Measurement, error) {
	measurements := []schemas.Measurement{}

	if err := api.client.Get(fmt.Sprintf("/api/measurements?%v", query), &measurements); err != nil {
		return nil, err
	}

	return measurements, nil
}

// GetMeasurement calls get measurement in the historian API
func (api *API) GetMeasurement(uuid uuid.UUID) (schemas.Measurement, error) {
	measurement := schemas.Measurement{}

	if err := api.client.Get(fmt.Sprintf("/api/measurements/%v", uuid.String()), &measurement); err != nil {
		return measurement, err
	}

	return measurement, nil
}

// GetCollectors calls get collectors in the historian API
func (api *API) GetCollectors() ([]schemas.Collector, error) {
	collectors := []schemas.Collector{}

	if err := api.client.Get("/api/collectors", &collectors); err != nil {
		return nil, err
	}

	return collectors, nil
}

// GetTimeseriesDatabases calls get timeseries databases in the historian API
func (api *API) GetTimeseriesDatabases() ([]schemas.TimeseriesDatabase, error) {
	timeseriesDatabases := []schemas.TimeseriesDatabase{}

	if err := api.client.Get("/api/timeseries-databases", &timeseriesDatabases); err != nil {
		return nil, err
	}

	return timeseriesDatabases, nil
}

// GetAssets calls get assets in the historian API
func (api *API) GetAssets() ([]schemas.Asset, error) {
	assets := []schemas.Asset{}

	if err := api.client.Get("/api/assets", &assets); err != nil {
		return nil, err
	}

	return assets, nil
}

// GetAssetProperties calls get asset properties in the historian API
func (api *API) GetAssetProperties() ([]schemas.AssetProperty, error) {
	assetProperties := []schemas.AssetProperty{}

	if err := api.client.Get("/api/asset-properties", &assetProperties); err != nil {
		return nil, err
	}

	return assetProperties, nil
}

// GetEventTypes calls get event types in the historian API
func (api *API) GetEventTypes() ([]schemas.EventType, error) {
	eventTypes := []schemas.EventType{}

	if err := api.client.Get("/api/event-types", &eventTypes); err != nil {
		return nil, err
	}

	return eventTypes, nil
}

// GetEventTypeProperties calls get event type properties in the historian API
func (api *API) GetEventTypeProperties() ([]schemas.EventTypeProperty, error) {
	eventTypeProperties := []schemas.EventTypeProperty{}

	if err := api.client.Get("/api/event-type-properties", &eventTypeProperties); err != nil {
		return nil, err
	}

	return eventTypeProperties, nil
}

// GetEventConfigurations calls get event configurations in the historian API
func (api *API) GetEventConfigurations() ([]schemas.EventConfiguration, error) {
	eventConfigurations := []schemas.EventConfiguration{}

	if err := api.client.Get("/api/event-configurations", &eventConfigurations); err != nil {
		return nil, err
	}

	return eventConfigurations, nil
}
