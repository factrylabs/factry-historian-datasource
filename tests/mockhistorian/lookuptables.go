package main

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
)

func handleLookupTables(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, []schemas.LookupTable{lookupTable})
}

// handleLookupTableRows filters the rows, pages them like the historian does, and sends the
// number of matching rows before paging in X-Total-Count.
func handleLookupTableRows(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("uuid") != lookupTableUUID.String() {
		http.NotFound(w, r)
		return
	}

	var query schemas.LookupTableRowQuery
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	rows := []schemas.LookupTableRow{}
	for _, row := range lookupTableRows {
		if matchesLookupTableFilter(row, query.Filter) {
			rows = append(rows, row)
		}
	}

	total := len(rows)
	if query.Limit > 0 {
		start := min((max(query.Page, 1)-1)*query.Limit, total)
		rows = rows[start:min(start+query.Limit, total)]
	}

	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	writeJSON(w, rows)
}

// matchesLookupTableFilter walks the AND/OR tree. A filter without condition groups matches
// every row.
func matchesLookupTableFilter(row schemas.LookupTableRow, filter *schemas.LookupTableRowFilter) bool {
	if filter == nil || len(filter.ConditionGroups) == 0 {
		return true
	}

	or := filter.Condition == schemas.LookupTableRowConditionOr
	for _, group := range filter.ConditionGroups {
		var matched bool
		if group.Filter != nil {
			matched = matchesLookupTableFilter(row, group.Filter)
		} else {
			matched = matchesLookupTableCondition(row, group)
		}
		if matched == or {
			return or
		}
	}

	return !or
}

func matchesLookupTableCondition(row schemas.LookupTableRow, group schemas.LookupTableRowConditionGroup) bool {
	index := slices.IndexFunc(lookupTable.Attributes.Columns, func(column schemas.LookupTableColumn) bool {
		return column.Name == group.Column
	})
	var cell interface{}
	if index >= 0 && index < len(row.Cells) {
		cell = row.Cells[index]
	}

	switch group.Operator {
	case schemas.LookupTableRowOperatorIsNull:
		return cell == nil
	case schemas.LookupTableRowOperatorIsNotNull:
		return cell != nil
	case schemas.LookupTableRowOperatorIn:
		return slices.Contains(group.Values, cell)
	case schemas.LookupTableRowOperatorNotIn:
		return !slices.Contains(group.Values, cell)
	}

	number, ok := cell.(float64)
	if !ok || len(group.Values) == 0 {
		return false
	}
	bound, ok := group.Values[0].(float64)
	if !ok {
		return false
	}

	switch group.Operator {
	case schemas.LookupTableRowOperatorGreater:
		return number > bound
	case schemas.LookupTableRowOperatorGreaterOrEqual:
		return number >= bound
	case schemas.LookupTableRowOperatorLess:
		return number < bound
	case schemas.LookupTableRowOperatorLessOrEqual:
		return number <= bound
	}

	return false
}
