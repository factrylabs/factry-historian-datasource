package main

import (
	"os"

	historianDataSource "github.com/factrylabs/factry-historian-datasource.git/pkg/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"

	_ "net/http/pprof" // #nosec G108 -- pprof is only enabled if env var PPROF_ENDPOINT is set
)

func main() {
	backend.SetupPluginEnvironment(historianDataSource.PluginID)
	err := datasource.Serve(historianDataSource.NewDataSource())
	if err != nil {
		backend.Logger.Error("error loading plugin", "pluginId", historianDataSource.PluginID)
		os.Exit(1)
	}
}
