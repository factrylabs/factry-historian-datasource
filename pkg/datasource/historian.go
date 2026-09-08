package datasource

import (
	"context"
	"strconv"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/go-playground/form"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
)

// Make sure Datasource implements required interfaces.
var (
	_ backend.QueryDataHandler      = (*HistorianDataSource)(nil)
	_ backend.CheckHealthHandler    = (*HistorianDataSource)(nil)
	_ backend.CallResourceHandler   = (*HistorianDataSource)(nil)
	_ instancemgmt.InstanceDisposer = (*HistorianDataSource)(nil)
)

// DataSource consts
const (
	PluginID            string = "factry-historian-datasource"
	DefaultHistorianURL string = "http://127.0.0.1:8000"
)

// HistorianDataSource ...
type HistorianDataSource struct {
	API             *api.API
	Decoder         *form.Decoder
	resourceHandler backend.CallResourceHandler
}

// NewDataSource creates a new data source instance
func NewDataSource(_ context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	settings, err := LoadSettings(s)
	if err != nil {
		return nil, err
	}

	historianDataSource := &HistorianDataSource{
		Decoder: form.NewDecoder(),
	}
	apiOptions := api.Options{
		URL:                settings.URL,
		Token:              settings.Token,
		Organization:       settings.Organization,
		InsecureSkipVerify: settings.InsecureSkipVerify,
	}
	// Timeout settings are stored as strings of seconds; keep the client
	// defaults when they fail to parse.
	if seconds, err := strconv.Atoi(settings.Timeout); err == nil && seconds > 0 {
		apiOptions.Timeout = time.Duration(seconds) * time.Second
	}
	if seconds, err := strconv.Atoi(settings.QueryTimeout); err == nil && seconds > 0 {
		apiOptions.QueryTimeout = time.Duration(seconds) * time.Second
	}
	// A zero TTL disables the resolution caches. LoadSettings guarantees the
	// value parses as a non-negative number of seconds that fits in a
	// time.Duration.
	if seconds, err := strconv.Atoi(settings.ResolutionCacheTTL); err == nil && seconds > 0 {
		apiOptions.ResolutionCacheTTL = time.Duration(seconds) * time.Second
	}
	historianDataSource.API, err = api.NewAPIWithOptions(apiOptions)
	if err != nil {
		return nil, err
	}

	historianDataSource.resourceHandler = historianDataSource.initializeResourceRoutes()

	return historianDataSource, nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance is created.
func (*HistorianDataSource) Dispose() {}
