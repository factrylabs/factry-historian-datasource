package util_test

import (
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/stretchr/testify/assert"
)

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
