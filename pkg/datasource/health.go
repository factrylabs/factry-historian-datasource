package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// Health consts
const (
	SuccessfulHealthCheckMessage string = "Connection test successful, %v timeseries database(s) found"
)

// CheckHealth checks the health by fetching the time series databases. It uses
// the uncached call on purpose: a health check has to reach the historian, or a
// broken connection would keep reporting the last cached result.
func (ds *HistorianDataSource) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	databases, err := ds.API.GetTimeseriesDatabases(ctx, "")
	if err != nil {
		log.DefaultLogger.FromContext(ctx).Error("Health check failed", "error", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: healthCheckErrorMessage(err),
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: fmt.Sprintf(SuccessfulHealthCheckMessage, len(databases)),
	}, nil
}

// healthCheckErrorMessage returns the message shown in the browser. It names
// the HTTP status when there is one, but never the response body, which can
// hold details of the historian or of a proxy in front of it.
func healthCheckErrorMessage(err error) string {
	if httpErr, ok := errors.AsType[*api.HTTPError](err); ok {
		return fmt.Sprintf("Factry Historian returned %d %s. Check the URL, organization and token.",
			httpErr.StatusCode, http.StatusText(httpErr.StatusCode))
	}

	return "Could not connect to Factry Historian. Check the URL."
}
