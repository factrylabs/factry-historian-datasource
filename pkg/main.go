package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	historianDatasource "gitlab.com/factry/historian/grafana-datasource.git/pkg/datasource"
)

func main() {
	backend.SetupPluginEnvironment(historianDatasource.PluginID)
	err := datasource.Serve(historianDatasource.NewDatasource())
	if err != nil {
		backend.Logger.Error("error loading plugin", "pluginId", historianDatasource.PluginID)
		os.Exit(1)
	}
}
