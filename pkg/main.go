package main

import (
	"os"

	historianDataSource "github.com/factrylabs/factry-historian-datasource.git/pkg/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
)

func main() {
	backend.SetupPluginEnvironment(historianDataSource.PluginID)
	err := datasource.Serve(historianDataSource.NewDataSource())
	if err != nil {
		backend.Logger.Error("error loading plugin", "pluginId", historianDataSource.PluginID)
		os.Exit(1)
	}
}
