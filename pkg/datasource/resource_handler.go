package datasource

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

// ResourceTypes is a list of resource that can be queried
const (
	ResourceTypeAssets       = "assets"
	ResourceTypeMeasurements = "measurements"
	ResourceTypeCollectors   = "collectors"
	ResourceTypeDatabases    = "databases"
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

func (ds *HistorianDatasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	dsi, err := ds.getDatasourceInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	resourcePath := req.Path
	switch resourcePath {
	case ResourceTypeMeasurements:
		o, err := dsi.API.GetMeasurements(schemas.MeasurementFilter{})
		if err != nil {
			return err
		}

		return resource.SendJSON(sender, o)
	}
	return ErrorInvalidResourceCallQuery
}
