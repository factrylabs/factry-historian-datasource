package api_test

import (
	"context"
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
	})
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
