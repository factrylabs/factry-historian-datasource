package datasource

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (d *HistorianDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	var status = backend.HealthStatusOk
	var message = SuccessfulHealthCheckMessage

	// TODO: implement this

	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}
