package schemas

import (
	"encoding/json"
	"strconv"
)

// LookupTableColumnType is the type a lookup table column's cell values are validated
// against by the historian.
type LookupTableColumnType string

// Lookup table column types
const (
	LookupTableColumnTypeString  LookupTableColumnType = "string"
	LookupTableColumnTypeNumber  LookupTableColumnType = "number"
	LookupTableColumnTypeBoolean LookupTableColumnType = "boolean"
)

// LookupTableColumn is one column definition of a lookup table. The order of the column
// list is what every row's cells are positioned against.
type LookupTableColumn struct {
	Name string
	Type LookupTableColumnType
}

// LookupTableAttributes holds a lookup table's own definition.
type LookupTableAttributes struct {
	Columns     []LookupTableColumn
	Description string
}

// LookupTable has the fields of a lookup table that are used by the data source
type LookupTable struct {
	BaseModel
	Attributes LookupTableAttributes
}

// LookupTableRow is a single row of a lookup table. Cells holds one value per column of
// the table, in the column order of its attributes; a nil is a cell that is not filled in.
// A row written before a column was added stops short of it, so Cells can be shorter than
// the column list.
type LookupTableRow struct {
	UUID  string
	Index int
	Cells []interface{}
}

// Lookup table filter conditions, the logical operators combining the condition groups of a
// filter.
const (
	LookupTableRowConditionAnd = "and"
	LookupTableRowConditionOr  = "or"
)

// Lookup table filter operators, how a leaf condition compares the column it names. They are
// the operators the historian filters with elsewhere, on the values a lookup table can hold.
//
// "=" and "!=" are shorthands the query editor writes, for a condition holding a single value.
// The historian takes the set operators, so a filter carrying one is sent as "IN" or "NOT IN",
// which match a set of one value the same way.
const (
	LookupTableRowOperatorEqual          = "="
	LookupTableRowOperatorNotEqual       = "!="
	LookupTableRowOperatorIn             = "IN"
	LookupTableRowOperatorNotIn          = "NOT IN"
	LookupTableRowOperatorGreater        = ">"
	LookupTableRowOperatorGreaterOrEqual = ">="
	LookupTableRowOperatorLess           = "<"
	LookupTableRowOperatorLessOrEqual    = "<="
	LookupTableRowOperatorIsNull         = "IS NULL"
	LookupTableRowOperatorIsNotNull      = "IS NOT NULL"
)

// LookupTableRowFilter is a logical group of conditions on a lookup table's rows, combined by
// Condition. It nests recursively through LookupTableRowConditionGroup to form arbitrary
// AND/OR trees, and a group holding no condition groups narrows nothing.
type LookupTableRowFilter struct {
	Condition       string
	ConditionGroups []LookupTableRowConditionGroup
}

// LookupTableRowConditionGroup is either a leaf condition on one column of the table or
// another filter, nested. A group carrying a Filter is that nested filter and its own fields
// are not read.
//
// A leaf compares its column against any one of Values: "IN" keeps the rows holding one of
// them, where a nil among them matches a cell that is not filled in, and "NOT IN" the rows
// holding none; ">", ">=", "<" and "<=" compare numerically, so a cell that does not hold a
// number never matches one; "IS NULL" and "IS NOT NULL" read whether the cell is filled in at
// all and take no values.
//
// The fields a group does not use are left off the wire entirely, which keeps a filter
// readable in Grafana's query inspector. An empty Values is left off with them: the historian
// reads an absent one the same way, as a condition matching no rows.
type LookupTableRowConditionGroup struct {
	Column   string                `json:"Column,omitempty"`
	Operator string                `json:"Operator,omitempty"`
	Values   []interface{}         `json:"Values,omitempty"`
	Filter   *LookupTableRowFilter `json:"Filter,omitempty"`
}

// LookupTableRowQuery is the body of a lookup table rows query: the filter narrowing the
// rows, and the pagination bounding how many of them come back. The whole query goes in a
// body because the filter is a tree, which cannot be expressed as query parameters.
//
// Limit is always written, and a zero one reads as no pagination at all. An absent one
// would read as the first hundred rows instead. Page counts from 1 and is only read under
// a limit.
type LookupTableRowQuery struct {
	Filter *LookupTableRowFilter `json:"Filter,omitempty"`
	Limit  int                   `json:"Limit"`
	Page   int                   `json:"Page,omitempty"`
}

// LookupTableQuery is used to query the rows of a lookup table. A Limit of zero returns
// every row, and Page counts from 1, with zero reading as the first page.
type LookupTableQuery struct {
	LookupTable string
	Filter      *LookupTableRowFilter
	Columns     []string
	Limit       QueryNumber
	Page        QueryNumber
}

// QueryNumber is a whole number the query editor saves as a number or as a variable. A
// query that skips the frontend, such as an alert rule, arrives with the variable unresolved,
// and it reads as zero the way the frontend reads one that resolves to nothing. A fraction is
// truncated, as the frontend does.
type QueryNumber int

// UnmarshalJSON reads a number, a string holding one, or anything else as zero.
func (n *QueryNumber) UnmarshalJSON(b []byte) error {
	var value interface{}
	if err := json.Unmarshal(b, &value); err != nil {
		return err
	}

	*n = 0
	switch v := value.(type) {
	case float64:
		*n = QueryNumber(v)
	case string:
		if number, err := strconv.ParseFloat(v, 64); err == nil {
			*n = QueryNumber(number)
		}
	}

	return nil
}
