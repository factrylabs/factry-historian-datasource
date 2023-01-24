package schemas

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cast"
)

// Attributes is a custom type for Handling the postgres JSONB datatype
type Attributes map[string]interface{}

// GetString returns string value for key
func (a Attributes) GetString(key string) string {
	val, ok := a[key]
	if !ok || val == nil {
		return ""
	}

	return cast.ToString(val)
}

// GetInt returns a int value for a key
func (a Attributes) GetInt(key string) (int, error) {
	emptyInt := 0
	val, ok := a[key]
	if !ok || val == nil {
		return emptyInt, fmt.Errorf("Failed to get value from key: %v", key)
	}

	return cast.ToIntE(val)
}

// GetFloat64 returns a float64 value for a key
func (a Attributes) GetFloat64(key string) (float64, error) {
	emptyFloat := 0.0
	val, ok := a[key]
	if !ok || val == nil {
		return emptyFloat, fmt.Errorf("Failed to get value from key: %v", key)
	}

	return cast.ToFloat64E(val)
}

// GetBool returns a bool value for a key
func (a Attributes) GetBool(key string) (bool, error) {
	val, ok := a[key]
	if !ok || val == nil {
		return false, fmt.Errorf("Failed to get value from key: %v", key)
	}

	return cast.ToBoolE(val)
}

// GetSlice returns a slice value for a key
func (a Attributes) GetSlice(key string) ([]interface{}, error) {
	val, ok := a[key]
	if !ok || val == nil {
		return nil, fmt.Errorf("Failed to get value from key: %v", key)
	}

	return cast.ToSliceE(val)
}

// GetMap returns a map value for a key
func (a Attributes) GetMap(key string) (map[string]interface{}, error) {
	val, ok := a[key]
	if !ok || val == nil {
		return nil, fmt.Errorf("Failed to get value from key: %v", key)
	}

	if result, ok := a[key].(Attributes); ok {
		return result, nil
	}

	return cast.ToStringMapE(val)
}

// GetAttributes returns an Attributes value for a key
func (a Attributes) GetAttributes(key string) (Attributes, error) {
	return a.GetMap(key)
}

// AttributesArray is an array of Attributes
type AttributesArray []map[string]interface{}

// Get tries to parse an interface from the map
func (a Attributes) Get(key string, object interface{}) error {
	value, ok := a[key]
	if !ok {
		return fmt.Errorf("Error getting %s from attributes: key not found", key)
	}

	jsonbody, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("Error getting %s from attributes: %v", key, err)
	}

	if err := json.Unmarshal(jsonbody, &object); err != nil {
		return fmt.Errorf("Error getting %s from attributes: %v", key, err)
	}
	return nil
}

// UnMarshal tries to parse an interface from the map
func (a Attributes) UnMarshal(object interface{}) error {

	jsonbody, err := json.Marshal(a)
	if err != nil {
		return fmt.Errorf("Error unmarshalling attributes: %v", err)
	}

	if err := json.Unmarshal(jsonbody, &object); err != nil {
		return fmt.Errorf("Error unmarshalling attributes: %v", err)
	}
	return nil
}
