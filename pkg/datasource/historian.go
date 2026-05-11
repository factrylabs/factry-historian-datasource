package datasource

import (
	"context"
	"sync"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
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

const historianInfoTTL = 5 * time.Minute

// HistorianDataSource ...
type HistorianDataSource struct {
	API             *api.API
	Decoder         *form.Decoder
	resourceHandler backend.CallResourceHandler

	infoMu     sync.Mutex
	info       *schemas.HistorianInfo
	infoExpiry time.Time
}

// getHistorianInfo returns the historian info, refreshing the cached value when
// it is missing or older than historianInfoTTL. The mutex is held across the
// HTTP call so concurrent callers share a single round-trip.
func (ds *HistorianDataSource) getHistorianInfo(ctx context.Context) (*schemas.HistorianInfo, error) {
	ds.infoMu.Lock()
	defer ds.infoMu.Unlock()
	if ds.info != nil && time.Now().Before(ds.infoExpiry) {
		return ds.info, nil
	}
	info, err := ds.API.GetInfo(ctx)
	if err != nil {
		return nil, err
	}
	ds.info = &info
	ds.infoExpiry = time.Now().Add(historianInfoTTL)
	return ds.info, nil
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
	historianDataSource.API, err = api.NewAPIWithToken(settings.URL, settings.Token, settings.Organization)
	if err != nil {
		return nil, err
	}

	historianDataSource.resourceHandler = historianDataSource.initializeResourceRoutes()

	return historianDataSource, nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance is created.
func (*HistorianDataSource) Dispose() {}
