package util_test

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestNewPeriodicPropertyValues(t *testing.T) {
	t.Parallel()

	t.Run("without dimensions", func(t *testing.T) {
		t.Parallel()
		p := util.NewPeriodicPropertyValues()
		require.NotNil(t, p)
		assert.NotNil(t, p.ValuesByOffset)
		assert.False(t, p.HasDimensionValues())
	})

	t.Run("with dimensions", func(t *testing.T) {
		t.Parallel()
		p := util.NewPeriodicPropertyValuesWithDimension()
		require.NotNil(t, p)
		assert.NotNil(t, p.ValuesByOffset)
		assert.True(t, p.HasDimensionValues())
	})
}

func TestValueAccessors(t *testing.T) {
	t.Parallel()

	p := util.NewPeriodicPropertyValues()
	p.SetValueAt(1.0, "a")
	p.AppendValue(2.0, "b")

	assert.Equal(t, "a", p.GetValueAt(1.0))
	assert.Equal(t, "b", p.GetValueAt(2.0))
	assert.Nil(t, p.GetValueAt(99.0), "missing offset returns nil")

	p.RemoveValueAt(1.0)
	assert.Nil(t, p.GetValueAt(1.0))
	assert.Equal(t, "b", p.GetValueAt(2.0))

	// Removing a missing offset is a no-op.
	p.RemoveValueAt(99.0)
	assert.Equal(t, "b", p.GetValueAt(2.0))
}

// Dimension-only methods (SetDimensionValueAt, SetValueAtWithDimension) must
// no-op on a no-dimension instance and populate both slots on a dimension
// instance. RemoveValueAt must clear both slots when dimensions are enabled.
func TestDimensionGating(t *testing.T) {
	t.Parallel()

	t.Run("dimension methods no-op without dimension", func(t *testing.T) {
		t.Parallel()
		p := util.NewPeriodicPropertyValues()
		p.SetDimensionValueAt(1.0, "kg")
		p.SetValueAtWithDimension(2.0, "a", "kg")

		assert.Nil(t, p.GetValueAt(1.0))
		assert.Nil(t, p.GetValueAt(2.0))
		assert.Nil(t, p.GetDimensionValueAt(1.0))
	})

	t.Run("dimension methods populate and clear both slots", func(t *testing.T) {
		t.Parallel()
		p := util.NewPeriodicPropertyValuesWithDimension()
		p.SetValueAtWithDimension(1.0, "a", "kg")

		assert.Equal(t, "a", p.GetValueAt(1.0))
		assert.Equal(t, "kg", p.GetDimensionValueAt(1.0))

		p.RemoveValueAt(1.0)
		assert.Nil(t, p.GetValueAt(1.0))
		assert.Nil(t, p.GetDimensionValueAt(1.0))
	})
}

func TestJSONRoundTrip(t *testing.T) {
	t.Parallel()

	t.Run("no dimensions, offsets sorted, d omitted", func(t *testing.T) {
		t.Parallel()
		original := util.NewPeriodicPropertyValues()
		original.SetValueAt(2.0, "two")
		original.SetValueAt(0.0, "zero")
		original.SetValueAt(1.0, "one")

		out, err := json.Marshal(original)
		require.NoError(t, err)

		var wire struct {
			Offsets []float64     `json:"t"`
			Values  []interface{} `json:"v"`
			Dims    []interface{} `json:"d,omitempty"`
		}
		require.NoError(t, json.Unmarshal(out, &wire))
		assert.Equal(t, []float64{0.0, 1.0, 2.0}, wire.Offsets)
		assert.Equal(t, []interface{}{"zero", "one", "two"}, wire.Values)
		assert.Nil(t, wire.Dims, "dimension array must be omitted when not in use")

		var decoded util.PeriodicPropertyValues
		require.NoError(t, json.Unmarshal(out, &decoded))
		assert.False(t, decoded.HasDimensionValues())
		assert.Equal(t, "zero", decoded.GetValueAt(0.0))
		assert.Equal(t, "one", decoded.GetValueAt(1.0))
		assert.Equal(t, "two", decoded.GetValueAt(2.0))
	})

	t.Run("with dimensions", func(t *testing.T) {
		t.Parallel()
		original := util.NewPeriodicPropertyValuesWithDimension()
		original.SetValueAtWithDimension(0.0, "a", "kg")
		original.SetValueAtWithDimension(1.0, "b", "lbs")

		out, err := json.Marshal(original)
		require.NoError(t, err)

		var decoded util.PeriodicPropertyValues
		require.NoError(t, json.Unmarshal(out, &decoded))
		assert.True(t, decoded.HasDimensionValues())
		assert.Equal(t, "a", decoded.GetValueAt(0.0))
		assert.Equal(t, "kg", decoded.GetDimensionValueAt(0.0))
		assert.Equal(t, "b", decoded.GetValueAt(1.0))
		assert.Equal(t, "lbs", decoded.GetDimensionValueAt(1.0))
	})

	t.Run("malformed JSON returns an error", func(t *testing.T) {
		t.Parallel()
		var p util.PeriodicPropertyValues
		assert.Error(t, json.Unmarshal([]byte(`{not json`), &p))
	})
}

func TestParseValues(t *testing.T) {
	t.Parallel()

	t.Run("transforms each value via the parser", func(t *testing.T) {
		t.Parallel()
		p := util.NewPeriodicPropertyValues()
		p.SetValueAt(0.0, "1")
		p.SetValueAt(1.0, "2")

		require.NoError(t, p.ParseValues(func(v interface{}) (interface{}, error) {
			return v.(string) + "!", nil
		}))

		assert.Equal(t, "1!", p.GetValueAt(0.0))
		assert.Equal(t, "2!", p.GetValueAt(1.0))
	})

	t.Run("returns the parser error and leaves prior state in place", func(t *testing.T) {
		t.Parallel()
		p := util.NewPeriodicPropertyValues()
		p.SetValueAt(0.0, "ok")
		p.SetValueAt(1.0, "boom")

		boom := errors.New("boom")
		err := p.ParseValues(func(v interface{}) (interface{}, error) {
			if v == "boom" {
				return nil, boom
			}
			return v, nil
		})

		require.ErrorIs(t, err, boom)
		// Failure must not partially overwrite ValuesByOffset with parsed entries.
		assert.Equal(t, "ok", p.GetValueAt(0.0))
		assert.Equal(t, "boom", p.GetValueAt(1.0))
	})
}
