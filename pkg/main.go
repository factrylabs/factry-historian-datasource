package main

import (
	"os"

	historianDataSource "github.com/factrylabs/factry-historian-datasource.git/pkg/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

func main() {
	if err := datasource.Manage("factry-historian-datasource", historianDataSource.NewDataSource, datasource.ManageOpts{}); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
