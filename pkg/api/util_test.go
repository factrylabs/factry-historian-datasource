package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppendEscapedQuery(t *testing.T) {
	t.Parallel()

	type args struct {
		baseURL string
		query   string
	}
	tests := []struct {
		name    string
		args    args
		want    string
		wantErr bool
	}{
		{
			name: "appends query to base URL",
			args: args{
				baseURL: "/api/assets",
				query:   "name=asset1",
			},
			want:    "/api/assets?name=asset1",
			wantErr: false,
		},
		{
			name: "appends query with special characters",
			args: args{
				baseURL: "/api/assets",
				query:   "name=asset 1&status=active",
			},
			want:    "/api/assets?name=asset+1&status=active",
			wantErr: false,
		},
		{
			name: "does not double encode regex query value",
			args: args{
				baseURL: "/api/measurements",
				query:   "Keyword=/rand_number.*/",
			},
			want:    "/api/measurements?Keyword=%2Frand_number.%2A%2F",
			wantErr: false,
		},
		{
			name: "returns error for invalid query",
			args: args{
				baseURL: "/api/assets",
				query:   "name=%",
			},
			want:    "",
			wantErr: true,
		},
	}
	for i := range tests {
		tt := tests[i]
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := api.AppendEscapedQuery(tt.args.baseURL, tt.args.query)
			if (err != nil) != tt.wantErr {
				t.Errorf("AppendEscapedQuery() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("AppendEscapedQuery() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetFilteredAssets(t *testing.T) {
	t.Parallel()

	a1UUID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	a2UUID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	a3UUID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	a1 := schemas.Asset{BaseModel: schemas.BaseModel{UUID: a1UUID, Name: "a1"}, AssetPath: "site/a1"}
	a2 := schemas.Asset{BaseModel: schemas.BaseModel{UUID: a2UUID, Name: "a2"}, AssetPath: "site/a2"}
	a3 := schemas.Asset{BaseModel: schemas.BaseModel{UUID: a3UUID, Name: "a3"}, AssetPath: "site/a3"}

	byUUID := map[string]schemas.Asset{
		a1UUID.String(): a1,
		a2UUID.String(): a2,
		a3UUID.String(): a3,
	}
	allAssets := []schemas.Asset{a1, a2, a3}

	type recordedRequest struct {
		rawQuery string
		query    url.Values
	}

	startServer := func(t *testing.T) (*httptest.Server, *[]recordedRequest) {
		t.Helper()
		var (
			mu       sync.Mutex
			requests []recordedRequest
		)
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			requests = append(requests, recordedRequest{rawQuery: r.URL.RawQuery, query: r.URL.Query()})
			mu.Unlock()

			q := r.URL.Query()
			var matched []schemas.Asset
			uuids := indexedQuery(q, "UUIDs")
			switch {
			case len(uuids) > 0:
				for _, u := range uuids {
					if a, ok := byUUID[u]; ok {
						matched = append(matched, a)
					}
				}
			case q.Get("Keyword") != "":
				if a, ok := byUUID[q.Get("Keyword")]; ok {
					matched = append(matched, a)
				}
			case q.Get("Path") != "":
				matched = matchPath(t, allAssets, q.Get("Path"))
			default:
				matched = allAssets
			}
			_ = json.NewEncoder(w).Encode(matched)
		}))
		t.Cleanup(srv.Close)
		return srv, &requests
	}

	newClient := func(t *testing.T, baseURL string) *api.API {
		t.Helper()
		c, err := api.NewAPIWithToken(baseURL, "tok", "org")
		require.NoError(t, err)
		return c
	}

	t.Run("v8.1.0 sends uuids and paths as separate requests", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v8.1.0"}
		result, err := client.GetFilteredAssets(context.Background(),
			[]string{a1UUID.String(), "site/a2", a3UUID.String()}, info)
		require.NoError(t, err)
		assert.Contains(t, result, a1UUID)
		assert.Contains(t, result, a2UUID)
		assert.Contains(t, result, a3UUID)

		require.Len(t, *requests, 2, "expected one UUIDs request followed by one path request")
		assert.ElementsMatch(t,
			[]string{a1UUID.String(), a3UUID.String()},
			indexedQuery((*requests)[0].query, "UUIDs"),
			"v8 branch must encode UUIDs as indexed UUIDs[i] params",
		)
		assert.Empty(t, (*requests)[0].query.Get("Path"))
		assert.Empty(t, (*requests)[0].query.Get("Keyword"))
		assert.Equal(t, "site/a2", (*requests)[1].query.Get("Path"))
	})

	t.Run("v8.1.0 skips uuid request when no uuids are supplied", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v8.1.0"}
		result, err := client.GetFilteredAssets(context.Background(),
			[]string{"site/a1", "site/a3"}, info)
		require.NoError(t, err)
		assert.Contains(t, result, a1UUID)
		assert.Contains(t, result, a3UUID)

		require.Len(t, *requests, 1, "two paths and no uuids means one batched path request")
		assert.Empty(t, indexedQuery((*requests)[0].query, "UUIDs"), "no UUIDs[i] should be sent when input has no uuids")
		assert.NotEmpty(t, (*requests)[0].query.Get("Path"))
	})

	t.Run("v7.x issues per-asset Keyword/Path requests", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v7.5.3"}
		result, err := client.GetFilteredAssets(context.Background(),
			[]string{a1UUID.String(), "site/a2"}, info)
		require.NoError(t, err)
		assert.Contains(t, result, a1UUID)
		assert.Contains(t, result, a2UUID)

		require.Len(t, *requests, 2, "pre-v8 branch must issue one request per input")
		assert.Equal(t, a1UUID.String(), (*requests)[0].query.Get("Keyword"))
		assert.Empty(t, indexedQuery((*requests)[0].query, "UUIDs"), "pre-v8 branch must not use the v8 UUIDs[i] form")
		assert.Equal(t, "site/a2", (*requests)[1].query.Get("Path"))
	})

	t.Run("nil historian info uses per-asset Keyword/Path branch", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		result, err := client.GetFilteredAssets(context.Background(), []string{"site/a1"}, nil)
		require.NoError(t, err)
		assert.Contains(t, result, a1UUID)

		require.Len(t, *requests, 1)
		assert.Equal(t, "site/a1", (*requests)[0].query.Get("Path"))
	})

	t.Run("pre-v8 deduplicates repeated asset strings", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v7.3.0"}
		result, err := client.GetFilteredAssets(context.Background(),
			[]string{a1UUID.String(), "site/a2", a1UUID.String(), "site/a2"}, info)
		require.NoError(t, err)
		assert.Contains(t, result, a1UUID)
		assert.Contains(t, result, a2UUID)

		require.Len(t, *requests, 2, "duplicates must collapse to a single request per unique input")
	})

	t.Run("v8.1.0 deduplicates repeated asset strings", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v8.1.0"}
		_, err := client.GetFilteredAssets(context.Background(),
			[]string{a1UUID.String(), a1UUID.String(), "site/a2", "site/a2"}, info)
		require.NoError(t, err)

		require.Len(t, *requests, 2, "expected one batched uuids request and one path request after dedup")
		assert.Equal(t,
			[]string{a1UUID.String()},
			indexedQuery((*requests)[0].query, "UUIDs"),
			"duplicate uuids must collapse before being encoded as UUIDs[i]",
		)
		assert.Equal(t, "site/a2", (*requests)[1].query.Get("Path"))
	})

	// Callers build the asset strings from a map (the event handler collects
	// missing parent asset UUIDs that way), so the input order varies between
	// otherwise identical calls. The encoded query is the resolution cache key,
	// so the same asset set has to encode to the same string every time.
	t.Run("encodes the same asset set identically whatever order the caller supplies", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v8.1.0"}
		_, err := client.GetFilteredAssets(context.Background(),
			[]string{a3UUID.String(), a1UUID.String(), a2UUID.String()}, info)
		require.NoError(t, err)
		_, err = client.GetFilteredAssets(context.Background(),
			[]string{a2UUID.String(), a3UUID.String(), a1UUID.String()}, info)
		require.NoError(t, err)

		require.Len(t, *requests, 2)
		assert.Equal(t, (*requests)[0].rawQuery, (*requests)[1].rawQuery)
	})
}

func TestGetAssets(t *testing.T) {
	t.Parallel()

	t.Run("forwards query and preserves lazy-load fields from historian", func(t *testing.T) {
		t.Parallel()

		var (
			gotPath  string
			gotQuery url.Values
		)
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotPath = r.URL.Path
			gotQuery = r.URL.Query()
			_, _ = w.Write([]byte(`[{
				"UUID": "11111111-1111-1111-1111-111111111111",
				"Name": "Line 1",
				"AssetPath": "Line 1",
				"HasChildren": true,
				"HasAssetProperties": false,
				"HasEventConfigurations": true,
				"Ancestors": ["22222222-2222-2222-2222-222222222222"]
			}]`))
		}))
		t.Cleanup(srv.Close)

		client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
		require.NoError(t, err)

		assets, err := client.GetAssets(context.Background(),
			"ParentUUIDs[0]=00000000-0000-0000-0000-000000000000&IncludeHasChildren=true&IncludeHasAssetProperties=true")
		require.NoError(t, err)

		// The Include* flags must reach historian, otherwise it never returns the
		// HasChildren/HasAssetProperties fields the lazy cascader depends on.
		assert.Equal(t, "/api/assets", gotPath)
		assert.Equal(t, "00000000-0000-0000-0000-000000000000", gotQuery.Get("ParentUUIDs[0]"))
		assert.Equal(t, "true", gotQuery.Get("IncludeHasChildren"))
		assert.Equal(t, "true", gotQuery.Get("IncludeHasAssetProperties"))

		require.Len(t, assets, 1)
		a := assets[0]
		require.NotNil(t, a.HasChildren)
		assert.True(t, *a.HasChildren)
		require.NotNil(t, a.HasAssetProperties)
		assert.False(t, *a.HasAssetProperties, "a real leaf must decode as false, not be lost")
		require.NotNil(t, a.HasEventConfigurations)
		assert.True(t, *a.HasEventConfigurations)
		assert.Equal(t, []string{"22222222-2222-2222-2222-222222222222"}, a.Ancestors)
	})

	t.Run("leaves lazy-load fields nil when historian omits them", func(t *testing.T) {
		t.Parallel()

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(`[{"UUID":"11111111-1111-1111-1111-111111111111","Name":"Line 1","AssetPath":"Line 1"}]`))
		}))
		t.Cleanup(srv.Close)

		client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
		require.NoError(t, err)

		assets, err := client.GetAssets(context.Background(), "")
		require.NoError(t, err)

		require.Len(t, assets, 1)
		assert.Nil(t, assets[0].HasChildren)
		assert.Nil(t, assets[0].HasAssetProperties)
		assert.Nil(t, assets[0].HasEventConfigurations)
		assert.Nil(t, assets[0].Ancestors)
	})
}

func TestClientIdentificationHeaders(t *testing.T) {
	t.Parallel()

	var gotHeader http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Clone()
		_, _ = w.Write([]byte(`[]`))
	}))
	t.Cleanup(srv.Close)

	client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
	require.NoError(t, err)

	_, err = client.GetAssets(context.Background(), "")
	require.NoError(t, err)

	// Historian attributes incoming traffic by client: every request carries an
	// identifying User-Agent. Version is empty in tests (no build info), so
	// assert the name prefix.
	const prefix = "factry-historian-datasource/"
	userAgent := gotHeader.Get("User-Agent")
	assert.True(t, strings.HasPrefix(userAgent, prefix),
		"User-Agent %q must identify the datasource", userAgent)

	// The existing auth/org headers must keep flowing alongside the new one.
	assert.Equal(t, "Bearer tok", gotHeader.Get("Authorization"))
	assert.Equal(t, "org", gotHeader.Get("X-Organization-Uuid"))
}

// indexedQuery returns values for the indexed parameter form Foo[0]=a&Foo[1]=b in input order.
// matchPath models how the historian applies the Path asset filter: a value
// wrapped in slashes is an unanchored regular expression over asset_path,
// anything else is an exact match.
func matchPath(t *testing.T, assets []schemas.Asset, path string) []schemas.Asset {
	t.Helper()
	var matched []schemas.Asset
	if len(path) >= 2 && strings.HasPrefix(path, "/") && strings.HasSuffix(path, "/") {
		pattern, err := regexp.Compile(path[1 : len(path)-1])
		require.NoError(t, err, "the historian would reject this pattern")
		for _, asset := range assets {
			if pattern.MatchString(asset.AssetPath) {
				matched = append(matched, asset)
			}
		}
		return matched
	}
	for _, asset := range assets {
		if asset.AssetPath == path {
			matched = append(matched, asset)
		}
	}
	return matched
}

func indexedQuery(q url.Values, prefix string) []string {
	var out []string
	for i := 0; ; i++ {
		v := q.Get(fmt.Sprintf("%s[%d]", prefix, i))
		if v == "" {
			return out
		}
		out = append(out, v)
	}
}

// The historian returns 429 when its admission queue is full and 504 when a
// query exceeds its timeout. Wrapping those in an error that carries a
// downstream source lets the plugin SDK attribute them to the historian on
// every endpoint (query data, resource calls, health checks) instead of
// counting them as plugin faults. A 501 is the exception: it means the plugin
// called an endpoint this historian does not implement, which is a plugin bug.
func TestHTTPErrorCarriesErrorSource(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name         string
		statusCode   int
		body         string
		isDownstream bool
	}{
		{name: "admission queue full", statusCode: http.StatusTooManyRequests, body: `{"error":"admission queue full"}`, isDownstream: true},
		{name: "query exceeded timeout", statusCode: http.StatusGatewayTimeout, body: `{"error":"query exceeded timeout"}`, isDownstream: true},
		{name: "bad request", statusCode: http.StatusBadRequest, body: `{"error":"error executing query"}`, isDownstream: true},
		{name: "unauthorized", statusCode: http.StatusUnauthorized, body: `{"error":"invalid token"}`, isDownstream: true},
		{name: "not implemented", statusCode: http.StatusNotImplemented, body: `{"error":"unknown endpoint"}`, isDownstream: false},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(testCase.statusCode)
				_, _ = w.Write([]byte(testCase.body))
			}))
			t.Cleanup(server.Close)

			historianAPI, err := api.NewAPIWithToken(server.URL, "token", "org")
			require.NoError(t, err)

			_, err = historianAPI.GetAssets(context.Background(), "")
			require.Error(t, err)

			var httpError *api.HTTPError
			require.ErrorAs(t, err, &httpError, "the typed error must survive the error source wrapper")
			assert.Equal(t, testCase.statusCode, httpError.StatusCode)
			assert.Equal(t, testCase.body, httpError.Body, "the historian error body must be preserved")
			assert.Contains(t, err.Error(), testCase.body, "the message must still carry the body for the panel")

			assert.Equal(t, testCase.isDownstream, backend.IsDownstreamError(err), "error source attribution")
			assert.Equal(t, !testCase.isDownstream, backend.IsPluginError(err), "error source attribution")
		})
	}
}

// startPathServer serves assets filtered with the historian's Path semantics
// and returns a client against it plus an accessor for the recorded queries.
func startPathServer(t *testing.T, assets []schemas.Asset) (client *api.API, recorded func() []url.Values) {
	t.Helper()

	var (
		mu       sync.Mutex
		requests []url.Values
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		requests = append(requests, r.URL.Query())
		mu.Unlock()
		_ = json.NewEncoder(w).Encode(matchPath(t, assets, r.URL.Query().Get("Path")))
	}))
	t.Cleanup(srv.Close)

	client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
	require.NoError(t, err)

	recorded = func() []url.Values {
		mu.Lock()
		defer mu.Unlock()
		return slices.Clone(requests)
	}
	return client, recorded
}

// One request per path makes a panel that addresses its assets by path fan out
// into N requests, and the historian rebuilds the whole asset-path tree for
// each one. The Path filter accepts a regex, so the literal paths belong in a
// single anchored alternation.
func TestGetFilteredAssetsBatchesPaths(t *testing.T) {
	t.Parallel()

	// Asset paths are backslash-separated and asset names may contain regex
	// metacharacters, so every literal has to be escaped before it goes into
	// the alternation.
	mixer := schemas.Asset{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "mixer (A)"}, AssetPath: `plant\line 1\mixer (A)`}
	pump := schemas.Asset{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "pump.1"}, AssetPath: `plant\line 2\pump.1`}
	oven := schemas.Asset{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "oven+3"}, AssetPath: `plant\line 3\oven+3`}
	// decoy is matched by an unescaped "pump.1" pattern but not by an escaped one.
	decoy := schemas.Asset{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "pumpX1"}, AssetPath: `plant\line 2\pumpX1`}
	allAssets := []schemas.Asset{mixer, pump, oven, decoy}

	client, recorded := startPathServer(t, allAssets)

	info := &schemas.HistorianInfo{Version: "v8.1.0"}
	result, err := client.GetFilteredAssets(context.Background(),
		[]string{mixer.AssetPath, pump.AssetPath, oven.AssetPath}, info)
	require.NoError(t, err)

	require.Len(t, recorded(), 1, "the literal paths must collapse into one request")
	assert.Len(t, result, 3)
	assert.Contains(t, result, mixer.UUID)
	assert.Contains(t, result, pump.UUID)
	assert.Contains(t, result, oven.UUID)
	assert.NotContains(t, result, decoy.UUID, "regex metacharacters in a path must be escaped")
}

// A user-supplied regex is not a literal, so it must not be escaped and its
// unanchored semantics must survive. Only the literal paths get batched.
func TestGetFilteredAssetsKeepsUserRegexSeparate(t *testing.T) {
	t.Parallel()

	line1 := schemas.Asset{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "mixer"}, AssetPath: `plant\line 1\mixer`}
	line2 := schemas.Asset{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "mixer"}, AssetPath: `plant\line 2\mixer`}
	other := schemas.Asset{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "pump"}, AssetPath: `plant\line 3\pump`}
	allAssets := []schemas.Asset{line1, line2, other}

	client, recorded := startPathServer(t, allAssets)

	info := &schemas.HistorianInfo{Version: "v8.1.0"}
	result, err := client.GetFilteredAssets(context.Background(),
		[]string{`/mixer$/`, other.AssetPath}, info)
	require.NoError(t, err)

	require.Len(t, recorded(), 2, "a user regex keeps its own request, the literal path is batched separately")
	assert.Len(t, result, 3)
	assert.Contains(t, result, line1.UUID, "the user regex must stay unanchored and unescaped")
	assert.Contains(t, result, line2.UUID)
	assert.Contains(t, result, other.UUID)
}

// A very long alternation would push the encoded URL past the limit of a proxy
// in front of the historian, so the literal paths are batched by encoded size.
func TestGetFilteredAssetsKeepsPathBatchesWithinTheBudget(t *testing.T) {
	t.Parallel()

	const pathCount = 400
	assets := make([]schemas.Asset, 0, pathCount)
	paths := make([]string, 0, pathCount)
	for i := range pathCount {
		path := fmt.Sprintf(`plant\area %03d\line %03d`, i/10, i)
		assets = append(assets, schemas.Asset{
			BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: fmt.Sprintf("line %03d", i)},
			AssetPath: path,
		})
		paths = append(paths, path)
	}

	client, recorded := startPathServer(t, assets)

	result, err := client.GetFilteredAssets(context.Background(), paths, &schemas.HistorianInfo{Version: "v8.1.0"})
	require.NoError(t, err)

	assert.Len(t, result, pathCount, "batching must not drop any asset")
	assert.Greater(t, len(recorded()), 1, "the alternation must be split into multiple requests")
}
