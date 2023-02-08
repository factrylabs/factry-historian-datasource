package api

import (
	"encoding/json"
	"fmt"

	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

// GetMeasurements calls get measurements in the historian API
func (api *API) GetMeasurements(query string) ([]schemas.Measurement, error) {
	measurements := []schemas.Measurement{}
	response, err := api.client.R().SetQueryString(query).Get("/api/measurements")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &measurements); err != nil {
		return nil, err
	}

	return measurements, nil
}

// GetMeasurement calls get measurement in the historian API
func (api *API) GetMeasurement(uuid string) (schemas.Measurement, error) {
	measurement := schemas.Measurement{}
	response, err := api.client.R().Get(fmt.Sprintf("/api/measurements/%v", uuid))
	if err != nil {
		return measurement, err
	}

	if err := json.Unmarshal(response.Body(), &measurement); err != nil {
		return measurement, err
	}

	return measurement, nil
}

// GetCollectors calls get collectors in the historian API
func (api *API) GetCollectors() ([]schemas.Collector, error) {
	collectors := []schemas.Collector{}
	response, err := api.client.R().Get("/api/collectors")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &collectors); err != nil {
		return nil, err
	}

	return collectors, nil
}

// GetTimeseriesDatabases calls get timeseries databases in the historian API
func (api *API) GetTimeseriesDatabases() ([]schemas.TimeseriesDatabase, error) {
	timeseriesDatabases := []schemas.TimeseriesDatabase{}
	response, err := api.client.R().Get("/api/timeseries-databases")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &timeseriesDatabases); err != nil {
		return nil, err
	}

	return timeseriesDatabases, nil
}

// GetAssets calls get assets in the historian API
func (api *API) GetAssets() ([]schemas.Asset, error) {
	assets := []schemas.Asset{}
	response, err := api.client.R().Get("/api/assets")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &assets); err != nil {
		return nil, err
	}

	return assets, nil
}

// GetAssetProperties calls get asset properties in the historian API
func (api *API) GetAssetProperties() ([]schemas.AssetProperty, error) {
	assetProperties := []schemas.AssetProperty{}
	response, err := api.client.R().Get("/api/asset-properties")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &assetProperties); err != nil {
		return nil, err
	}

	return assetProperties, nil
}

// GetEventTypes calls get event types in the historian API
func (api *API) GetEventTypes() ([]schemas.EventType, error) {
	eventTypes := []schemas.EventType{}
	response, err := api.client.R().Get("/api/event-types")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &eventTypes); err != nil {
		return nil, err
	}

	return eventTypes, nil
}

// GetEventTypeProperties calls get event type properties in the historian API
func (api *API) GetEventTypeProperties() ([]schemas.EventTypeProperty, error) {
	eventTypeProperties := []schemas.EventTypeProperty{}
	response, err := api.client.R().Get("/api/event-type-properties")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &eventTypeProperties); err != nil {
		return nil, err
	}

	return eventTypeProperties, nil
}

// GetEventConfigurations calls get event configurations in the historian API
func (api *API) GetEventConfigurations() ([]schemas.EventConfiguration, error) {
	eventConfigurations := []schemas.EventConfiguration{}
	response, err := api.client.R().Get("/api/event-configurations")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &eventConfigurations); err != nil {
		return nil, err
	}

	return eventConfigurations, nil
}
