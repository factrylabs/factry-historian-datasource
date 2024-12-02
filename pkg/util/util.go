package util

import (
	"encoding/json"
	"reflect"

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

// Model is an interface for objects with a UUID field
type Model interface {
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

// Ptr returns a pointer to the provided value
func Ptr[T any](v T) *T {
	return &v
}

// PtrSlice returns a slice of pointers to the provided values
func PtrSlice[T any](v []T) []*T {
	ptrs := make([]*T, len(v))
	for i := range v {
		ptrs[i] = &v[i]
	}
	return ptrs
}
