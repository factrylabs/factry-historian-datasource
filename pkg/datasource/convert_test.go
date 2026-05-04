package datasource

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestToFloat64(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		in    interface{}
		want  float64
		wantOk bool
	}{
		{"float passthrough", 3.14, 3.14, true},
		{"NaN passthrough", math.NaN(), math.NaN(), true},
		{"true to one", true, 1.0, true},
		{"false to zero", false, 0.0, true},
		{"numeric string", "42.5", 42.5, true},
		{"non-numeric string", "running", 0, false},
		{"unsupported type", []byte("1"), 0, false},
		{"nil", nil, 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, ok := toFloat64(tc.in)
			assert.Equal(t, tc.wantOk, ok)
			if tc.wantOk && !math.IsNaN(tc.want) {
				assert.InDelta(t, tc.want, got, 0)
			}
			if tc.wantOk && math.IsNaN(tc.want) {
				assert.True(t, math.IsNaN(got))
			}
		})
	}
}

func TestToString(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		in    interface{}
		want  string
		wantOk bool
	}{
		{"string passthrough", "running", "running", true},
		{"float shortest", 3.14, "3.14", true},
		{"float integer-valued", 42.0, "42", true},
		{"true", true, "true", true},
		{"false", false, "false", true},
		{"unsupported type", []byte("x"), "", false},
		{"nil", nil, "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, ok := toString(tc.in)
			assert.Equal(t, tc.wantOk, ok)
			if tc.wantOk {
				assert.Equal(t, tc.want, got)
			}
		})
	}
}

func TestToBool(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		in    interface{}
		want  bool
		wantOk bool
	}{
		{"bool passthrough", true, true, true},
		{"non-zero float", 0.5, true, true},
		{"NaN is non-zero", math.NaN(), true, true},
		{"zero float", 0.0, false, true},
		{"true string", "true", true, true},
		{"false string", "false", false, true},
		{"1 string", "1", true, true},
		{"0 string", "0", false, true},
		{"non-bool string", "running", false, false},
		{"unsupported type", []byte("x"), false, false},
		{"nil", nil, false, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, ok := toBool(tc.in)
			assert.Equal(t, tc.wantOk, ok)
			if tc.wantOk {
				assert.Equal(t, tc.want, got)
			}
		})
	}
}
