package datasource

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
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
	ResourceTypeHistorianInfo       = "info"
	ResourceTypeEventPropertyValues = "event-property-values"
)

// HistorianResourceQuery is a struct for a resource query
type HistorianResourceQuery struct {
	QueryParams interface{} `json:",omitempty"`
	Type        string      `json:"type"`
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
			o, err := ds.API.GetMeasurement(ctx, resourcePath[1])
			if err != nil {
				return err
			}

			return resource.SendJSON(sender, o)
		} else {
			o, err := ds.API.GetMeasurements(ctx, url.RawQuery)
			if err != nil {
				return err
			}

			return resource.SendJSON(sender, o)
		}
	case ResourceTypeCollectors:
		o, err := ds.API.GetCollectors(ctx)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeDatabases:
		o, err := ds.API.GetTimeseriesDatabases(ctx, url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeAssets:
		o, err := ds.API.GetAssets(ctx, url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeAssetProperties:
		o, err := ds.API.GetAssetProperties(ctx, url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeEventTypes:
		o, err := ds.API.GetEventTypes(ctx, url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeEventTypeProperties:
		o, err := ds.API.GetEventTypeProperties(ctx, url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeEventConfigurations:
		o, err := ds.API.GetEventConfigurations(ctx)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	case ResourceTypeTagKeys:
		keys, err := handleGetTagKeys(ctx, ds.API, resourcePath, url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, keys)
	case ResourceTypeTagValues:
		values, err := handleGetTagValues(ctx, ds.API, resourcePath, url.RawQuery)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, values)
	case ResourceTypeHistorianInfo:
		info, err := ds.API.GetInfo(ctx)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, info)
	case ResourceTypeEventPropertyValues:
		if len(resourcePath) != 2 {
			return ErrorInvalidResourceCallQuery
		}

		eventTypePropertyUUID := resourcePath[1]
		request := schemas.EventPropertyValuesRequest{}
		if err := ds.Decoder.Decode(&request, url.Query()); err != nil {
			return err
		}

		o, err := ds.API.GetDistinctEventPropertyValues(ctx, eventTypePropertyUUID, request)
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	}

	return ErrorInvalidResourceCallQuery
}
