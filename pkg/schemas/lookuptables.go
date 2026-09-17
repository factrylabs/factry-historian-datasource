package schemas

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
const (
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

// LookupTableQuery is used to query the rows of a lookup table
type LookupTableQuery struct {
	LookupTable string
	Filter      *LookupTableRowFilter
	Columns     []string
}
