package api

import (
	"fmt"

	"github.com/google/uuid"
	"gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"
)

// MeasurementQuery queries data for a measurement
func (api *API) MeasurementQuery(query schemas.Query) (*schemas.QueryResult, error) {
	queryResult := &schemas.QueryResult{}
	if err := api.client.Post("/api/timeseries/query", query, queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}

// RawQuery executes a raw time series query
func (api *API) RawQuery(timeseriesDatabase uuid.UUID, query schemas.RawQuery) (*schemas.QueryResult, error) {
	queryResult := &schemas.QueryResult{}
	if err := api.client.Post(fmt.Sprintf("/api/timeseries/%v/raw_query", timeseriesDatabase), query, queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}
