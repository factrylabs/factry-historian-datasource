package api

import (
	"fmt"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBatchPaths(t *testing.T) {
	t.Parallel()

	t.Run("short paths stay in one batch", func(t *testing.T) {
		t.Parallel()

		paths := []string{`plant\line 1`, `plant\line 2`, `plant\line 3`}
		batches := batchPaths(paths)

		require.Len(t, batches, 1)
		assert.Equal(t, paths, batches[0])
	})

	t.Run("batches stay within the budget once encoded", func(t *testing.T) {
		t.Parallel()

		paths := make([]string, 200)
		for i := range paths {
			paths[i] = fmt.Sprintf(`plant\area %03d\line %03d\unit %03d`, i, i, i)
		}
		batches := batchPaths(paths)
		require.Greater(t, len(batches), 1, "this many paths must not fit in one batch")

		// The anchors around the alternation are the only cost the batch
		// budget does not account for.
		anchors := len(url.QueryEscape("/^()$/"))
		total := 0
		for _, batch := range batches {
			encoded := len(url.QueryEscape(pathAlternation(batch)))
			assert.LessOrEqual(t, encoded, pathBatchBudget+anchors, "an encoded filter must stay within the budget")
			total += len(batch)
		}
		assert.Equal(t, len(paths), total, "no path may be dropped")
	})

	t.Run("a path over the budget forms a batch of one", func(t *testing.T) {
		t.Parallel()

		long := strings.Repeat(`segment\`, 1000) + "leaf"
		batches := batchPaths([]string{`plant\line 1`, long, `plant\line 2`})

		assert.Equal(t, [][]string{{`plant\line 1`}, {long}, {`plant\line 2`}}, batches)
	})
}
