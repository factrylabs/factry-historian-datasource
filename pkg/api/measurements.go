package api

import (
	"github.com/pasztorpisti/qs"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
)

func (api *API) GetMeasurements(filter schemas.MeasurementFilter) ([]schemas.Measurement, error) {
	measurements := []schemas.Measurement{}
	params, err := qs.Marshal(filter)
	if err != nil {
		return nil, err
	}

	err = api.client.Get("/api/measurements?"+params, &measurements)
	return measurements, err
}
