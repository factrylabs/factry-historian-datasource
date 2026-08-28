package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// newHTTPRequest creates a new HTTP request with the given context, method, URL, and body
func newHTTPRequest(ctx context.Context, method, requestURL string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req, nil
}

// handleHTTPError processes HTTP error responses. The returned error carries an
// error source derived from the status code, so the plugin SDK attributes a
// historian failure such as a 429 (admission queue full) or a 504 (query
// exceeded timeout) to the historian instead of to the plugin. Statuses that
// indicate the plugin built a request this historian cannot serve (e.g. 501)
// stay attributed to the plugin.
func handleHTTPError(resp *http.Response) error {
	// Read and parse the error response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	httpError := &HTTPError{
		StatusCode: resp.StatusCode,
		Body:       string(body),
	}

	if backend.ErrorSourceFromHTTPStatus(resp.StatusCode) == backend.ErrorSourceDownstream {
		return backend.DownstreamError(httpError)
	}

	return backend.PluginError(httpError)
}

// HTTPError represents an HTTP error response
type HTTPError struct {
	StatusCode int
	Body       string
}

// Error implements the error interface
func (e *HTTPError) Error() string {
	return http.StatusText(e.StatusCode) + ": " + e.Body
}

// GetFilteredAssets returns a map of assets that match the given asset strings
func (api *API) GetFilteredAssets(ctx context.Context, assetStrings []string, historianInfo *schemas.HistorianInfo) (map[uuid.UUID]schemas.Asset, error) {
	assetUUIDSet := map[uuid.UUID]schemas.Asset{}

	assetStrings = util.Dedupe(assetStrings)
	if len(assetStrings) == 0 {
		return assetUUIDSet, nil
	}
	// Callers pass the asset strings in map order, so sort them to keep the
	// encoded query stable for a given asset set. The query doubles as the
	// resolution cache key.
	slices.Sort(assetStrings)

	if util.CheckMinimumVersion(historianInfo, "8.1.0", false) {
		uuids := make([]string, 0, len(assetStrings))
		paths := make([]string, 0, len(assetStrings))
		for _, assetString := range assetStrings {
			if _, err := uuid.Parse(assetString); err == nil {
				uuids = append(uuids, assetString)
			} else {
				paths = append(paths, assetString)
			}
		}

		if len(uuids) > 0 {
			assetQuery := url.Values{}
			for i, u := range uuids {
				assetQuery.Add(fmt.Sprintf("UUIDs[%d]", i), u)
			}
			assets, err := api.GetAssets(ctx, assetQuery.Encode())
			if err != nil {
				return nil, err
			}
			for _, asset := range assets {
				assetUUIDSet[asset.UUID] = asset
			}
		}

		for _, path := range paths {
			assetQuery := url.Values{}
			assetQuery.Add("Path", path)
			assets, err := api.GetAssets(ctx, assetQuery.Encode())
			if err != nil {
				return nil, err
			}
			for _, asset := range assets {
				assetUUIDSet[asset.UUID] = asset
			}
		}
		return assetUUIDSet, nil
	}

	for _, assetString := range assetStrings {
		searchKey := "Path"
		if _, err := uuid.Parse(assetString); err == nil {
			searchKey = "Keyword"
		}
		assetQuery := url.Values{}
		assetQuery.Add(searchKey, assetString)
		assets, err := api.GetAssets(ctx, assetQuery.Encode())
		if err != nil {
			return nil, err
		}
		for i := range assets {
			assetUUIDSet[assets[i].UUID] = assets[i]
		}
	}

	return assetUUIDSet, nil
}

// GetFilteredEventTypes returns a map of event types that match the given event type strings
func (api *API) GetFilteredEventTypes(ctx context.Context, eventTypeStrings []string, _ *schemas.HistorianInfo) (map[uuid.UUID]schemas.EventType, error) {
	eventTypeUUIDSet := map[uuid.UUID]schemas.EventType{}

	for _, eventTypeString := range eventTypeStrings {
		eventTypeQuery := url.Values{}
		eventTypeQuery.Add("Keyword", eventTypeString)
		eventTypes, err := api.GetEventTypes(ctx, eventTypeQuery.Encode())
		if err != nil {
			return nil, err
		}

		for _, eventType := range eventTypes {
			eventTypeUUIDSet[eventType.UUID] = eventType
		}
	}

	return eventTypeUUIDSet, nil
}

// AppendEscapedQuery appends the given raw query string to the path after validating and escaping it
func AppendEscapedQuery(path, rawQuery string) (string, error) {
	if rawQuery == "" {
		return path, nil
	}

	values, err := url.ParseQuery(rawQuery)
	if err != nil {
		return "", fmt.Errorf("invalid query parameters: %w", err)
	}

	return path + "?" + values.Encode(), nil
}
