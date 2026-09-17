package datasource

import (
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var lookupTableUUID = uuid.MustParse("6f5a3f3e-0c2e-4f0a-9b5a-1a6c9f0f9a11")

// lookupTableFixture is a table of one column per type. The rows cover what the frame has
// to carry across: a filled cell of every type, a stored null, and a row that stops short
// of the last columns because it predates them.
func lookupTableFixture() schemas.LookupTable {
	return schemas.LookupTable{
		BaseModel: schemas.BaseModel{UUID: lookupTableUUID, Name: "Line settings"},
		Attributes: schemas.LookupTableAttributes{
			Columns: []schemas.LookupTableColumn{
				{Name: "line", Type: schemas.LookupTableColumnTypeString},
				{Name: "setpoint", Type: schemas.LookupTableColumnTypeNumber},
				{Name: "active", Type: schemas.LookupTableColumnTypeBoolean},
			},
		},
	}
}

func lookupTableRows() []schemas.LookupTableRow {
	return []schemas.LookupTableRow{
		{UUID: uuid.NewString(), Index: 0, Cells: []interface{}{"L1", 42.0, true}},
		{UUID: uuid.NewString(), Index: 1, Cells: []interface{}{"L2", nil, false}},
		{UUID: uuid.NewString(), Index: 2, Cells: []interface{}{"L3"}},
	}
}

// fakeLookupTableHistorian serves the two calls a lookup table query makes and records the
// body the rows call arrived with, which is where the filter rides. The rows route is only
// registered for the POST the plugin makes, so a request going anywhere else fails the test
// with a 404 rather than quietly answering with unfiltered rows.
func fakeLookupTableHistorian(t *testing.T, table schemas.LookupTable, rows []schemas.LookupTableRow, body *string) *HistorianDataSource {
	t.Helper()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/lookup-tables", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, []schemas.LookupTable{table})
	})
	mux.HandleFunc("POST /api/lookup-tables/{uuid}/rows/query", func(w http.ResponseWriter, req *http.Request) {
		if body != nil {
			sent, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			*body = string(sent)
		}
		writeJSON(w, rows)
	})

	return newFakeHistorianDataSource(t, mux)
}

// fieldValues reads a nullable field back as plain values, with a nil for an empty cell.
func fieldValues(field *data.Field) []interface{} {
	values := make([]interface{}, field.Len())
	for i := range values {
		if value, ok := field.ConcreteAt(i); ok {
			values[i] = value
		}
	}

	return values
}

// sentFilter pulls the filter out of a recorded rows query body, as the JSON it was sent as.
// An empty string is a body carrying no filter at all.
func sentFilter(t *testing.T, body string) string {
	t.Helper()
	query := map[string]json.RawMessage{}
	require.NoError(t, json.Unmarshal([]byte(body), &query))

	return string(query["Filter"])
}

func TestLookupTableQueryTypesEveryColumnByItsDefinition(t *testing.T) {
	t.Parallel()

	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), nil)

	frames, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
	})
	require.NoError(t, err)
	require.Len(t, frames, 1)

	frame := frames[0]
	assert.Equal(t, "Line settings", frame.Name)
	require.NotNil(t, frame.Meta)
	assert.Equal(t, data.VisType(data.VisTypeTable), frame.Meta.PreferredVisualization)

	require.Len(t, frame.Fields, 3)
	assert.Equal(t, []string{"line", "setpoint", "active"}, fieldNames(frame))
	assert.Equal(t, data.FieldTypeNullableString, frame.Fields[0].Type())
	assert.Equal(t, data.FieldTypeNullableFloat64, frame.Fields[1].Type())
	assert.Equal(t, data.FieldTypeNullableBool, frame.Fields[2].Type())

	// A stored null and a row that stops short of the column both read as empty.
	assert.Equal(t, []interface{}{"L1", "L2", "L3"}, fieldValues(frame.Fields[0]))
	assert.Equal(t, []interface{}{42.0, nil, nil}, fieldValues(frame.Fields[1]))
	assert.Equal(t, []interface{}{true, false, nil}, fieldValues(frame.Fields[2]))
}

// A column list is a projection, not a reordering: the frame keeps the table's own column
// order so the panel does not shuffle when the selection is re-picked in another order.
func TestLookupTableQueryProjectsColumnsInTableOrder(t *testing.T) {
	t.Parallel()

	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), nil)

	frames, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
		Columns:     []string{"active", "line"},
	})
	require.NoError(t, err)
	require.Len(t, frames, 1)

	assert.Equal(t, []string{"line", "active"}, fieldNames(frames[0]))
}

func TestLookupTableQuerySendsTheFilterInTheQueryBody(t *testing.T) {
	t.Parallel()

	body := ""
	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

	// A nested group, because that is the shape a flat list could not carry: the tree has to
	// reach the historian as it was built.
	filter := &schemas.LookupTableRowFilter{
		Condition: schemas.LookupTableRowConditionAnd,
		ConditionGroups: []schemas.LookupTableRowConditionGroup{
			{Column: "line", Operator: schemas.LookupTableRowOperatorIn, Values: []interface{}{"L1", "L2"}},
			{Filter: &schemas.LookupTableRowFilter{
				Condition: schemas.LookupTableRowConditionOr,
				ConditionGroups: []schemas.LookupTableRowConditionGroup{
					{Column: "active", Operator: schemas.LookupTableRowOperatorIn, Values: []interface{}{true}},
					{Column: "setpoint", Operator: schemas.LookupTableRowOperatorIsNull},
				},
			}},
		},
	}

	_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
		Filter:      filter,
	})
	require.NoError(t, err)

	decoded := &schemas.LookupTableRowFilter{}
	require.NoError(t, json.Unmarshal([]byte(sentFilter(t, body)), decoded))
	assert.Equal(t, filter, decoded)
}

// No filter means none in the body at all, and a filter that narrows nothing means the same:
// a group holding no conditions is what the editor leaves behind when its last one is removed.
func TestLookupTableQueryWithoutAFilterSendsNoFilter(t *testing.T) {
	t.Parallel()

	for name, filter := range map[string]*schemas.LookupTableRowFilter{
		"no filter":    nil,
		"empty filter": {Condition: schemas.LookupTableRowConditionAnd},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			body := "unset"
			ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

			_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
				LookupTable: lookupTableUUID.String(),
				Filter:      filter,
			})
			require.NoError(t, err)
			assert.JSONEq(t, `{"Limit":0}`, body)
		})
	}
}

// The historian only validates cells it is written through, so a column can hold a value
// its type does not allow. Showing the column as text beats dropping those cells.
func TestLookupTableQueryFallsBackToTextOnAValueThatBreaksItsType(t *testing.T) {
	t.Parallel()

	rows := []schemas.LookupTableRow{
		{UUID: uuid.NewString(), Index: 0, Cells: []interface{}{"L1", 42.0, true}},
		{UUID: uuid.NewString(), Index: 1, Cells: []interface{}{"L2", "n/a", true}},
	}
	ds := fakeLookupTableHistorian(t, lookupTableFixture(), rows, nil)

	frames, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
	})
	require.NoError(t, err)

	setpoint := frames[0].Fields[1]
	assert.Equal(t, data.FieldTypeNullableString, setpoint.Type())
	assert.Equal(t, []interface{}{"42", "n/a"}, fieldValues(setpoint))
}

func TestLookupTableQueryRejectsATableThatIsNotThere(t *testing.T) {
	t.Parallel()

	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), nil)

	_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: uuid.NewString(),
	})
	assert.ErrorContains(t, err, "not found")
}

// A query naming no table is unconfigured, not wrong: opening the tab creates one, and a
// template variable can resolve to nothing. It answers with no frames and no error, so the
// panel stays empty instead of showing an error the user has not caused yet.
func TestLookupTableQueryReturnsNothingForAnEmptySelection(t *testing.T) {
	t.Parallel()

	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), nil)

	frames, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{})
	require.NoError(t, err)
	assert.Empty(t, frames)
}

// Every filter value arrives as a string, from the editor's value box or from a resolved
// template variable. Sent as one, a number column matches nothing and the panel shows an
// empty result rather than an error. The filter nests, so a value sitting in a nested group
// has to be typed just the same.
func TestLookupTableQueryTypesFilterValuesByTheirColumn(t *testing.T) {
	t.Parallel()

	body := ""
	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

	_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
		Filter: &schemas.LookupTableRowFilter{
			Condition: schemas.LookupTableRowConditionAnd,
			ConditionGroups: []schemas.LookupTableRowConditionGroup{
				{Column: "setpoint", Values: []interface{}{"42", "7.5"}},
				{Column: "line", Values: []interface{}{"L1"}},
				{Filter: &schemas.LookupTableRowFilter{
					Condition: schemas.LookupTableRowConditionOr,
					ConditionGroups: []schemas.LookupTableRowConditionGroup{
						{Column: "active", Values: []interface{}{"true", "false"}},
					},
				}},
			},
		},
	})
	require.NoError(t, err)

	decoded := &schemas.LookupTableRowFilter{}
	require.NoError(t, json.Unmarshal([]byte(sentFilter(t, body)), decoded))
	assert.Equal(t, &schemas.LookupTableRowFilter{
		Condition: schemas.LookupTableRowConditionAnd,
		ConditionGroups: []schemas.LookupTableRowConditionGroup{
			{Column: "setpoint", Values: []interface{}{42.0, 7.5}},
			{Column: "line", Values: []interface{}{"L1"}},
			{Filter: &schemas.LookupTableRowFilter{
				Condition: schemas.LookupTableRowConditionOr,
				ConditionGroups: []schemas.LookupTableRowConditionGroup{
					{Column: "active", Values: []interface{}{true, false}},
				},
			}},
		},
	}, decoded)
}

// NaN and the infinities parse as floats but cannot be written as JSON, so coercing one would
// fail to marshal the filter and error a query that should simply have matched nothing. They
// stay strings and go out as strings.
func TestLookupTableQueryLeavesNonFiniteFilterValuesAsStrings(t *testing.T) {
	t.Parallel()

	for _, value := range []string{"NaN", "Inf", "+Inf", "-Inf", "infinity"} {
		t.Run(value, func(t *testing.T) {
			t.Parallel()

			body := ""
			ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

			_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
				LookupTable: lookupTableUUID.String(),
				Filter: &schemas.LookupTableRowFilter{
					Condition: schemas.LookupTableRowConditionAnd,
					ConditionGroups: []schemas.LookupTableRowConditionGroup{
						{Column: "setpoint", Values: []interface{}{value}},
					},
				},
			})
			require.NoError(t, err)

			decoded := &schemas.LookupTableRowFilter{}
			require.NoError(t, json.Unmarshal([]byte(sentFilter(t, body)), decoded))
			require.Len(t, decoded.ConditionGroups, 1)
			assert.Equal(t, []interface{}{value}, decoded.ConditionGroups[0].Values)
		})
	}
}

// A condition that reads whether the cell is filled in carries no values at all, and must not
// grow an empty list on the way out: an empty list is a condition matching no rows.
func TestLookupTableQueryLeavesAnEmptyCellConditionWithoutValues(t *testing.T) {
	t.Parallel()

	body := ""
	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

	_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
		Filter: &schemas.LookupTableRowFilter{
			Condition: schemas.LookupTableRowConditionAnd,
			ConditionGroups: []schemas.LookupTableRowConditionGroup{
				{Column: "setpoint", Operator: schemas.LookupTableRowOperatorIsNull},
				{Column: "line", Operator: schemas.LookupTableRowOperatorIsNotNull},
			},
		},
	})
	require.NoError(t, err)

	assert.NotContains(t, sentFilter(t, body), `"Values"`)
}

// The historian only takes AND or OR, so a filter reaching the plugin without one, which
// only a dashboard written by hand can do, is sent as the AND it reads as.
func TestLookupTableQuerySendsAFilterWithoutAConditionAsAnAnd(t *testing.T) {
	t.Parallel()

	body := ""
	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

	_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
		Filter: &schemas.LookupTableRowFilter{
			ConditionGroups: []schemas.LookupTableRowConditionGroup{{Column: "line", Values: []interface{}{"L1"}}},
		},
	})
	require.NoError(t, err)

	decoded := &schemas.LookupTableRowFilter{}
	require.NoError(t, json.Unmarshal([]byte(sentFilter(t, body)), decoded))
	assert.Equal(t, schemas.LookupTableRowConditionAnd, decoded.Condition)
}

// A filter is built one control at a time, and the query runs on every change, so a condition
// halfway through being filled in reaches the backend. It narrows nothing yet, and sending it
// would answer the panel with the historian's error for a column named "" instead of the rows
// the finished conditions match.
func TestLookupTableQueryDropsConditionsTheEditorHasNotFinished(t *testing.T) {
	t.Parallel()

	t.Run("an unfinished condition drops out and the rest is sent", func(t *testing.T) {
		t.Parallel()

		body := ""
		ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

		_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
			LookupTable: lookupTableUUID.String(),
			Filter: &schemas.LookupTableRowFilter{
				Condition: schemas.LookupTableRowConditionAnd,
				ConditionGroups: []schemas.LookupTableRowConditionGroup{
					{Column: "line", Values: []interface{}{"L1"}},
					// No column picked yet.
					{Column: "", Values: []interface{}{}},
					// A column, but nothing to compare it against yet.
					{Column: "setpoint", Operator: schemas.LookupTableRowOperatorIn, Values: []interface{}{}},
					// A group holding nothing but an unfinished condition.
					{Filter: &schemas.LookupTableRowFilter{
						Condition:       schemas.LookupTableRowConditionOr,
						ConditionGroups: []schemas.LookupTableRowConditionGroup{{Column: ""}},
					}},
				},
			},
		})
		require.NoError(t, err)

		decoded := &schemas.LookupTableRowFilter{}
		require.NoError(t, json.Unmarshal([]byte(sentFilter(t, body)), decoded))
		assert.Equal(t, &schemas.LookupTableRowFilter{
			Condition: schemas.LookupTableRowConditionAnd,
			ConditionGroups: []schemas.LookupTableRowConditionGroup{
				{Column: "line", Values: []interface{}{"L1"}},
			},
		}, decoded)
	})

	// A condition reading whether a cell is filled in is finished the moment it has a column:
	// it has no values to wait for.
	t.Run("a condition on an empty cell is finished without values", func(t *testing.T) {
		t.Parallel()

		body := ""
		ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

		_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
			LookupTable: lookupTableUUID.String(),
			Filter: &schemas.LookupTableRowFilter{
				Condition: schemas.LookupTableRowConditionAnd,
				ConditionGroups: []schemas.LookupTableRowConditionGroup{
					{Column: "setpoint", Operator: schemas.LookupTableRowOperatorIsNull},
				},
			},
		})
		require.NoError(t, err)

		assert.Contains(t, sentFilter(t, body), `"IS NULL"`)
	})

	// Nothing finished means no filter at all, rather than a filter the historian rejects.
	t.Run("a filter with nothing finished is not sent", func(t *testing.T) {
		t.Parallel()

		body := "unset"
		ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

		_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
			LookupTable: lookupTableUUID.String(),
			Filter: &schemas.LookupTableRowFilter{
				Condition:       schemas.LookupTableRowConditionAnd,
				ConditionGroups: []schemas.LookupTableRowConditionGroup{{Column: "", Values: []interface{}{}}},
			},
		})
		require.NoError(t, err)
		assert.JSONEq(t, `{"Limit":0}`, body)
	})
}

// A value that cannot be the column's type is left as it came. It matches nothing, which is
// the right answer for it, and turning it into an error would reject a template variable
// that happens to resolve to something unusable.
func TestLookupTableQueryLeavesAFilterValueThatDoesNotParse(t *testing.T) {
	t.Parallel()

	body := ""
	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

	filter := &schemas.LookupTableRowFilter{
		Condition: schemas.LookupTableRowConditionAnd,
		ConditionGroups: []schemas.LookupTableRowConditionGroup{
			{Column: "setpoint", Values: []interface{}{"n/a", nil}},
			{Column: "nosuchcolumn", Values: []interface{}{"7"}},
		},
	}

	_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
		Filter:      filter,
	})
	require.NoError(t, err)

	decoded := &schemas.LookupTableRowFilter{}
	require.NoError(t, json.Unmarshal([]byte(sentFilter(t, body)), decoded))
	assert.Equal(t, filter, decoded)
}

// The rows are read with a POST carrying the whole query: the filter is a tree, and the GET
// on the row collection is deprecated and reads no filter at all, so a query sent there
// would answer with every row of the table instead of the ones it narrows to.
func TestLookupTableQueryReadsRowsWithAPostCarryingNoLimit(t *testing.T) {
	t.Parallel()

	method := ""
	path := ""
	body := ""
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/lookup-tables", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, []schemas.LookupTable{lookupTableFixture()})
	})
	mux.HandleFunc("/api/lookup-tables/{uuid}/rows/query", func(w http.ResponseWriter, req *http.Request) {
		method = req.Method
		path = req.URL.Path
		sent, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		body = string(sent)
		writeJSON(w, lookupTableRows())
	})
	ds := newFakeHistorianDataSource(t, mux)

	_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
	})
	require.NoError(t, err)

	assert.Equal(t, http.MethodPost, method)
	assert.Equal(t, "/api/lookup-tables/"+lookupTableUUID.String()+"/rows/query", path)

	// A limit of zero reads as no pagination. Left out, the historian answers with the first
	// hundred rows, and a table longer than that would silently stop short in the panel.
	assert.JSONEq(t, `{"Limit":0}`, body)
}

// The historian ignores the values of a condition reading whether a cell is filled in, but
// they have no business on the wire: a dashboard written by hand, or one written by an older
// plugin version, is the only way to get them, and sending them contradicts what the filter
// documents itself as.
func TestLookupTableQueryDropsTheValuesOfAnEmptyCellCondition(t *testing.T) {
	t.Parallel()

	body := ""
	ds := fakeLookupTableHistorian(t, lookupTableFixture(), lookupTableRows(), &body)

	_, err := ds.handleLookupTableQuery(t.Context(), schemas.LookupTableQuery{
		LookupTable: lookupTableUUID.String(),
		Filter: &schemas.LookupTableRowFilter{
			Condition: schemas.LookupTableRowConditionAnd,
			ConditionGroups: []schemas.LookupTableRowConditionGroup{
				{Column: "setpoint", Operator: schemas.LookupTableRowOperatorIsNull, Values: []interface{}{"20"}},
				{Column: "line", Operator: schemas.LookupTableRowOperatorIsNotNull, Values: []interface{}{"L1"}},
			},
		},
	})
	require.NoError(t, err)

	decoded := &schemas.LookupTableRowFilter{}
	require.NoError(t, json.Unmarshal([]byte(sentFilter(t, body)), decoded))
	assert.Equal(t, &schemas.LookupTableRowFilter{
		Condition: schemas.LookupTableRowConditionAnd,
		ConditionGroups: []schemas.LookupTableRowConditionGroup{
			{Column: "setpoint", Operator: schemas.LookupTableRowOperatorIsNull},
			{Column: "line", Operator: schemas.LookupTableRowOperatorIsNotNull},
		},
	}, decoded)
}
