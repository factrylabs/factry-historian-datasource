package api

import (
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	arrow_pb "gitlab.com/factry/historian/grafana-datasource.git/pkg/proto"
	"gitlab.com/factry/historian/grafana-datasource.git/pkg/schemas"
	"google.golang.org/protobuf/proto"
)

var (
	HeaderAccept            = "Accept"
	MIMEApplicationProtobuf = "application/protobuf"
)

// MeasurementQuery queries data for a measurement
func (api *API) MeasurementQuery(query schemas.Query) (data.Frames, error) {
	request := api.client.R()
	request.Header.Add(HeaderAccept, MIMEApplicationProtobuf)
	response, err := request.SetBody(query).Post("/api/timeseries/query")
	if err != nil {
		return nil, err
	}

	dataResponse := arrow_pb.DataResponse{}
	if err := proto.Unmarshal(response.Body(), &dataResponse); err != nil {
		return nil, err
	}

	if dataResponse.Error != "" {
		return nil, fmt.Errorf(dataResponse.Error)
	}

	frames, err := data.UnmarshalArrowFrames(dataResponse.Frames)
	if err != nil {
		return nil, err
	}

	return frames, nil
}

// RawQuery executes a raw time series query
func (api *API) RawQuery(timeseriesDatabaseUUID uuid.UUID, query schemas.RawQuery) (data.Frames, error) {
	request := api.client.R()
	request.Header.Add(HeaderAccept, MIMEApplicationProtobuf)
	response, err := request.SetBody(query).Post(fmt.Sprintf("/api/timeseries/%v/raw-query", timeseriesDatabaseUUID))
	if err != nil {
		return nil, err
	}

	dataResponse := arrow_pb.DataResponse{}
	if err := proto.Unmarshal(response.Body(), &dataResponse); err != nil {
		return nil, err
	}

	if dataResponse.Error != "" {
		return nil, fmt.Errorf(dataResponse.Error)
	}

	frames, err := data.UnmarshalArrowFrames(dataResponse.Frames)
	if err != nil {
		return nil, err
	}

	return frames, nil
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
