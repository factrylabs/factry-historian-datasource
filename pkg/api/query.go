package api

import "gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"

// MeasurementQuery queries data for a measurement
func (api *API) MeasurementQuery(query schemas.Query) (*schemas.QueryResult, error) {
	queryResult := &schemas.QueryResult{}
	if err := api.client.Post("/api/timeseries/query", query, queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}
