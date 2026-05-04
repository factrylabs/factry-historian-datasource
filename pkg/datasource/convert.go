package datasource

import "strconv"

// toFloat64 coerces a scalar value into float64. Bools map to 1/0 and strings
// parse as decimal. Returns ok=false when the value is not one of these types
// or the string is not a valid number.
func toFloat64(v interface{}) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case bool:
		if x {
			return 1.0, true
		}
		return 0.0, true
	case string:
		if f, err := strconv.ParseFloat(x, 64); err == nil {
			return f, true
		}
	}
	return 0, false
}

// toString coerces a scalar value into its string representation. Floats use
// the shortest round-trippable form; bools render as "true"/"false".
func toString(v interface{}) (string, bool) {
	switch x := v.(type) {
	case string:
		return x, true
	case float64:
		return strconv.FormatFloat(x, 'g', -1, 64), true
	case bool:
		return strconv.FormatBool(x), true
	}
	return "", false
}

// toBool coerces a scalar value into bool. Non-zero floats become true; strings
// parse via strconv.ParseBool ("true"/"false"/"1"/"0"/etc.).
func toBool(v interface{}) (value, ok bool) {
	switch x := v.(type) {
	case bool:
		return x, true
	case float64:
		return x != 0, true
	case string:
		if b, err := strconv.ParseBool(x); err == nil {
			return b, true
		}
	}
	return false, false
}
