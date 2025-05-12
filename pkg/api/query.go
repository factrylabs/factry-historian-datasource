package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"

	arrow_pb "github.com/factrylabs/factry-historian-datasource.git/pkg/proto"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/go-playground/form"
	"github.com/go-resty/resty/v2"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"google.golang.org/protobuf/proto"
)

var (
	// HeaderAccept is the header used to specify the content type of the request
	HeaderAccept = "Accept"
	// MIMEApplicationProtobuf is the MIME type for Protobuf
	MIMEApplicationProtobuf = "application/protobuf"
)

func handleDataFramesResponse(response *resty.Response) (data.Frames, error) {
	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	dataResponse := arrow_pb.DataResponse{}
	if err := proto.Unmarshal(response.Body(), &dataResponse); err != nil {
		return nil, err
	}

	if dataResponse.GetError() != "" {
		return nil, errors.New(dataResponse.GetError())
	}

	frames, err := data.UnmarshalArrowFrames(dataResponse.GetFrames())
	if err != nil {
		return nil, err
	}

	return frames, nil
}

// MeasurementQuery queries data for a measurement
func (api *API) MeasurementQuery(ctx context.Context, query schemas.Query) (data.Frames, error) {
	request := api.client.R().SetContext(ctx)
	request.Header.Add(HeaderAccept, MIMEApplicationProtobuf)
	response, err := request.SetBody(query).Post("/api/timeseries/query")
	if err != nil {
		return nil, err
	}

	return handleDataFramesResponse(response)
}

// RawQuery executes a raw time series query
func (api *API) RawQuery(ctx context.Context, timeseriesDatabaseUUID string, query schemas.RawQuery) (data.Frames, error) {
	request := api.client.R().SetContext(ctx)
	request.Header.Add(HeaderAccept, MIMEApplicationProtobuf)
	response, err := request.SetBody(query).Post(fmt.Sprintf("/api/timeseries/%v/raw-query", timeseriesDatabaseUUID))
	if err != nil {
		return nil, err
	}

	return handleDataFramesResponse(response)
}

// EventQuery executes an event query
func (api *API) EventQuery(ctx context.Context, filter schemas.EventFilter) ([]schemas.Event, error) {
	queryResult := []schemas.Event{}
	eventFilterParams, err := getEventFilter(filter)
	if err != nil {
		return nil, err
	}

	response, err := api.client.R().SetContext(ctx).SetQueryParamsFromValues(eventFilterParams).Get("/api/events")
	if err != nil {
		return nil, err
	}

	if response.StatusCode() >= 300 {
		return nil, handleHistorianError(response)
	}

	if err := json.Unmarshal(response.Body(), &queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}

// GetTagKeys queries the tag keys for a measurement
func (api *API) GetTagKeys(ctx context.Context, measurementUUID string) (data.Frames, error) {
	request := api.client.R().SetContext(ctx)
	request.Header.Add(HeaderAccept, MIMEApplicationProtobuf)
	response, err := request.SetPathParam("measurementUUID", measurementUUID).Get("/api/timeseries/measurements/{measurementUUID}/tags")
	if err != nil {
		return nil, err
	}

	return handleDataFramesResponse(response)
}

// GetTagValues queries the tag values for a measurement and a tag key
func (api *API) GetTagValues(ctx context.Context, measurementUUID, tagKey string) (data.Frames, error) {
	request := api.client.R().SetContext(ctx)
	request.Header.Add(HeaderAccept, MIMEApplicationProtobuf)
	pathParams := map[string]string{
		"measurementUUID": measurementUUID,
		"tagKey":          tagKey,
	}
	response, err := request.SetPathParams(pathParams).Get("/api/timeseries/measurements/{measurementUUID}/tags/{tagKey}")
	if err != nil {
		return nil, err
	}

	return handleDataFramesResponse(response)
}

func fixPropertyFilterValues(filter schemas.EventFilter) schemas.EventFilter {
	for i := range filter.PropertyFilter {
		if filter.PropertyFilter[i].Datatype == "" {
			filter.PropertyFilter[i].Datatype = "string"
		}

		switch filter.PropertyFilter[i].Operator {
		case "EXISTS", "NOT EXISTS", "IS NULL", "IS NOT NULL":
			filter.PropertyFilter[i].Value = nil
		case "IN", "NOT IN":
			if filter.PropertyFilter[i].Value == nil {
				filter.PropertyFilter[i].Value = []interface{}{}
			}
		default:
			if filter.PropertyFilter[i].Value == nil {
				filter.PropertyFilter[i].Value = []interface{}{}
			}
		}
	}
	return filter
}

func getEventFilter(filter schemas.EventFilter) (url.Values, error) {
	encoder := form.NewEncoder()
	filter = fixPropertyFilterValues(filter)
	values, err := encoder.Encode(&filter)
	if err != nil {
		return nil, err
	}

	return values, nil
}
