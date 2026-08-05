package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

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

	switch {
	case util.CheckMinimumVersion(historianInfo, "8.1.0", false):
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
	case util.CheckMinimumVersion(historianInfo, "6.4.0", false):
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
			for _, asset := range assets {
				assetUUIDSet[asset.UUID] = asset
			}
		}
	default:
		// Deprecated
		assets, err := api.GetAssets(ctx, "")
		if err != nil {
			return nil, err
		}

		for _, assetString := range assetStrings {
			if filteredAssets := filterAssetUUIDs(assets, assetString); len(filteredAssets) > 0 {
				for _, asset := range filteredAssets {
					assetUUIDSet[asset.UUID] = asset
				}
			}
		}
	}

	return assetUUIDSet, nil
}

// GetFilteredEventTypes returns a map of event types that match the given event type strings
func (api *API) GetFilteredEventTypes(ctx context.Context, eventTypeStrings []string, historianInfo *schemas.HistorianInfo) (map[uuid.UUID]schemas.EventType, error) {
	eventTypeUUIDSet := map[uuid.UUID]schemas.EventType{}

	if util.CheckMinimumVersion(historianInfo, "6.4.0", false) {
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
	} else {
		// Deprecated
		eventTypes, err := api.GetEventTypes(ctx, "")
		if err != nil {
			return nil, err
		}

		for _, eventTypeString := range eventTypeStrings {
			if filteredEventTypes := filterEventTypeUUIDs(eventTypes, eventTypeString); len(filteredEventTypes) > 0 {
				for _, eventType := range filteredEventTypes {
					eventTypeUUIDSet[eventType.UUID] = eventType
				}
			}
		}
	}

	return eventTypeUUIDSet, nil
}

func filterItems[T any](items []T, searchValue string, matchFuncs ...func(T) string) []T {
	filteredItems := make([]T, 0, len(items))
	if len(searchValue) == 0 {
		return filteredItems // Early exit for empty search
	}
	var re *regexp.Regexp
	if strings.HasPrefix(searchValue, "/") && strings.HasSuffix(searchValue, "/") {
		if len(searchValue) > 2 {
			pattern := searchValue[1 : len(searchValue)-1]
			var err error
			re, err = regexp.Compile(pattern)
			if err != nil {
				return filteredItems
			}
		}
	}

	for _, item := range items {
		for _, matchFunc := range matchFuncs {
			if (re != nil && re.MatchString(matchFunc(item))) || (re == nil && matchFunc(item) == searchValue) {
				filteredItems = append(filteredItems, item)
				break
			}
		}
	}
	return filteredItems
}

func filterAssetUUIDs(assets []schemas.Asset, searchValue string) []schemas.Asset {
	return filterItems(assets, searchValue,
		func(asset schemas.Asset) string { return asset.AssetPath },
		func(asset schemas.Asset) string { return asset.UUID.String() })
}

func filterEventTypeUUIDs(eventTypes []schemas.EventType, searchValue string) []schemas.EventType {
	return filterItems(eventTypes, searchValue,
		func(eventType schemas.EventType) string { return eventType.Name },
		func(eventType schemas.EventType) string { return eventType.UUID.String() })
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
