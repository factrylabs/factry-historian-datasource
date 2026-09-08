package api

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/build/buildinfo"
)

// clientName is the fallback plugin name used in the User-Agent header for dev
// and test builds. Production builds take the name from the plugin.json "id"
// the SDK embeds at compile time (see clientIdentifier).
const clientName = "factry-historian-datasource"

// API is used to communicate with the historian API
type API struct {
	client *http.Client

	// Resource lookups resolve to the same result for every panel of a
	// dashboard refresh, so each resource endpoint gets a cache. Live data (tag
	// keys and values, event property values, measurement and event queries)
	// stays uncached. The caches hold one client's results, which are already
	// scoped to its token and organization, so they must not outlive the client.
	assetCache              *resolutionCache[schemas.Asset]
	assetPropertyCache      *resolutionCache[schemas.AssetProperty]
	databaseCache           *resolutionCache[schemas.TimeseriesDatabase]
	measurementCache        *resolutionCache[schemas.Measurement]
	collectorCache          *resolutionCache[schemas.Collector]
	eventTypeCache          *resolutionCache[schemas.EventType]
	eventTypePropertyCache  *resolutionCache[schemas.EventTypeProperty]
	eventConfigurationCache *resolutionCache[schemas.EventConfiguration]

	// measurementUUIDCache serves the single-measurement lookup by UUID. It is
	// separate from measurementCache: the list keys are raw query strings, so a
	// bare UUID key in the same cache could collide with one.
	measurementUUIDCache *resolutionCache[schemas.Measurement]

	// infoCache serves the historian info lookup. Its TTL is fixed at
	// infoCacheTTL rather than the resolution TTL: the info changes on a
	// historian upgrade, not on a reconfiguration, and disabling the resolution
	// caches must not turn every query into an info request.
	infoCache *resolutionCache[schemas.HistorianInfo]
}

// infoCacheTTL is how long the historian info is reused.
const infoCacheTTL = 5 * time.Minute

// clientIdentifier returns the "<name>/<version>" string sent in the User-Agent
// header so Historian can attribute traffic by client type and version. Both
// come from the build info the SDK embeds at compile time (name from
// plugin.json "id", version from package.json) and fall back to clientName and
// "unknown" for dev builds where the build info is absent.
func clientIdentifier() string {
	name, version := clientName, "unknown"
	if info, err := buildinfo.GetBuildInfo(); err == nil {
		if info.PluginID != "" {
			name = info.PluginID
		}
		if info.Version != "" {
			version = info.Version
		}
	}
	return name + "/" + version
}

// baseURLRoundTripper wraps an http.RoundTripper to prepend a base URL to all requests
type baseURLRoundTripper struct {
	baseURL *url.URL
	headers http.Header
	next    http.RoundTripper
}

// RoundTrip implements http.RoundTripper
func (b *baseURLRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	// Add headers to the request
	for key, values := range b.headers {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	if b.baseURL == nil {
		return b.next.RoundTrip(req)
	}

	// Only modify relative URLs
	if !req.URL.IsAbs() {
		// Combine base URL with request path. Join the escaped paths so
		// percent-escaped segments (tag keys, UUIDs) survive the rewrite.
		req.URL.Scheme = b.baseURL.Scheme
		req.URL.Host = b.baseURL.Host
		joinedEscaped := strings.TrimSuffix(b.baseURL.EscapedPath(), "/") + "/" + strings.TrimPrefix(req.URL.EscapedPath(), "/")
		joined, err := url.PathUnescape(joinedEscaped)
		if err != nil {
			// EscapedPath always yields a valid encoding, so this should
			// never happen; fall back to joining the decoded paths.
			joined = strings.TrimSuffix(b.baseURL.Path, "/") + "/" + strings.TrimPrefix(req.URL.Path, "/")
			joinedEscaped = joined
		}
		req.URL.Path = joined
		// Per net/url convention, RawPath is only set when it differs from
		// the default encoding of Path.
		if joinedEscaped != joined {
			req.URL.RawPath = joinedEscaped
		} else {
			req.URL.RawPath = ""
		}
	}
	return b.next.RoundTrip(req)
}

// Options describes how to configure the historian API client
type Options struct {
	URL                string
	Token              string
	Organization       string
	Timeout            time.Duration
	QueryTimeout       time.Duration
	InsecureSkipVerify bool
	// ResolutionCacheTTL is how long resolved resources are reused. Zero
	// disables the caches.
	ResolutionCacheTTL time.Duration
}

// NewAPIWithOptions creates a new instance of API from the given options
func NewAPIWithOptions(options Options) (*API, error) {
	headers := http.Header{
		"x-organization-uuid": []string{options.Organization},
		"Authorization":       []string{"Bearer " + options.Token},
		"User-Agent":          []string{clientIdentifier()},
	}
	parsedBaseURL, err := url.Parse(options.URL)
	if err != nil {
		return nil, err
	}

	timeouts := httpclient.DefaultTimeoutOptions
	if options.QueryTimeout > 0 {
		timeouts.Timeout = options.QueryTimeout
	}
	if options.Timeout > 0 {
		timeouts.DialTimeout = options.Timeout
	}

	clientOptions := httpclient.Options{
		Timeouts: &timeouts,
		Middlewares: []httpclient.Middleware{
			httpclient.MiddlewareFunc(func(_ httpclient.Options, next http.RoundTripper) http.RoundTripper {
				return &baseURLRoundTripper{
					baseURL: parsedBaseURL,
					headers: headers,
					next:    next,
				}
			}),
		},
	}
	if options.InsecureSkipVerify {
		clientOptions.TLS = &httpclient.TLSOptions{InsecureSkipVerify: true}
	}

	client, err := httpclient.New(clientOptions)
	if err != nil {
		return nil, err
	}

	api := &API{
		client:                  client,
		assetCache:              newResolutionCache[schemas.Asset](options.ResolutionCacheTTL),
		assetPropertyCache:      newResolutionCache[schemas.AssetProperty](options.ResolutionCacheTTL),
		databaseCache:           newResolutionCache[schemas.TimeseriesDatabase](options.ResolutionCacheTTL),
		measurementCache:        newResolutionCache[schemas.Measurement](options.ResolutionCacheTTL),
		measurementUUIDCache:    newResolutionCache[schemas.Measurement](options.ResolutionCacheTTL),
		collectorCache:          newResolutionCache[schemas.Collector](options.ResolutionCacheTTL),
		eventTypeCache:          newResolutionCache[schemas.EventType](options.ResolutionCacheTTL),
		eventTypePropertyCache:  newResolutionCache[schemas.EventTypeProperty](options.ResolutionCacheTTL),
		eventConfigurationCache: newResolutionCache[schemas.EventConfiguration](options.ResolutionCacheTTL),
		infoCache:               newResolutionCache[schemas.HistorianInfo](infoCacheTTL),
	}
	return api, nil
}

// NewAPIWithToken creates a new instance of API using a token. It leaves the
// resolution caches disabled; only the datasource settings turn them on. The
// historian info cache has a fixed TTL and is always on.
func NewAPIWithToken(baseURL string, token string, organization string) (*API, error) {
	return NewAPIWithOptions(Options{
		URL:          baseURL,
		Token:        token,
		Organization: organization,
	})
}
