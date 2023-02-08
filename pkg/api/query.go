package api

import (
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

// MeasurementQuery queries data for a measurement
func (api *API) MeasurementQuery(query schemas.Query) (*schemas.QueryResult, error) {
	queryResult := &schemas.QueryResult{}
	response, err := api.client.R().SetBody(query).Post("/api/timeseries/query")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}

// RawQuery executes a raw time series query
func (api *API) RawQuery(timeseriesDatabaseUUID uuid.UUID, query schemas.RawQuery) (*schemas.QueryResult, error) {
	queryResult := &schemas.QueryResult{}
	response, err := api.client.R().SetBody(query).Post(fmt.Sprintf("/api/timeseries/%v/raw-query", timeseriesDatabaseUUID))
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}

// EventQuery executes an event query
func (api *API) EventQuery(filter schemas.EventFilter) ([]schemas.Event, error) {
	queryResult := []schemas.Event{}
	response, err := api.client.R().SetBody(filter).Post("/api/events/query")
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(response.Body(), &queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}
