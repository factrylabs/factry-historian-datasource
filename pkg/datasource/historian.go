package datasource

import (
	"context"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
)

// Make sure Datasource implements required interfaces.
var (
	_ backend.QueryDataHandler      = (*HistorianDataSource)(nil)
	_ backend.CheckHealthHandler    = (*HistorianDataSource)(nil)
	_ backend.CallResourceHandler   = (*HistorianDataSource)(nil)
	_ instancemgmt.InstanceDisposer = (*HistorianDataSource)(nil)
)

// DataSource consts
const (
	PluginID            string = "factry-historian-datasource"
	DefaultHistorianURL string = "http://127.0.0.1:8000"
)

// HistorianDataSource ...
type HistorianDataSource struct {
	API *api.API
}

// NewDataSource creates a new data source instance
func NewDataSource(_ context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	settings, err := LoadSettings(s)
	if err != nil {
		return nil, err
	}

	historianDataSource := &HistorianDataSource{}
	historianDataSource.API, err = api.NewAPIWithToken(settings.URL, settings.Token, settings.Organization)
	if err != nil {
		return nil, err
	}

	return historianDataSource, nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance is created.
func (*HistorianDataSource) Dispose() {}
