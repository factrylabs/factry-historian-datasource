package datasource

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/api"
)

// DataSource consts
const (
	PluginID                     string = "factry-historian-datasource"
	SuccessfulHealthCheckMessage string = "Connection test successful, %v timeseries database(s) found"
	DefaultHistorianURL          string = "http://127.0.0.1:8000"
)

// HistorianPlugin ...
type HistorianPlugin struct {
	API *api.API
}

// HistorianDataSource ...
type HistorianDataSource struct {
	IM instancemgmt.InstanceManager
}

func (ds *HistorianDataSource) getDatasourceInstance(ctx context.Context, pluginCtx backend.PluginContext) (*HistorianPlugin, error) {
	s, err := ds.IM.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	return s.(*HistorianPlugin), nil
}

// NewDataSource creates a new data source instance
func NewDataSource() datasource.ServeOpts {
	im := datasource.NewInstanceManager(getInstance)
	host := &HistorianDataSource{
		IM: im,
	}
	return datasource.ServeOpts{
		CheckHealthHandler:  host,
		QueryDataHandler:    host,
		CallResourceHandler: host,
	}
}

func getInstance(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	settings, err := LoadSettings(s)
	if err != nil {
		return nil, err
	}

	historianPlugin := &HistorianPlugin{}
	historianPlugin.API, err = api.NewAPIWithToken(settings.URL, settings.Token, settings.Organization)
	if err != nil {
		return nil, err
	}

	return historianPlugin, nil
}
