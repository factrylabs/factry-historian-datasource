package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
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
	byPath := map[string]schemas.Asset{
		a1.AssetPath: a1,
		a2.AssetPath: a2,
		a3.AssetPath: a3,
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
				if a, ok := byPath[q.Get("Path")]; ok {
					matched = append(matched, a)
				}
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

	t.Run("v8.1.0 batches uuids and queries paths individually", func(t *testing.T) {
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

		require.Len(t, *requests, 2, "expected one batched UUIDs request followed by one path request")
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

		require.Len(t, *requests, 2)
		for _, req := range *requests {
			assert.Empty(t, indexedQuery(req.query, "UUIDs"), "no UUIDs[i] should be sent when input has no uuids")
			assert.NotEmpty(t, req.query.Get("Path"))
		}
	})

	t.Run("v6.4.0 issues per-asset Keyword and Path requests", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v6.4.0"}
		result, err := client.GetFilteredAssets(context.Background(),
			[]string{a1UUID.String(), "site/a2"}, info)
		require.NoError(t, err)
		assert.Contains(t, result, a1UUID)
		assert.Contains(t, result, a2UUID)

		require.Len(t, *requests, 2, "v6.4 branch must issue one request per input")
		assert.Equal(t, a1UUID.String(), (*requests)[0].query.Get("Keyword"))
		assert.Empty(t, indexedQuery((*requests)[0].query, "UUIDs"), "v6.4 branch must not use the v8 UUIDs[i] form")
		assert.Equal(t, "site/a2", (*requests)[1].query.Get("Path"))
	})

	t.Run("v7.x stays on per-asset Keyword/Path", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v7.5.3"}
		_, err := client.GetFilteredAssets(context.Background(), []string{a1UUID.String()}, info)
		require.NoError(t, err)

		require.Len(t, *requests, 1)
		assert.Equal(t, a1UUID.String(), (*requests)[0].query.Get("Keyword"))
		assert.Empty(t, indexedQuery((*requests)[0].query, "UUIDs"))
	})

	t.Run("legacy below v6.4.0 fetches all and filters in memory", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v6.3.0"}
		result, err := client.GetFilteredAssets(context.Background(),
			[]string{a1UUID.String(), "site/a2"}, info)
		require.NoError(t, err)
		assert.Contains(t, result, a1UUID)
		assert.Contains(t, result, a2UUID)
		assert.NotContains(t, result, a3UUID)

		require.Len(t, *requests, 1, "deprecated branch must issue a single unfiltered call")
		assert.Empty(t, (*requests)[0].rawQuery, "deprecated request must carry no query params")
	})

	t.Run("nil historian info falls back to legacy branch", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		result, err := client.GetFilteredAssets(context.Background(), []string{"site/a1"}, nil)
		require.NoError(t, err)
		assert.Contains(t, result, a1UUID)

		require.Len(t, *requests, 1)
		assert.Empty(t, (*requests)[0].rawQuery)
	})

	t.Run("v6.4.0 deduplicates repeated asset strings", func(t *testing.T) {
		t.Parallel()
		srv, requests := startServer(t)
		client := newClient(t, srv.URL)

		info := &schemas.HistorianInfo{Version: "v6.4.0"}
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
}

// indexedQuery returns values for the indexed parameter form Foo[0]=a&Foo[1]=b in input order.
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
