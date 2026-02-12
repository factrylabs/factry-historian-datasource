package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	arrow_pb "github.com/factrylabs/factry-historian-datasource.git/pkg/proto"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/go-playground/form"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"google.golang.org/protobuf/proto"
)

var (
	// HeaderAccept is the header used to specify the content type of the request
	HeaderAccept = "Accept"
	// MIMEApplicationProtobuf is the MIME type for Protobuf
	MIMEApplicationProtobuf = "application/protobuf"
)

func handleDataFramesResponse(resp *http.Response) (data.Frames, error) {
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	dataResponse := arrow_pb.DataResponse{}
	if err := proto.Unmarshal(body, &dataResponse); err != nil {
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
	body, err := json.Marshal(query)
	if err != nil {
		return nil, err
	}

	req, err := newHTTPRequest(ctx, "POST", "/api/timeseries/query", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set(HeaderAccept, MIMEApplicationProtobuf)

	// #nosec G704 -- False positive: base URL is admin-configured, paths are hardcoded, only query params contain user input which are properly escaped
	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}

	return handleDataFramesResponse(resp)
}

// RawQuery executes a raw time series query
func (api *API) RawQuery(ctx context.Context, timeseriesDatabaseUUID string, query schemas.RawQuery) (data.Frames, error) {
	body, err := json.Marshal(query)
	if err != nil {
		return nil, err
	}

	req, err := newHTTPRequest(ctx, "POST", fmt.Sprintf("/api/timeseries/%s/raw-query", url.PathEscape(timeseriesDatabaseUUID)), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set(HeaderAccept, MIMEApplicationProtobuf)

	// #nosec G704 -- False positive: base URL is admin-configured, paths are hardcoded, only query params contain user input which are properly escaped
	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}

	return handleDataFramesResponse(resp)
}

// EventQuery executes an event query
func (api *API) EventQuery(ctx context.Context, filter schemas.EventFilter) ([]schemas.Event, error) {
	queryResult := []schemas.Event{}
	eventFilterParams, err := getEventFilter(filter)
	if err != nil {
		return nil, err
	}

	queryURL := "/api/events"
	if len(eventFilterParams) > 0 {
		queryURL += "?" + eventFilterParams.Encode()
	}

	req, err := newHTTPRequest(ctx, "GET", queryURL, nil)
	if err != nil {
		return nil, err
	}

	// #nosec G704 -- False positive: base URL is admin-configured, paths are hardcoded, only query params contain user input which are properly escaped
	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, handleHTTPError(resp)
	}

	if err := json.NewDecoder(resp.Body).Decode(&queryResult); err != nil {
		return nil, err
	}

	return queryResult, nil
}

// GetTagKeys queries the tag keys for a measurement
func (api *API) GetTagKeys(ctx context.Context, measurementUUID string) (data.Frames, error) {
	req, err := newHTTPRequest(ctx, "GET", fmt.Sprintf("/api/timeseries/measurements/%s/tags", url.PathEscape(measurementUUID)), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set(HeaderAccept, MIMEApplicationProtobuf)

	// #nosec G704 -- False positive: base URL is admin-configured, paths are hardcoded, only query params contain user input which are properly escaped
	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}

	return handleDataFramesResponse(resp)
}

// GetTagValues queries the tag values for a measurement and a tag key
func (api *API) GetTagValues(ctx context.Context, measurementUUID, tagKey string) (data.Frames, error) {
	req, err := newHTTPRequest(ctx, "GET", fmt.Sprintf("/api/timeseries/measurements/%s/tags/%s", url.PathEscape(measurementUUID), url.PathEscape(tagKey)), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set(HeaderAccept, MIMEApplicationProtobuf)

	// #nosec G704 -- False positive: base URL is admin-configured, paths are hardcoded, only query params contain user input which are properly escaped
	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}

	return handleDataFramesResponse(resp)
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
