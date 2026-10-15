package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	testAssetUUID     = uuid.MustParse("fbbc1516-50a2-4e16-92c0-ea4b38c2997f")
	testEventTypeUUID = uuid.MustParse("11c36104-92b5-11ef-96de-0242c0a81002")
)

// assertNoOctetIndexedKeys fails on the shape a form encoder without a uuid.UUID
// custom type func produces: it walks the underlying [16]byte and emits one key per
// octet (AssetUUIDs[0][0]=251&AssetUUIDs[0][1]=188&...). Historian 8.2 binds query
// parameters from the OpenAPI spec and only reads the exact AssetUUIDs key, so the
// octet keys are silently dropped and the request degenerates to an unfiltered query.
func assertNoOctetIndexedKeys(t *testing.T, query url.Values) {
	t.Helper()
	for key := range query {
		assert.NotContains(t, key, "][", "UUIDs must be sent as strings, not one octet per key")
	}
}

func TestEventQueryEncodesUUIDFiltersAsStrings(t *testing.T) {
	t.Parallel()

	var gotQuery url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query()
		_, _ = w.Write([]byte(`[]`))
	}))
	t.Cleanup(srv.Close)

	client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
	require.NoError(t, err)

	_, err = client.EventQuery(context.Background(), schemas.EventFilter{
		AssetUUIDs:     []uuid.UUID{testAssetUUID},
		EventTypeUUIDs: []uuid.UUID{testEventTypeUUID},
	}, &schemas.HistorianInfo{Version: "v8.1.0"})
	require.NoError(t, err)

	assertNoOctetIndexedKeys(t, gotQuery)
	assert.Equal(t, testAssetUUID.String(), gotQuery.Get("AssetUUIDs[0]"))
	assert.Equal(t, testEventTypeUUID.String(), gotQuery.Get("EventTypeUUIDs[0]"))
}

func TestGetDistinctEventPropertyValuesEncodesUUIDFiltersAsStrings(t *testing.T) {
	t.Parallel()

	var gotQuery url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/api/assets"):
			_, _ = fmt.Fprintf(w, `[{"UUID":%q,"Name":"Line 1","AssetPath":"Line 1"}]`, testAssetUUID)
		case strings.HasPrefix(r.URL.Path, "/api/event-types"):
			_, _ = fmt.Fprintf(w, `[{"UUID":%q,"Name":"Batch"}]`, testEventTypeUUID)
		default:
			gotQuery = r.URL.Query()
			_, _ = w.Write([]byte(`[]`))
		}
	}))
	t.Cleanup(srv.Close)

	client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
	require.NoError(t, err)

	_, err = client.GetDistinctEventPropertyValues(context.Background(), uuid.NewString(), schemas.EventPropertyValuesRequest{
		EventQuery: schemas.EventQuery{
			Assets:     []string{testAssetUUID.String()},
			EventTypes: []string{testEventTypeUUID.String()},
		},
		HistorianInfo: schemas.HistorianInfo{Version: "v8.2.0"},
		TimeRange:     backend.TimeRange{},
	})
	require.NoError(t, err)

	assertNoOctetIndexedKeys(t, gotQuery)
	assert.Equal(t, testAssetUUID.String(), gotQuery.Get("AssetUUIDs[0]"))
	assert.Equal(t, testEventTypeUUID.String(), gotQuery.Get("EventTypeUUIDs[0]"))
}

func TestGetDistinctEventPropertyValuesNormalisesPropertyFilters(t *testing.T) {
	t.Parallel()

	var gotQuery url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/api/assets"):
			_, _ = fmt.Fprintf(w, `[{"UUID":%q,"Name":"Line 1","AssetPath":"Line 1"}]`, testAssetUUID)
		case strings.HasPrefix(r.URL.Path, "/api/event-types"):
			_, _ = fmt.Fprintf(w, `[{"UUID":%q,"Name":"Batch"}]`, testEventTypeUUID)
		default:
			gotQuery = r.URL.Query()
			_, _ = w.Write([]byte(`[]`))
		}
	}))
	t.Cleanup(srv.Close)

	client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
	require.NoError(t, err)

	operators := []string{"EXISTS", "NOT EXISTS", "IS NULL", "IS NOT NULL"}
	propertyFilter := make([]schemas.EventPropertyValueFilter, 0, len(operators))
	for _, operator := range operators {
		// older saved queries have no Datatype, and the frontend sends a dummy value for operators without one
		propertyFilter = append(propertyFilter, schemas.EventPropertyValueFilter{
			Property: "line",
			Operator: operator,
			Value:    []interface{}{"undefined"},
		})
	}

	_, err = client.GetDistinctEventPropertyValues(context.Background(), uuid.NewString(), schemas.EventPropertyValuesRequest{
		EventQuery: schemas.EventQuery{
			Assets:         []string{testAssetUUID.String()},
			EventTypes:     []string{testEventTypeUUID.String()},
			PropertyFilter: propertyFilter,
		},
		HistorianInfo: schemas.HistorianInfo{Version: "v8.2.0"},
		TimeRange:     backend.TimeRange{},
	})
	require.NoError(t, err)

	for i, operator := range operators {
		assert.Equal(t, operator, gotQuery.Get(fmt.Sprintf("PropertyFilter[%d].Operator", i)))
		assert.Equal(t, "string", gotQuery.Get(fmt.Sprintf("PropertyFilter[%d].Datatype", i)))
		for key := range gotQuery {
			assert.NotContains(t, key, fmt.Sprintf("PropertyFilter[%d].Value", i), "%s must not send a value", operator)
		}
	}
}

func TestEventQueryPostsFilterAsJSONBodyFromHistorian82(t *testing.T) {
	t.Parallel()

	var gotMethod, gotPath string
	var gotBody map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_, _ = w.Write([]byte(`[]`))
	}))
	t.Cleanup(srv.Close)

	client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
	require.NoError(t, err)

	_, err = client.EventQuery(context.Background(), schemas.EventFilter{
		AssetUUIDs:     []uuid.UUID{testAssetUUID},
		EventTypeUUIDs: []uuid.UUID{testEventTypeUUID},
		Limit:          25,
		PropertyFilter: []schemas.EventPropertyValueFilter{{Property: "line", Operator: "EXISTS", Value: []interface{}{"undefined"}}},
	}, &schemas.HistorianInfo{Version: "v8.2.0"})
	require.NoError(t, err)

	assert.Equal(t, http.MethodPost, gotMethod)
	assert.Equal(t, "/api/events/query", gotPath)
	assert.InDelta(t, 25, gotBody["Limit"], 0)

	filter, ok := gotBody["Filter"].(map[string]interface{})
	require.True(t, ok, "the filter must be sent as the Filter object")
	assert.NotContains(t, filter, "Limit", "Limit belongs on the query, not on the filter")
	assert.Equal(t, []interface{}{testAssetUUID.String()}, filter["AssetUUIDs"])
	assert.Equal(t, []interface{}{testEventTypeUUID.String()}, filter["EventTypeUUIDs"])

	propertyFilter, ok := filter["PropertyFilter"].([]interface{})
	require.True(t, ok)
	require.Len(t, propertyFilter, 1)
	assert.Equal(t, "string", propertyFilter[0].(map[string]interface{})["Datatype"], "property filters must be normalised like on the GET path")
	assert.Nil(t, propertyFilter[0].(map[string]interface{})["Value"])
}

func TestEventQuerySendsIncludedEventPropertyUUIDsFromHistorian83(t *testing.T) {
	t.Parallel()

	batch := schemas.EventTypeProperty{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "batch"}}

	tests := []struct {
		version string
		want    interface{}
	}{
		{version: "v8.2.3", want: nil},
		{version: "v8.3.0-rc.1", want: []interface{}{batch.UUID.String()}},
		{version: "v8.3.0", want: []interface{}{batch.UUID.String()}},
	}

	for i := range tests {
		tt := tests[i]
		t.Run(tt.version, func(t *testing.T) {
			t.Parallel()

			var gotBody map[string]interface{}
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewDecoder(r.Body).Decode(&gotBody)
				_, _ = w.Write([]byte(`[]`))
			}))
			t.Cleanup(srv.Close)

			client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
			require.NoError(t, err)

			_, err = client.EventQuery(context.Background(), schemas.EventFilter{Properties: []schemas.EventTypeProperty{batch}}, &schemas.HistorianInfo{Version: tt.version})
			require.NoError(t, err)

			assert.Equal(t, tt.want, gotBody["IncludedEventPropertyUUIDs"])
			assert.NotContains(t, gotBody, "IncludedParentEventPropertyUUIDs")
			filter, ok := gotBody["Filter"].(map[string]interface{})
			require.True(t, ok)
			assert.NotContains(t, filter, "Properties")
		})
	}
}

// Historian before 8.3 can't filter the returned properties, so the client removes
// the ones that weren't asked for. Parent events keep all their properties, like on 8.3.
func TestEventQueryRemovesUnselectedPropertiesBeforeHistorian83(t *testing.T) {
	t.Parallel()

	const response = `[{"Properties":{"Properties":{"batch":"B1","recipe":"R1"}},` +
		`"Parent":{"Properties":{"Properties":{"batch":"P1","line":"L1"}}}}]`

	for _, version := range []string{"v8.1.0", "v8.2.0"} {
		t.Run(version, func(t *testing.T) {
			t.Parallel()

			var gotQuery url.Values
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotQuery = r.URL.Query()
				_, _ = w.Write([]byte(response))
			}))
			t.Cleanup(srv.Close)

			client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
			require.NoError(t, err)

			events, err := client.EventQuery(context.Background(), schemas.EventFilter{
				Properties: []schemas.EventTypeProperty{{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "batch"}}},
			}, &schemas.HistorianInfo{Version: version})
			require.NoError(t, err)

			require.Len(t, events, 1)
			assert.Equal(t, schemas.Attributes{"batch": "B1"}, events[0].Properties.Properties)
			assert.Equal(t, schemas.Attributes{"batch": "P1", "line": "L1"}, events[0].Parent.Properties.Properties)
			assert.NotContains(t, gotQuery, "Properties[0]", "the GET path has no properties filter")
		})
	}
}

func TestEventQueryKeepsAllPropertiesWithoutASelection(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`[{"Properties":{"Properties":{"batch":"B1","recipe":"R1"}}}]`))
	}))
	t.Cleanup(srv.Close)

	client, err := api.NewAPIWithToken(srv.URL, "tok", "org")
	require.NoError(t, err)

	events, err := client.EventQuery(context.Background(), schemas.EventFilter{}, &schemas.HistorianInfo{Version: "v8.2.0"})
	require.NoError(t, err)

	require.Len(t, events, 1)
	assert.Equal(t, schemas.Attributes{"batch": "B1", "recipe": "R1"}, events[0].Properties.Properties)
}
