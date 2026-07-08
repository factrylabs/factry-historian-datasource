package util_test

import (
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/stretchr/testify/assert"
)

func TestSemverCompare(t *testing.T) {
	tests := []struct {
		a, b     string
		expected bool
	}{
		{"1.0.0", "1.0.1", true},
		{"1.0.1", "1.0.0", false},
		{"1.0.0", "1.0.0", false},
		{"1.2.3", "1.2.4", true},
		{"1.2.3", "1.3.0", true},
		{"2.0.0", "1.9.9", false},
		{"1.10.0", "1.2.0", false},
		{"1.0.0", "1.0.0-alpha", false},
		{"1.0.0-alpha", "1.0.0", true},
		{"1.0.0-alpha.1", "1.0.0-alpha", false},
		{"1.0.0-alpha.1", "1.0.0-beta", true},
	}

	for _, tt := range tests {
		t.Run(tt.a+"_"+tt.b, func(t *testing.T) {
			result := util.SemverCompare(tt.a, tt.b)
			assert.Equal(t, tt.expected, result < 0)
		})
	}
}

// comparePreRelease must not pad the shorter pre-release with "" (non-numeric),
// which would invert SemVer precedence. Per spec item 11.4,
// 1.0.0-alpha < 1.0.0-alpha.1: a larger identifier set wins when the shared
// prefix is equal.
func TestSemverPreReleasePrecedence(t *testing.T) {
	t.Parallel()

	assert.Negative(t, util.SemverCompare("1.0.0-alpha", "1.0.0-alpha.1"),
		"1.0.0-alpha must be lower precedence than 1.0.0-alpha.1")
	assert.Positive(t, util.SemverCompare("1.0.0-alpha.1", "1.0.0-alpha"),
		"1.0.0-alpha.1 must be higher precedence than 1.0.0-alpha")
}
