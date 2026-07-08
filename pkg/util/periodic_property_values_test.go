package util_test

import (
	"encoding/json"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/stretchr/testify/assert"
)

// PeriodicPropertyValues.UnmarshalJSON indexes v.Values[i] for every offset
// without a bounds check, while DimensionValues one line below is
// bounds-checked. A periodic property payload with more "t" entries than "v"
// entries must not panic the event query.
func TestPeriodicPropertyValuesLengthMismatchDoesNotPanic(t *testing.T) {
	t.Parallel()

	assert.NotPanics(t, func() {
		p := util.PeriodicPropertyValues{}
		// Malformed payload: 2 offsets, 1 value. Must return an error (or skip
		// the missing entry), not panic.
		_ = json.Unmarshal([]byte(`{"t":[0,1],"v":[10]}`), &p)
	})
}
