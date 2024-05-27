package main

import (
	"net/http"
	"os"
	"time"

	historianDataSource "github.com/factrylabs/factry-historian-datasource.git/pkg/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"

	_ "net/http/pprof" // #nosec G108 -- pprof is only enabled if env var PPROF_ENDPOINT is set
)

func startPprof(endpoint string) {
	go func() {
		server := &http.Server{
			Addr:         endpoint,
			ReadTimeout:  10 * time.Second,
			WriteTimeout: 10 * time.Second,
		}
		_ = server.ListenAndServe()
	}()
}

func main() {
	if os.Getenv("PPROF_ENDPOINT") != "" {
		startPprof(os.Getenv("PPROF_ENDPOINT"))
	}

	backend.SetupPluginEnvironment(historianDataSource.PluginID)
	err := datasource.Serve(historianDataSource.NewDataSource())
	if err != nil {
		backend.Logger.Error("error loading plugin", "pluginId", historianDataSource.PluginID)
		os.Exit(1)
	}
}
