package datasource

import (
	"encoding/json"
	"maps"
	"net/http"
	"slices"

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

func handleJSON(f func(http.ResponseWriter, *http.Request) (interface{}, error)) http.HandlerFunc {
	return func(rw http.ResponseWriter, req *http.Request) {
		response, err := f(rw, req)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusBadRequest)
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
		if _, err := rw.Write(jsonResponse); err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
		}
		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(http.StatusOK)
	}
}
