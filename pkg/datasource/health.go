package datasource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// Health consts
const (
	SuccessfulHealthCheckMessage string = "Connection test successful, %v timeseries database(s) found"
)

// CheckHealth checks the health by fetching the time series databases
func (d *HistorianDataSource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsi, err := d.getDatasourceInstance(ctx, req.PluginContext)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "",
		}, err
	}

	databases, err := dsi.API.GetTimeseriesDatabases()
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Error performing health check: %v", err),
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: fmt.Sprintf(SuccessfulHealthCheckMessage, len(databases)),
	}, nil
}
