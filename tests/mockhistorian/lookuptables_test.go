package main

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func queryLookupTableRows(t *testing.T, body string) (rows []schemas.LookupTableRow, total string) {
	t.Helper()

	rec := doRequest(t, http.MethodPost, "/api/lookup-tables/"+lookupTableUUID.String()+"/rows/query", body)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &rows))
	return rows, rec.Header().Get("X-Total-Count")
}

func TestLookupTables(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodGet, "/api/lookup-tables", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var got []schemas.LookupTable
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, lookupTableUUID, got[0].UUID)
	assert.Len(t, got[0].Attributes.Columns, 3)
}

func TestLookupTableRowsPages(t *testing.T) {
	t.Parallel()

	rows, total := queryLookupTableRows(t, `{"Limit":100,"Page":3}`)
	assert.Equal(t, "250", total)
	require.Len(t, rows, 50)
	assert.Equal(t, 200, rows[0].Index)

	rows, total = queryLookupTableRows(t, `{"Limit":100,"Page":9}`)
	assert.Equal(t, "250", total)
	assert.Empty(t, rows)

	rows, _ = queryLookupTableRows(t, `{"Limit":0,"Page":3}`)
	assert.Len(t, rows, 250)
}

// (line IN L1 AND setpoint >= 100) OR setpoint IS NULL: L1 is every fifth row from 0, which
// never lands on the empty setpoint of every tenth row from 9.
func TestLookupTableRowsFilter(t *testing.T) {
	t.Parallel()

	rows, total := queryLookupTableRows(t, `{"Limit":0,"Filter":{"Condition":"or","ConditionGroups":[
		{"Filter":{"Condition":"and","ConditionGroups":[
			{"Column":"line","Operator":"IN","Values":["L1"]},
			{"Column":"setpoint","Operator":">=","Values":[100]}
		]}},
		{"Column":"setpoint","Operator":"IS NULL"}
	]}}`)
	assert.Equal(t, "55", total)
	assert.Len(t, rows, 55)
	for _, row := range rows {
		if row.Cells[1] != nil {
			assert.Equal(t, "L1", row.Cells[0])
			assert.GreaterOrEqual(t, row.Cells[1], 100.0)
		}
	}
}

func TestLookupTableRowsUnknownTable(t *testing.T) {
	t.Parallel()

	rec := doRequest(t, http.MethodPost, "/api/lookup-tables/"+databaseUUID.String()+"/rows/query", `{"Limit":0}`)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}
