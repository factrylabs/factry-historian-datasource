package datasource

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// handleGetEventPropertyValues indexes request.Properties[0] without a length
// check when the path value is not a UUID. Resource-handler panics are not
// recovered by the SDK, so this must return an error instead of killing the
// whole plugin process.
func TestEventPropertyValuesWithoutPropertiesParamDoesNotPanic(t *testing.T) {
	t.Parallel()

	historianMux := http.NewServeMux()
	historianMux.HandleFunc("GET /api/event-type-properties", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, []schemas.EventTypeProperty{{
			BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "other"},
		}})
	})
	ds := newFakeHistorianDataSource(t, historianMux)

	resourceMux := http.NewServeMux()
	resourceMux.HandleFunc("GET /event-property-values/{uuid}", handleJSON(ds.handleGetEventPropertyValues))

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/event-property-values/someName", http.NoBody)
	rec := httptest.NewRecorder()
	assert.NotPanics(t, func() {
		resourceMux.ServeHTTP(rec, req)
	}, "a resource call without Properties[0] must return an error, not kill the plugin process")
}

// Resource calls back the query editor and dashboard variables. Collapsing
// every failure onto 400 hides the historian's own status, so a 429 (admission
// queue full) reaches the browser as a bad request blamed on the plugin.
// Errors the plugin raises about the request itself stay 400.
func TestResourceCallForwardsHistorianStatus(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name            string
		historianStatus int
		historianBody   string
		path            string
		expectedStatus  int
		expectedBody    string
	}{
		{
			name:            "rate limited",
			historianStatus: http.StatusTooManyRequests,
			historianBody:   `{"error":"admission queue full"}`,
			path:            "/assets",
			expectedStatus:  http.StatusTooManyRequests,
			expectedBody:    "admission queue full",
		},
		{
			name:            "timed out",
			historianStatus: http.StatusGatewayTimeout,
			historianBody:   `{"error":"query exceeded timeout"}`,
			path:            "/assets",
			expectedStatus:  http.StatusGatewayTimeout,
			expectedBody:    "query exceeded timeout",
		},
		{
			name:            "unauthorized",
			historianStatus: http.StatusUnauthorized,
			historianBody:   `{"error":"invalid token"}`,
			path:            "/assets",
			expectedStatus:  http.StatusUnauthorized,
			expectedBody:    "invalid token",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			historianMux := http.NewServeMux()
			historianMux.HandleFunc("GET /api/assets", func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(testCase.historianStatus)
				_, _ = w.Write([]byte(testCase.historianBody))
			})
			ds := newFakeHistorianDataSource(t, historianMux)

			resourceMux := http.NewServeMux()
			resourceMux.HandleFunc("GET /assets", handleJSON(ds.handleGetAssets))

			rec := httptest.NewRecorder()
			resourceMux.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, testCase.path, http.NoBody))

			assert.Equal(t, testCase.expectedStatus, rec.Code, "the historian status must reach grafana")
			assert.Contains(t, rec.Body.String(), testCase.expectedBody, "the historian error body must reach grafana")
		})
	}
}

// A request the plugin itself rejects is a bad request, not a historian failure.
func TestResourceCallKeepsBadRequestForInvalidInput(t *testing.T) {
	t.Parallel()

	ds := newFakeHistorianDataSource(t, http.NewServeMux())

	// no path values on the request, so the handler rejects it before ever
	// reaching the historian
	rec := httptest.NewRecorder()
	handleJSON(ds.handleGetTagValueForMeasurementAndTagKey)(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/measurements/x/tags/y", http.NoBody))

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "uuid is required")
}

// An event type variable that resolves to "" reaches the resource handler as an
// empty entry in EventTypes. Forwarding it as "EventTypeUUIDs[n]=" makes
// historian >= 8.2 reject the lookup with 400 'empty value is not allowed', so
// the entry must be left out of the query. The same holds for an unset Type.
func TestEventPropertyValuesLookupOmitsEmptyEventTypesAndType(t *testing.T) {
	t.Parallel()

	eventTypeUUID := uuid.New()
	gotQuery := make(chan string, 1)

	historianMux := http.NewServeMux()
	historianMux.HandleFunc("GET /api/event-type-properties", func(w http.ResponseWriter, r *http.Request) {
		gotQuery <- r.URL.RawQuery
		writeJSON(w, []schemas.EventTypeProperty{{
			BaseModel:     schemas.BaseModel{UUID: uuid.New(), Name: "recipe"},
			EventTypeUUID: eventTypeUUID,
		}})
	})
	historianMux.HandleFunc("GET /api/assets", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, []schemas.Asset{})
	})
	ds := newFakeHistorianDataSource(t, historianMux)

	resourceMux := http.NewServeMux()
	resourceMux.HandleFunc("GET /event-property-values/{uuid}", handleJSON(ds.handleGetEventPropertyValues))

	target := "/event-property-values/recipe?Properties[0]=recipe&Type=&EventTypes[0]=" + eventTypeUUID.String() + "&EventTypes[1]="
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, target, http.NoBody)
	resourceMux.ServeHTTP(httptest.NewRecorder(), req)

	query, err := url.ParseQuery(<-gotQuery)
	require.NoError(t, err)

	for key, values := range query {
		for _, value := range values {
			assert.NotEmpty(t, value, "%s must not be sent with an empty value", key)
		}
	}
	assert.Equal(t, []string{eventTypeUUID.String()}, query["EventTypeUUIDs[0]"], "the resolved event type must still be sent")
}
