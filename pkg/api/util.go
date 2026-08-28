package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"slices"
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

// pathBatchBudget caps the percent-encoded size of one batched Path filter, so
// the request URL stays well inside the length limit of any proxy in front of
// the historian. The boundary is bytes rather than a path count: escaping and
// percent-encoding can triple a path full of backslashes.
const pathBatchBudget = 4096

// isPathRegex reports whether the historian reads an asset string as a regular
// expression instead of an exact asset path. It mirrors the historian's own
// check: a value wrapped in slashes is a regex.
func isPathRegex(assetString string) bool {
	return len(assetString) >= 2 && strings.HasPrefix(assetString, "/") && strings.HasSuffix(assetString, "/")
}

// pathAlternation builds a Path filter that matches every given literal asset
// path and nothing else. The historian applies the value as an unanchored
// POSIX regex over asset_path, so the alternation carries its own anchors.
// Asset paths are backslash-separated and asset names may contain regex
// metacharacters, so every path is escaped first. regexp.QuoteMeta escapes only
// non-alphanumerics, which a POSIX ARE reads as literals just like Go does.
func pathAlternation(paths []string) string {
	escaped := make([]string, 0, len(paths))
	for _, path := range paths {
		escaped = append(escaped, regexp.QuoteMeta(path))
	}
	return "/^(" + strings.Join(escaped, "|") + ")$/"
}

// batchPaths splits literal asset paths into batches whose alternation stays
// within pathBatchBudget once percent-encoded. A path that exceeds the budget
// on its own forms a batch of one.
func batchPaths(paths []string) [][]string {
	var batches [][]string
	batch := make([]string, 0, len(paths))
	size := 0
	for _, path := range paths {
		// The alternation separator | encodes to %7C.
		cost := len(url.QueryEscape(regexp.QuoteMeta(path))) + len("%7C")
		if len(batch) > 0 && size+cost > pathBatchBudget {
			batches = append(batches, batch)
			batch, size = nil, 0
		}
		batch = append(batch, path)
		size += cost
	}
	if len(batch) > 0 {
		batches = append(batches, batch)
	}
	return batches
}

// collectAssetsByPath adds every asset matching the given Path filter to set.
func (api *API) collectAssetsByPath(ctx context.Context, set map[uuid.UUID]schemas.Asset, pathFilter string) error {
	assetQuery := url.Values{}
	assetQuery.Add("Path", pathFilter)
	assets, err := api.GetAssets(ctx, assetQuery.Encode())
	if err != nil {
		return err
	}
	for _, asset := range assets {
		set[asset.UUID] = asset
	}
	return nil
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

		// The historian rebuilds the full asset-path tree for every Path
		// request, so batch the literal paths into a single alternation. A
		// user-supplied regex keeps its own request: its content must not be
		// escaped and it stays unanchored.
		literals := make([]string, 0, len(paths))
		for _, path := range paths {
			if isPathRegex(path) {
				if err := api.collectAssetsByPath(ctx, assetUUIDSet, path); err != nil {
					return nil, err
				}
				continue
			}
			literals = append(literals, path)
		}
		for _, batch := range batchPaths(literals) {
			// A single path stays an exact match, which skips the regex engine.
			pathFilter := batch[0]
			if len(batch) > 1 {
				pathFilter = pathAlternation(batch)
			}
			if err := api.collectAssetsByPath(ctx, assetUUIDSet, pathFilter); err != nil {
				return nil, err
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
