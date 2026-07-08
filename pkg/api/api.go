package api

import (
	"net/http"
	"net/url"
	"strings"
	"time"

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

	api := &API{client}
	return api, nil
}

// NewAPIWithToken creates a new instance of API using a token
func NewAPIWithToken(baseURL string, token string, organization string) (*API, error) {
	return NewAPIWithOptions(Options{
		URL:          baseURL,
		Token:        token,
		Organization: organization,
	})
}
