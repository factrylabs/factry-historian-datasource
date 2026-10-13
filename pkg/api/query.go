package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"slices"

	arrow_pb "github.com/factrylabs/factry-historian-datasource.git/pkg/proto"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/go-playground/form"
	"github.com/google/uuid"
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

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}

	return handleDataFramesResponse(resp)
}

// EventQuery executes an event query. Historian 8.2+ takes the filter as a JSON body
// on POST /events/query, older versions take it as query parameters on GET /events.
func (api *API) EventQuery(ctx context.Context, filter schemas.EventFilter, historianInfo *schemas.HistorianInfo) ([]schemas.Event, error) {
	queryResult := []schemas.Event{}
	var req *http.Request
	var err error
	if util.CheckMinimumVersion(historianInfo, "8.2.0", true) {
		req, err = newEventQueryPostRequest(ctx, filter, historianInfo)
	} else {
		req, err = newEventQueryGetRequest(ctx, filter)
	}
	if err != nil {
		return nil, err
	}

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

	// Older versions don't support filtering properties, so it's done manually
	if !util.CheckMinimumVersion(historianInfo, "8.3.0", true) {
		removeUnselectedProperties(queryResult, filter.Properties)
	}

	return queryResult, nil
}

func removeUnselectedProperties(events []schemas.Event, properties []schemas.EventTypeProperty) {
	if len(properties) == 0 {
		return
	}

	names := make([]string, 0, len(properties))
	for _, property := range properties {
		names = append(names, property.Name)
	}

	for i := range events {
		if events[i].Properties != nil {
			maps.DeleteFunc(events[i].Properties.Properties, func(name string, _ interface{}) bool {
				return !slices.Contains(names, name)
			})
		}
	}
}

func newEventQueryGetRequest(ctx context.Context, filter schemas.EventFilter) (*http.Request, error) {
	eventFilterParams, err := getEventFilter(filter)
	if err != nil {
		return nil, err
	}

	queryURL := "/api/events"
	if len(eventFilterParams) > 0 {
		queryURL += "?" + eventFilterParams.Encode()
	}

	return newHTTPRequest(ctx, "GET", queryURL, nil)
}

func newEventQueryPostRequest(ctx context.Context, filter schemas.EventFilter, historianInfo *schemas.HistorianInfo) (*http.Request, error) {
	body := struct {
		Filter                     schemas.EventFilter
		IncludedEventPropertyUUIDs []uuid.UUID `json:",omitempty"`
		Limit                      int
	}{
		Filter: fixPropertyFilterValues(filter),
		Limit:  filter.Limit,
	}
	if util.CheckMinimumVersion(historianInfo, "8.3.0", true) {
		for _, property := range filter.Properties {
			body.IncludedEventPropertyUUIDs = append(body.IncludedEventPropertyUUIDs, property.UUID)
		}
	}

	encodedBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	return newHTTPRequest(ctx, "POST", "/api/events/query", bytes.NewReader(encodedBody))
}

// GetTagKeys queries the tag keys for a measurement
func (api *API) GetTagKeys(ctx context.Context, measurementUUID string) (data.Frames, error) {
	req, err := newHTTPRequest(ctx, "GET", fmt.Sprintf("/api/timeseries/measurements/%s/tags", url.PathEscape(measurementUUID)), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set(HeaderAccept, MIMEApplicationProtobuf)

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

// newFormEncoder returns the encoder used for all query parameters sent to Historian. It handles UUIDs explicitly as
// strings, so they're not sent as byte arrays to the Historian backend.
func newFormEncoder() *form.Encoder {
	encoder := form.NewEncoder()
	encoder.RegisterCustomTypeFunc(func(x interface{}) ([]string, error) {
		return []string{x.(uuid.UUID).String()}, nil
	}, uuid.UUID{})
	return encoder
}

func getEventFilter(filter schemas.EventFilter) (url.Values, error) {
	filter = fixPropertyFilterValues(filter)
	values, err := newFormEncoder().Encode(&filter)
	if err != nil {
		return nil, err
	}

	return values, nil
}
