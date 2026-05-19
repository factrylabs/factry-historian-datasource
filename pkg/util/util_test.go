package util_test

import (
	"encoding/json"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeModel struct {
	UUID uuid.UUID
	Name string
}

func (f fakeModel) GetUUID() uuid.UUID { return f.UUID }

func TestDropEmpty(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		arr  []string
		want []string
	}{
		{name: "nil stays nil", arr: nil, want: nil},
		{name: "only empty strings", arr: []string{"", ""}, want: nil},
		{name: "keeps the non-empty entries in order", arr: []string{"open", "", "processed"}, want: []string{"open", "processed"}},
		{name: "leaves a filled slice untouched", arr: []string{"open", "processed"}, want: []string{"open", "processed"}},
	}

	for i := range tests {
		tt := tests[i]
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, util.DropEmpty(tt.arr))
		})
	}
}

func TestUnique(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		arr  []string
		want bool
	}{
		{"empty slice is unique", []string{}, true},
		{"single element is unique", []string{"a"}, true},
		{"distinct elements are unique", []string{"a", "b", "c"}, true},
		{"duplicate elements are not unique", []string{"a", "b", "a"}, false},
		{"adjacent duplicates are not unique", []string{"a", "a"}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, util.Unique(tt.arr))
		})
	}

	t.Run("works with ints", func(t *testing.T) {
		t.Parallel()
		assert.True(t, util.Unique([]int{1, 2, 3}))
		assert.False(t, util.Unique([]int{1, 2, 1}))
	})
}

func TestDedupe(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   []string
		want []string
	}{
		{"empty stays empty", []string{}, []string{}},
		{"distinct stays the same", []string{"a", "b", "c"}, []string{"a", "b", "c"}},
		{"adjacent duplicates collapse", []string{"a", "a", "b"}, []string{"a", "b"}},
		{"non-adjacent duplicates collapse and preserve first-seen order", []string{"a", "b", "a", "c", "b"}, []string{"a", "b", "c"}},
		{"all duplicates collapse to single element", []string{"x", "x", "x"}, []string{"x"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, util.Dedupe(tt.in))
		})
	}

	t.Run("does not mutate the input slice", func(t *testing.T) {
		t.Parallel()
		in := []string{"a", "a", "b"}
		_ = util.Dedupe(in)
		assert.Equal(t, []string{"a", "a", "b"}, in)
	})
}

func TestByUUID(t *testing.T) {
	t.Parallel()

	u1 := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	u2 := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	m1 := fakeModel{UUID: u1, Name: "first"}
	m2 := fakeModel{UUID: u2, Name: "second"}

	got := util.ByUUID([]fakeModel{m1, m2})

	require.Len(t, got, 2)
	assert.Equal(t, m1, got[u1])
	assert.Equal(t, m2, got[u2])
}

func TestByUUIDEmpty(t *testing.T) {
	t.Parallel()

	got := util.ByUUID([]fakeModel{})
	assert.Empty(t, got)
	assert.NotNil(t, got, "ByUUID should return a non-nil map even when empty")
}

func TestByFunc(t *testing.T) {
	t.Parallel()

	t.Run("indexes by selector key", func(t *testing.T) {
		t.Parallel()
		in := []fakeModel{
			{Name: "alpha"},
			{Name: "beta"},
		}

		got := util.ByFunc(in, func(m fakeModel) (string, bool) { return m.Name, true })

		require.Len(t, got, 2)
		assert.Equal(t, "alpha", got["alpha"].Name)
		assert.Equal(t, "beta", got["beta"].Name)
	})

	t.Run("skips entries where the selector returns ok=false", func(t *testing.T) {
		t.Parallel()
		in := []fakeModel{
			{Name: "keep"},
			{Name: "drop"},
		}

		got := util.ByFunc(in, func(m fakeModel) (string, bool) { return m.Name, m.Name != "drop" })

		require.Len(t, got, 1)
		_, present := got["drop"]
		assert.False(t, present)
	})

	t.Run("later duplicates overwrite earlier entries", func(t *testing.T) {
		t.Parallel()
		in := []fakeModel{
			{Name: "key", UUID: uuid.MustParse("00000000-0000-0000-0000-000000000001")},
			{Name: "key", UUID: uuid.MustParse("00000000-0000-0000-0000-000000000002")},
		}

		got := util.ByFunc(in, func(m fakeModel) (string, bool) { return m.Name, true })

		require.Len(t, got, 1)
		assert.Equal(t, "00000000-0000-0000-0000-000000000002", got["key"].UUID.String())
	})
}

func TestGetUUIDs(t *testing.T) {
	t.Parallel()

	u1 := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	u2 := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	in := []fakeModel{{UUID: u1}, {UUID: u2}}

	got := util.GetUUIDs(in)

	assert.Equal(t, []uuid.UUID{u1, u2}, got)
}

func TestGetUUIDsEmpty(t *testing.T) {
	t.Parallel()

	got := util.GetUUIDs([]fakeModel{})
	assert.Empty(t, got)
}

func TestDeepCopy(t *testing.T) {
	t.Parallel()

	t.Run("produces an independent copy of a struct", func(t *testing.T) {
		t.Parallel()
		type box struct {
			Name string
			Tags []string
		}

		src := box{Name: "src", Tags: []string{"a", "b"}}
		var dst box
		require.NoError(t, util.DeepCopy(&dst, src))

		assert.Equal(t, src, dst)

		// Mutate the source: dst should be unaffected.
		src.Tags[0] = "mutated"
		assert.Equal(t, []string{"a", "b"}, dst.Tags)
	})

	t.Run("returns an error when src is not JSON-marshalable", func(t *testing.T) {
		t.Parallel()
		var dst map[string]any
		err := util.DeepCopy(&dst, map[string]any{"bad": make(chan int)})
		assert.Error(t, err)
	})
}

func TestMarshalStructToMap(t *testing.T) {
	t.Parallel()

	t.Run("maps every exported field to its value", func(t *testing.T) {
		t.Parallel()
		type s struct {
			A int
			B string
		}

		got := util.MarshalStructToMap(s{A: 1, B: "two"})

		assert.Equal(t, map[string]interface{}{"A": 1, "B": "two"}, got)
	})

	t.Run("skips unexported fields", func(t *testing.T) {
		t.Parallel()
		type s struct {
			A      int
			hidden string
		}

		got := util.MarshalStructToMap(s{A: 1, hidden: "secret"})

		_, hasHidden := got["hidden"]
		assert.False(t, hasHidden, "unexported fields must not appear in the result")
		assert.Equal(t, 1, got["A"])
	})

	t.Run("returns an empty map for non-struct inputs", func(t *testing.T) {
		t.Parallel()
		assert.Empty(t, util.MarshalStructToMap(42))
		assert.Empty(t, util.MarshalStructToMap("string"))
		assert.Empty(t, util.MarshalStructToMap([]int{1, 2, 3}))
	})
}

// DeepCopy is implemented via JSON round-tripping, so verify it produces a
// struct that re-marshals to the same JSON as the source.
func TestDeepCopyRoundTripsThroughJSON(t *testing.T) {
	t.Parallel()

	type payload struct {
		Name string         `json:"name"`
		Meta map[string]int `json:"meta"`
	}

	src := payload{Name: "p", Meta: map[string]int{"a": 1, "b": 2}}
	var dst payload
	require.NoError(t, util.DeepCopy(&dst, src))

	// And the resulting struct still serializes to the same JSON.
	srcJSON, err := json.Marshal(src)
	require.NoError(t, err)
	dstJSON, err := json.Marshal(dst)
	require.NoError(t, err)
	assert.JSONEq(t, string(srcJSON), string(dstJSON))
}
