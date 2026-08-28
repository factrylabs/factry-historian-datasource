package util

import (
	"bytes"
	"encoding/json"
	"fmt"
	"maps"
	"net/url"
	"reflect"
	"slices"

	"github.com/google/uuid"
)

// Unique checks if all values in the array are unique
func Unique[T comparable](arr []T) bool {
	seen := make(map[T]bool)
	for _, str := range arr {
		if seen[str] {
			return false
		}
		seen[str] = true
	}
	return true
}

// Dedupe returns a copy of arr with duplicate entries removed, preserving the order
// of first occurrence.
func Dedupe[T comparable](arr []T) []T {
	seen := make(map[T]struct{}, len(arr))
	out := make([]T, 0, len(arr))
	for _, v := range arr {
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

// AddSortedIndexedParams adds values to query as name[0], name[1], ... in
// sorted order. url.Values.Encode sorts by key name only, so a caller whose
// encoded query doubles as a cache key needs the values themselves in a
// stable order. The input slice is not modified.
func AddSortedIndexedParams(query url.Values, name string, values []string) {
	for i, value := range slices.Sorted(slices.Values(values)) {
		query.Add(fmt.Sprintf("%s[%d]", name, i), value)
	}
}

// AddSortedIndexedUUIDs adds the keys of uuids to query as name[0], name[1],
// ... in sorted order. Sorting the raw bytes gives the same order as sorting
// the lowercase-hex string form, so the encoding matches
// AddSortedIndexedParams over the same UUIDs as strings.
func AddSortedIndexedUUIDs[T any](query url.Values, name string, uuids map[uuid.UUID]T) {
	sorted := slices.SortedFunc(maps.Keys(uuids), func(a, b uuid.UUID) int {
		return bytes.Compare(a[:], b[:])
	})
	for i, id := range sorted {
		query.Add(fmt.Sprintf("%s[%d]", name, i), id.String())
	}
}

// DropEmpty returns a copy of arr without its empty strings. A dashboard variable
// that resolves to an empty string reaches the backend as "", and the form encoder
// writes that as an empty query parameter, which historian >= 8.2 rejects with 400
// 'empty value is not allowed'. Returns nil when nothing is left, so the encoder
// omits the parameter entirely.
func DropEmpty(arr []string) []string {
	out := make([]string, 0, len(arr))
	for _, v := range arr {
		if v != "" {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// Model is an interface for objects with a UUID field
type Model interface {
	// GetUUID returns the UUID of the object
	GetUUID() uuid.UUID
}

// ByUUID converts a slice of objects with a UUID field to a map with the UUID as key
func ByUUID[T Model](arr []T) map[uuid.UUID]T {
	return ByFunc(arr, func(obj T) (uuid.UUID, bool) {
		return obj.GetUUID(), true
	})
}

// ByFunc converts a slice of objects to a map, using the provided key selector
func ByFunc[T any, K comparable](arr []T, keySelector func(T) (K, bool)) map[K]T {
	m := make(map[K]T)
	for _, obj := range arr {
		if key, ok := keySelector(obj); ok {
			m[key] = obj
		}
	}
	return m
}

// GetUUIDs returns a slice of GetUUIDs from a slice of objects with a UUID field
func GetUUIDs[T Model](arr []T) []uuid.UUID {
	uuids := make([]uuid.UUID, len(arr))
	for i, obj := range arr {
		uuids[i] = obj.GetUUID()
	}
	return uuids
}

// DeepCopy performs a deep copy
func DeepCopy[T any](dst *T, src T) error {
	data, err := json.Marshal(src)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, dst)
}

// MarshalStructToMap marshals a struct into a map[string]interface{}
func MarshalStructToMap(input interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// Get the reflection of the input struct
	value := reflect.ValueOf(input)
	typ := reflect.TypeOf(input)

	// Ensure the input is a struct
	if value.Kind() != reflect.Struct {
		return result
	}

	// Iterate over struct fields
	for i := 0; i < value.NumField(); i++ {
		if !typ.Field(i).IsExported() {
			continue
		}

		fieldName := typ.Field(i).Name

		fieldValue := value.Field(i).Interface()

		// Add the field name and value to the map
		result[fieldName] = fieldValue
	}

	return result
}
