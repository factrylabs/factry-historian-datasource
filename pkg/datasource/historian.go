package datasource

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/api"
)

const (
	PluginID                     string = "factry-historian-datasource"
	SuccessfulHealthCheckMessage string = "plugin health check successful"
	DefaultHistorianURL          string = "http://127.0.0.1:8000"
)

type HistorianPlugin struct {
	API *api.API
}

type HistorianDatasource struct {
	IM instancemgmt.InstanceManager
}

func (ds *HistorianDatasource) getDatasourceInstance(ctx context.Context, pluginCtx backend.PluginContext) (*HistorianPlugin, error) {
	s, err := ds.IM.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	return s.(*HistorianPlugin), nil
}

func NewDatasource() datasource.ServeOpts {
	im := datasource.NewInstanceManager(getInstance)
	host := &HistorianDatasource{
		IM: im,
	}
	return datasource.ServeOpts{
		// CheckHealthHandler:  host,
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
	if settings.Token != "" {
		historianAPI, err := api.NewAPIWithToken(settings.URL, settings.Token)
		if err != nil {
			return nil, err
		}

		historianPlugin.API = historianAPI
	} else {
		historianAPI, err := api.NewAPIWithUser(settings.URL, settings.Username, settings.Password)
		if err != nil {
			return nil, err
		}

		historianPlugin.API = historianAPI
	}
	return historianPlugin, nil
}
