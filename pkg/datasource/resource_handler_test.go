package datasource

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
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

	req := httptest.NewRequest(http.MethodGet, "/event-property-values/someName", http.NoBody)
	rec := httptest.NewRecorder()
	assert.NotPanics(t, func() {
		resourceMux.ServeHTTP(rec, req)
	}, "a resource call without Properties[0] must return an error, not kill the plugin process")
}
