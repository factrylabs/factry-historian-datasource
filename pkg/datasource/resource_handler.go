package datasource

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"

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
	ResourceTypeTagKeys             = "tag-keys"
	ResourceTypeTagValues           = "tag-values"
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

	url, err := url.Parse(req.URL)
	if err != nil {
		return err
	}

	resourcePath := strings.Split(req.Path, "/")
	if len(resourcePath) == 0 {
		return ErrorInvalidResourceCallQuery
	}

	switch resourcePath[0] {
	case ResourceTypeMeasurements:
		if len(resourcePath) == 2 {
			o, err := dsi.API.GetMeasurement(resourcePath[1])
			if err != nil {
				return err
			}

			return resource.SendJSON(sender, o)
		} else {
			o, err := dsi.API.GetMeasurements(url.RawQuery)
			if err != nil {
				return err
			}

			return resource.SendJSON(sender, o)
		}
	case ResourceTypeCollectors:
		o, err := dsi.API.GetCollectors()
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeDatabases:
		o, err := dsi.API.GetTimeseriesDatabases(url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeAssets:
		o, err := dsi.API.GetAssets(url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeAssetProperties:
		o, err := dsi.API.GetAssetProperties(url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeEventTypes:
		o, err := dsi.API.GetEventTypes(url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeEventTypeProperties:
		o, err := dsi.API.GetEventTypeProperties(url.RawQuery)
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
	case ResourceTypeTagKeys:
		keys, err := handleGetTagKeys(dsi.API, resourcePath, url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, keys)
	case ResourceTypeTagValues:
		values, err := handleGetTagValues(dsi.API, resourcePath, url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, values)
	}

	return ErrorInvalidResourceCallQuery
}
