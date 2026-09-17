package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"slices"
	"strconv"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// handleLookupTableQuery reads the rows of a lookup table into a single table frame.
//
// It takes two calls: the table list carries the column definitions the cells are
// positioned against, and the rows carry the cells. Only the first is cached here, and the
// historian answers the second from its own snapshot of the table.
func (ds *HistorianDataSource) handleLookupTableQuery(ctx context.Context, query schemas.LookupTableQuery) (data.Frames, error) {
	// A query naming no table is one that is not configured yet: the tab opens on an empty
	// query, and a template variable can resolve to nothing. That reads as no data rather
	// than as an error, the way an unconfigured raw query does.
	if query.LookupTable == "" {
		return nil, nil
	}

	lookupTables, err := ds.API.GetLookupTablesCached(ctx, "")
	if err != nil {
		return nil, err
	}

	index := slices.IndexFunc(lookupTables, func(lookupTable schemas.LookupTable) bool {
		return lookupTable.UUID.String() == query.LookupTable
	})
	if index < 0 {
		return nil, fmt.Errorf("lookup table %q not found", query.LookupTable)
	}
	lookupTable := lookupTables[index]

	filter := coerceLookupTableFilter(lookupTable.Attributes.Columns, query.Filter)

	rows, err := ds.API.GetLookupTableRows(ctx, query.LookupTable, filter)
	if err != nil {
		return nil, err
	}

	return data.Frames{lookupTableFrame(lookupTable, rows, query.Columns)}, nil
}

// coerceLookupTableFilter types every filter value by the column it is compared against.
//
// A filter value reaches here as a string whichever way it was entered: the query editor's
// value box hands back strings, and a template variable resolves to one. The historian
// compares a filter to the stored cell as JSON, where "2" and 2 are different values, so a
// string filter on a number column matches nothing at all and reads as an empty result
// rather than as an error. A value that does not parse is left alone: it cannot match, and
// no match is the right answer for it.
//
// The filter is a tree, so this walks it, leaving the shape it walks alone: the query is
// interpolated per frame and the coerced copy is what goes on the wire.
func coerceLookupTableFilter(columns []schemas.LookupTableColumn, filter *schemas.LookupTableRowFilter) *schemas.LookupTableRowFilter {
	if filter == nil {
		return nil
	}

	types := make(map[string]schemas.LookupTableColumnType, len(columns))
	for _, column := range columns {
		types[column.Name] = column.Type
	}

	return coerceLookupTableFilterTypes(types, filter)
}

func coerceLookupTableFilterTypes(types map[string]schemas.LookupTableColumnType, filter *schemas.LookupTableRowFilter) *schemas.LookupTableRowFilter {
	if filter == nil {
		return nil
	}

	// The historian validates the condition against its own list before reading the filter, so
	// an absent one is sent as the AND it means rather than as an empty string it rejects. A
	// dashboard written by hand is the only way to get one.
	condition := filter.Condition
	if condition == "" {
		condition = schemas.LookupTableRowConditionAnd
	}

	coerced := &schemas.LookupTableRowFilter{
		Condition:       condition,
		ConditionGroups: make([]schemas.LookupTableRowConditionGroup, 0, len(filter.ConditionGroups)),
	}

	for _, group := range filter.ConditionGroups {
		if group.Filter != nil {
			// A group left with nothing to narrow, because it is empty or because everything
			// in it is unfinished, drops out with its conditions.
			nested := coerceLookupTableFilterTypes(types, group.Filter)
			if len(nested.ConditionGroups) > 0 {
				coerced.ConditionGroups = append(coerced.ConditionGroups, schemas.LookupTableRowConditionGroup{Filter: nested})
			}

			continue
		}

		if unfinishedLookupTableCondition(group) {
			continue
		}

		condition := schemas.LookupTableRowConditionGroup{Column: group.Column, Operator: group.Operator}

		// The operators reading whether the cell is filled in read no values at all, and their
		// value list stays nil rather than becoming an empty one. The historian ignores a list
		// they carry anyway, and a dashboard written by hand or by an older plugin version is
		// the only way to get one. The pruning above means every operator that does read values
		// arrives here holding some.
		if lookupTableOperatorReadsValues(group.Operator) && group.Values != nil {
			values := make([]interface{}, len(group.Values))
			for j, value := range group.Values {
				values[j] = coerceLookupTableValue(types[group.Column], value)
			}

			condition.Values = values
		}

		coerced.ConditionGroups = append(coerced.ConditionGroups, condition)
	}

	return coerced
}

// unfinishedLookupTableCondition reports whether a condition is one the editor is still being
// filled in: it names no column yet, or its operator reads values and it has none. Neither is
// worth sending. A condition without a column is rejected outright by the historian, which
// knows no column by that name, so the panel would show the error of a row the user has not
// finished rather than the rows it has narrowed so far.
func unfinishedLookupTableCondition(group schemas.LookupTableRowConditionGroup) bool {
	if group.Column == "" {
		return true
	}

	if !lookupTableOperatorReadsValues(group.Operator) {
		return false
	}

	return len(group.Values) == 0
}

// lookupTableOperatorReadsValues reports whether an operator compares the cell against values
// at all. The two reading whether the cell is filled in do not, which mirrors the historian's
// own reading of them.
func lookupTableOperatorReadsValues(operator string) bool {
	return operator != schemas.LookupTableRowOperatorIsNull &&
		operator != schemas.LookupTableRowOperatorIsNotNull
}

// coerceLookupTableValue types one filter value. Anything that is not a string already
// carries its type, from a dashboard JSON written by hand or by an older plugin version,
// and is passed through untouched.
func coerceLookupTableValue(columnType schemas.LookupTableColumnType, value interface{}) interface{} {
	text, ok := value.(string)
	if !ok {
		return value
	}

	switch columnType {
	case schemas.LookupTableColumnTypeNumber:
		// NaN and the infinities parse but have no JSON to be written as, so sending one
		// fails to marshal and errors the whole query. They stay the strings they came in
		// as, which no cell of a number column matches, the way any other value that does
		// not parse is left alone.
		if number, err := strconv.ParseFloat(text, 64); err == nil && !math.IsNaN(number) && !math.IsInf(number, 0) {
			return number
		}
	case schemas.LookupTableColumnTypeBoolean:
		if boolean, err := strconv.ParseBool(text); err == nil {
			return boolean
		}
	case schemas.LookupTableColumnTypeString:
	}

	return value
}

// lookupTableFrame builds the frame for a lookup table's rows: one field per column of the
// table, in the table's own column order, holding that column's cell of every row. An empty
// columns list takes every column; otherwise only the ones named, still in table order, so
// reordering the selection in the editor does not reorder the frame.
func lookupTableFrame(lookupTable schemas.LookupTable, rows []schemas.LookupTableRow, columns []string) *data.Frame {
	frame := data.NewFrame(lookupTable.Name)
	frame.Meta = &data.FrameMeta{PreferredVisualization: data.VisTypeTable}

	for position, column := range lookupTable.Attributes.Columns {
		if len(columns) > 0 && !slices.Contains(columns, column.Name) {
			continue
		}

		// A row written before this column was added stops short of it, which reads the
		// same as a cell that is not filled in.
		values := make([]interface{}, len(rows))
		for i := range rows {
			if position < len(rows[i].Cells) {
				values[i] = rows[i].Cells[position]
			}
		}

		frame.Fields = append(frame.Fields, lookupTableField(column, values))
	}

	return frame
}

// lookupTableField types a column's values by the type the historian validates its cells
// against. A value that does not hold to that type falls back to the string form of the
// whole column rather than being dropped: the historian only validates what it is written
// through, and a frame that silently loses cells is worse than one that shows them as text.
func lookupTableField(column schemas.LookupTableColumn, values []interface{}) *data.Field {
	switch column.Type {
	case schemas.LookupTableColumnTypeNumber:
		if numbers, ok := lookupTableNumbers(values); ok {
			return data.NewField(column.Name, nil, numbers)
		}
	case schemas.LookupTableColumnTypeBoolean:
		if booleans, ok := lookupTableBooleans(values); ok {
			return data.NewField(column.Name, nil, booleans)
		}
	case schemas.LookupTableColumnTypeString:
	}

	return data.NewField(column.Name, nil, lookupTableStrings(values))
}

func lookupTableNumbers(values []interface{}) ([]*float64, bool) {
	numbers := make([]*float64, len(values))
	for i, value := range values {
		if value == nil {
			continue
		}

		// Cells arrive as JSON, so every number decodes to a float64.
		number, ok := value.(float64)
		if !ok {
			return nil, false
		}

		numbers[i] = &number
	}

	return numbers, true
}

func lookupTableBooleans(values []interface{}) ([]*bool, bool) {
	booleans := make([]*bool, len(values))
	for i, value := range values {
		if value == nil {
			continue
		}

		boolean, ok := value.(bool)
		if !ok {
			return nil, false
		}

		booleans[i] = &boolean
	}

	return booleans, true
}

// lookupTableStrings renders anything: a string as itself, and everything else as the JSON
// it arrived as, so an object or an array in a cell still reaches the panel readably.
func lookupTableStrings(values []interface{}) []*string {
	strings := make([]*string, len(values))
	for i, value := range values {
		if value == nil {
			continue
		}

		if text, ok := value.(string); ok {
			strings[i] = &text
			continue
		}

		encoded, err := json.Marshal(value)
		if err != nil {
			continue
		}

		text := string(encoded)
		strings[i] = &text
	}

	return strings
}
