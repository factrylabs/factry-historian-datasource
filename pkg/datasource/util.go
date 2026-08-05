package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"slices"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func getStringSetFromFrames(frames data.Frames, fieldName string) []string {
	values := map[string]struct{}{}

	for _, frame := range frames {
		field, fieldFound := frame.FieldByName(fieldName)
		if fieldFound == -1 {
			continue
		}

		for i := range field.Len() {
			value, ok := field.At(i).(*string)
			if !ok || value == nil {
				continue
			}

			values[*value] = struct{}{}
		}
	}

	return slices.AppendSeq(make([]string, 0, len(values)), maps.Keys(values))
}

// resourceErrorStatus maps a failed resource call onto an HTTP status. A failure
// reported by the historian keeps its own status code, so the query editor and
// dashboard variables see e.g. a 429 (admission queue full) instead of a
// blanket bad request. Everything else is a request the plugin itself rejected.
func resourceErrorStatus(err error) int {
	var httpError *api.HTTPError
	if errors.As(err, &httpError) {
		return httpError.StatusCode
	}

	return http.StatusBadRequest
}

// attributeResourceError records a historian failure as a downstream error.
// handleJSON reports the failure through the response writer rather than
// returning it, so the SDK cannot inspect the error itself and would otherwise
// attribute the call to the plugin.
func attributeResourceError(ctx context.Context, err error) {
	if !backend.IsDownstreamError(err) {
		return
	}

	if sourceErr := backend.WithDownstreamErrorSource(ctx); sourceErr != nil {
		log.DefaultLogger.FromContext(ctx).Debug("could not set downstream error source", "error", sourceErr)
	}
}

func handleJSON(f func(http.ResponseWriter, *http.Request) (interface{}, error)) http.HandlerFunc {
	return func(rw http.ResponseWriter, req *http.Request) {
		response, err := f(rw, req)
		if err != nil {
			attributeResourceError(req.Context(), err)
			http.Error(rw, err.Error(), resourceErrorStatus(err))
			return
		}

		if response == nil {
			http.Error(rw, "received empty response", http.StatusInternalServerError)
			return
		}

		// Marshal the response to JSON
		jsonResponse, err := json.Marshal(response)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		// Set the content type and write the response
		rw.Header().Set("Content-Type", "application/json")
		if _, err := rw.Write(jsonResponse); err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
		}
	}
}
