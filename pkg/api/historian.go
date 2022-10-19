package api

import (
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

// GetMeasurements calls get measurements in the historian API
func (api *API) GetMeasurements(query string) ([]schemas.Measurement, error) {
	measurements := []schemas.Measurement{}

	if err := api.client.Get("/api/measurements?"+query, &measurements); err != nil {
		return nil, err
	}

	return measurements, nil
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

	if err := api.client.Get("/api/timeseries_databases", &timeseriesDatabases); err != nil {
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

	if err := api.client.Get("/api/asset/properties", &assetProperties); err != nil {
		return nil, err
	}

	return assetProperties, nil
}
