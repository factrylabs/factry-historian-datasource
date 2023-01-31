package api

import (
	"fmt"

	"github.com/google/uuid"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
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
func (api *API) RawQuery(timeseriesDatabaseUUID uuid.UUID, query schemas.RawQuery) (*schemas.QueryResult, error) {
	queryResult := &schemas.QueryResult{}
	if err := api.client.Post(fmt.Sprintf("/api/timeseries/%v/raw-query", timeseriesDatabaseUUID), query, queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}

// EventQuery executes an event query
func (api *API) EventQuery(filter schemas.EventFilter) ([]schemas.Event, error) {
	queryResult := []schemas.Event{}
	if err := api.client.Post("/api/events/query", filter, &queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}
