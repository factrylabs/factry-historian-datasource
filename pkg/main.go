package main

import (
	"os"

	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	historianDataSource "gitlab.com/factry/historian/grafana-datasource.git/pkg/datasource"

	_ "net/http/pprof"
)

func init() {
	go func() {
		http.ListenAndServe(":1234", nil)
	}()
}

func main() {
	backend.SetupPluginEnvironment(historianDataSource.PluginID)
	err := datasource.Serve(historianDataSource.NewDataSource())
	if err != nil {
		backend.Logger.Error("error loading plugin", "pluginId", historianDataSource.PluginID)
		os.Exit(1)
	}
}
