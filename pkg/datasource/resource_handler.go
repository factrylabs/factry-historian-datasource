package datasource

import (
	"context"
	"encoding/json"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource"
)

// ResourceTypes is a list of resource that can be queried
const (
	ResourceTypeAssets              = "assets"
	ResourceTypeMeasurements        = "measurements"
	ResourceTypeCollectors          = "collectors"
	ResourceTypeDatabases           = "databases"
	ResourceTypeAssetProperties     = "asset-properties"
	ResourceTypeEventTypes          = "event-types"
	ResourceTypeEventTypeProperties = "event-type-properties"
	ResourceTypeEventConfigurations = "event-configurations"
)

// HistorianResourceQuery is a struct for a resource query
type HistorianResourceQuery struct {
	Type        string      `json:"type"`
	QueryParams interface{} `json:",omitempty"`
}

// GetResourceQuery unmarshals a resource query
func GetResourceQuery(body []byte) (*HistorianResourceQuery, error) {
	query := HistorianResourceQuery{}
	if err := json.Unmarshal(body, &query); err != nil {
		return nil, ErrorFailedUnmarshalingResourceQuery
	}

	if query.Type == "" {
		return nil, ErrorInvalidResourceCallQuery
	}

	return &query, nil
}

// CallResource maps a resource call to the corresponding historian API call
func (ds *HistorianDataSource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	dsi, err := ds.getDatasourceInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	resourcePath := req.Path
	switch resourcePath {
	case ResourceTypeMeasurements:
		url, err := url.Parse(req.URL)
		if err != nil {
			return err
		}

		o, err := dsi.API.GetMeasurements(url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeCollectors:
		o, err := dsi.API.GetCollectors()
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeDatabases:
		o, err := dsi.API.GetTimeseriesDatabases()
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeAssets:
		o, err := dsi.API.GetAssets()
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeAssetProperties:
		o, err := dsi.API.GetAssetProperties()
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeEventTypes:
		o, err := dsi.API.GetEventTypes()
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeEventTypeProperties:
		o, err := dsi.API.GetEventTypeProperties()
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeEventConfigurations:
		o, err := dsi.API.GetEventConfigurations()
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	}

	return ErrorInvalidResourceCallQuery
}
