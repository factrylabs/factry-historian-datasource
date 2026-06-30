package api

import (
	"net/http"
	"net/url"
	"strings"

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
}

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
		// Combine base URL with request path
		req.URL.Scheme = b.baseURL.Scheme
		req.URL.Host = b.baseURL.Host
		req.URL.Path = strings.TrimSuffix(b.baseURL.Path, "/") + "/" + strings.TrimPrefix(req.URL.Path, "/")
	}
	return b.next.RoundTrip(req)
}

// NewAPIWithToken creates a new instance of API using a token
func NewAPIWithToken(baseURL string, token string, organization string) (*API, error) {
	headers := http.Header{
		"x-organization-uuid": []string{organization},
		"Authorization":       []string{"Bearer " + token},
		"User-Agent":          []string{clientIdentifier()},
	}
	parsedBaseURL, err := url.Parse(baseURL)
	if err != nil {
		return nil, err
	}

	client, err := httpclient.New(httpclient.Options{
		Middlewares: []httpclient.Middleware{
			httpclient.MiddlewareFunc(func(_ httpclient.Options, next http.RoundTripper) http.RoundTripper {
				return &baseURLRoundTripper{
					baseURL: parsedBaseURL,
					headers: headers,
					next:    next,
				}
			}),
		},
	})
	if err != nil {
		return nil, err
	}

	api := &API{client}
	return api, nil
}
