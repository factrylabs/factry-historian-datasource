package schemas

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// An alert rule sends the saved query without resolving its variables, so a "$page" must
// decode rather than fail the whole query.
func TestLookupTableQueryDecodesLimitAndPageLeniently(t *testing.T) {
	t.Parallel()

	for name, test := range map[string]struct {
		json        string
		limit, page QueryNumber
	}{
		"numbers":              {json: `{"Limit":100,"Page":2}`, limit: 100, page: 2},
		"fractions":            {json: `{"Limit":100.5,"Page":2.9}`, limit: 100, page: 2},
		"numbers as strings":   {json: `{"Limit":"250","Page":"3"}`, limit: 250, page: 3},
		"unresolved variables": {json: `{"Limit":"$limit","Page":"$page"}`, limit: 0, page: 0},
		"null":                 {json: `{"Limit":null,"Page":null}`, limit: 0, page: 0},
		"absent":               {json: `{}`, limit: 0, page: 0},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			query := LookupTableQuery{}
			require.NoError(t, json.Unmarshal([]byte(test.json), &query))
			assert.Equal(t, test.limit, query.Limit)
			assert.Equal(t, test.page, query.Page)
		})
	}
}
