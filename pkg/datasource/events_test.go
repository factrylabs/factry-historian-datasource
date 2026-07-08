package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEventQueryResultToDataFrame_ParentAssetEnrichment is a builder-level contract test:
// when the parent's asset is present in the slice handed to the data-frame builder, the
// Parent_Asset and Parent_AssetPath fields populate correctly.
func TestEventQueryResultToDataFrame_ParentAssetEnrichment(t *testing.T) {
	t.Parallel()

	parentAsset := schemas.Asset{
		BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "machine"},
		AssetPath: `\\site\\machine`,
	}
	childAsset := schemas.Asset{
		BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "sensor"},
		AssetPath: `\\site\\machine\\sensor`,
	}
	parentEventType := schemas.EventType{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "Batch"}}
	childEventType := schemas.EventType{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "Phase"}}

	startTime := time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC)
	parentStop := startTime.Add(2 * time.Hour)
	childStop := startTime.Add(time.Hour)
	parentUUID := uuid.New()
	parentEvent := schemas.Event{
		UUID:          parentUUID,
		AssetUUID:     parentAsset.UUID,
		EventTypeUUID: parentEventType.UUID,
		StartTime:     startTime,
		StopTime:      &parentStop,
	}
	childEvent := schemas.Event{
		UUID:          uuid.New(),
		AssetUUID:     childAsset.UUID,
		EventTypeUUID: childEventType.UUID,
		StartTime:     startTime,
		StopTime:      &childStop,
		ParentUUID:    &parentUUID,
		Parent:        &parentEvent,
	}

	frames, err := EventQueryResultToDataFrame(
		true,
		false,
		[]schemas.Asset{childAsset, parentAsset},
		[]schemas.Event{childEvent},
		[]schemas.EventType{childEventType, parentEventType},
		nil,
		map[string]struct{}{},
		map[string]data.FieldType{},
		map[uuid.UUID]data.Frames{},
	)
	require.NoError(t, err)
	require.Len(t, frames, 1)

	gotName := concreteString(t, frames[0], parentEventPrefix+AssetColumnName)
	gotPath := concreteString(t, frames[0], parentEventPrefix+AssetPathColumnName)
	gotUUID := concreteString(t, frames[0], parentEventPrefix+AssetUUIDColumnName)

	assert.Equal(t, parentAsset.Name, gotName)
	assert.Equal(t, parentAsset.AssetPath, gotPath)
	assert.Equal(t, parentAsset.UUID.String(), gotUUID)
}

// TestHandleEventQuery_PopulatesParentAssetOutsideSelection is the regression test for
// ticket 34763: when the user selects a leaf asset but enables "Include parent event",
// the parent event's asset is not in the selected asset filter. The handler must still
// populate Parent_Asset and Parent_AssetPath in the resulting frame.
//
// Without the fix in handleEventQuery, the asset map handed to the data-frame builder
// only contains the user-selected child asset, so the parent asset name/path lookups
// resolve to empty strings.
func TestHandleEventQuery_PopulatesParentAssetOutsideSelection(t *testing.T) {
	t.Parallel()

	parentAsset := schemas.Asset{
		BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "machine"},
		AssetPath: `\\site\\machine`,
	}
	childAsset := schemas.Asset{
		BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "sensor"},
		AssetPath: `\\site\\machine\\sensor`,
	}
	parentEventType := schemas.EventType{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "Batch"}}
	childEventType := schemas.EventType{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "Phase"}}

	startTime := time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC)
	parentStop := startTime.Add(2 * time.Hour)
	childStop := startTime.Add(time.Hour)
	parentUUID := uuid.New()
	parentEvent := schemas.Event{
		UUID:          parentUUID,
		AssetUUID:     parentAsset.UUID,
		EventTypeUUID: parentEventType.UUID,
		StartTime:     startTime,
		StopTime:      &parentStop,
	}
	childEvent := schemas.Event{
		UUID:          uuid.New(),
		AssetUUID:     childAsset.UUID,
		EventTypeUUID: childEventType.UUID,
		StartTime:     startTime,
		StopTime:      &childStop,
		ParentUUID:    &parentUUID,
		Parent:        &parentEvent,
	}

	server := newFakeHistorianServer(t, fakeHistorianData{
		assetsByPath:    map[string]schemas.Asset{childAsset.AssetPath: childAsset},
		assetsByUUID:    map[string]schemas.Asset{parentAsset.UUID.String(): parentAsset, childAsset.UUID.String(): childAsset},
		eventTypesByKey: map[string]schemas.EventType{childEventType.Name: childEventType, childEventType.UUID.String(): childEventType, parentEventType.UUID.String(): parentEventType},
		allEventTypes:   []schemas.EventType{childEventType, parentEventType},
		events:          []schemas.Event{childEvent},
	})
	t.Cleanup(server.Close)

	apiClient, err := api.NewAPIWithToken(server.URL, "test-token", "test-org")
	require.NoError(t, err)
	ds := &HistorianDataSource{API: apiClient}

	historianInfo := &schemas.HistorianInfo{Version: "v7.0.0"}
	eventQuery := schemas.EventQuery{
		Type:              string(schemas.EventTypePropertyTypeSimple),
		Assets:            []string{childAsset.AssetPath},
		EventTypes:        []string{childEventType.Name},
		IncludeParentInfo: true,
	}
	timeRange := backend.TimeRange{From: startTime.Add(-time.Hour), To: startTime.Add(24 * time.Hour)}

	frames, err := ds.handleEventQuery(context.Background(), eventQuery, timeRange, time.Minute, 1000, historianInfo)
	require.NoError(t, err)
	require.Len(t, frames, 1, "expected one frame for the child event type")

	gotName := concreteString(t, frames[0], parentEventPrefix+AssetColumnName)
	gotPath := concreteString(t, frames[0], parentEventPrefix+AssetPathColumnName)
	gotUUID := concreteString(t, frames[0], parentEventPrefix+AssetUUIDColumnName)

	assert.Equal(t, parentAsset.Name, gotName, "Parent_Asset must reflect the parent event's asset name even when the parent's asset is outside the user-selected asset filter")
	assert.Equal(t, parentAsset.AssetPath, gotPath, "Parent_AssetPath must reflect the parent event's asset path even when the parent's asset is outside the user-selected asset filter")
	assert.Equal(t, parentAsset.UUID.String(), gotUUID)
}

// fakeHistorianData is a minimal in-memory representation of a Historian server's state,
// keyed by the query parameters the datasource uses to look things up.
type fakeHistorianData struct {
	assetsByPath    map[string]schemas.Asset
	assetsByUUID    map[string]schemas.Asset
	eventTypesByKey map[string]schemas.EventType
	allEventTypes   []schemas.EventType
	events          []schemas.Event
}

// newFakeHistorianServer spins up an httptest.Server that serves only the endpoints the
// event query handler touches, returning data based on the supplied filters.
func newFakeHistorianServer(t *testing.T, fixture fakeHistorianData) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()

	mux.HandleFunc("/api/assets", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		var matched []schemas.Asset
		uuids := indexedValues(q, "UUIDs")
		switch {
		case len(uuids) > 0:
			for _, u := range uuids {
				if asset, ok := fixture.assetsByUUID[u]; ok {
					matched = append(matched, asset)
				}
			}
		case q.Get("Path") != "":
			if asset, ok := fixture.assetsByPath[q.Get("Path")]; ok {
				matched = append(matched, asset)
			}
		case q.Get("Keyword") != "":
			if asset, ok := fixture.assetsByUUID[q.Get("Keyword")]; ok {
				matched = append(matched, asset)
			}
		default:
			for _, asset := range fixture.assetsByPath {
				matched = append(matched, asset)
			}
		}
		writeJSON(w, matched)
	})

	mux.HandleFunc("/api/event-types", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if keyword := q.Get("Keyword"); keyword != "" {
			if et, ok := fixture.eventTypesByKey[keyword]; ok {
				writeJSON(w, []schemas.EventType{et})
				return
			}
			writeJSON(w, []schemas.EventType{})
			return
		}
		writeJSON(w, fixture.allEventTypes)
	})

	mux.HandleFunc("/api/events", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, fixture.events)
	})

	mux.HandleFunc("/api/event-type-properties", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, []schemas.EventTypeProperty{})
	})

	return httptest.NewServer(mux)
}

// indexedValues returns the values of indexed query parameters like "Foo[0]=a&Foo[1]=b"
// in input order.
func indexedValues(q url.Values, prefix string) []string {
	var out []string
	for i := 0; ; i++ {
		v := q.Get(fmt.Sprintf("%s[%d]", prefix, i))
		if v == "" {
			return out
		}
		out = append(out, v)
	}
}

// writeJSON encodes body to w. Encode errors here would mean a programming bug in the
// test fixture (the input types are always serializable), so we panic — net/http's
// recoverer will abort the response and the production code's failed call will surface
// as a test-goroutine assertion. Calling t.FailNow from this handler goroutine is
// unsupported by testing.T.
func writeJSON(w http.ResponseWriter, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(body); err != nil {
		panic(err)
	}
}

func concreteString(t *testing.T, frame *data.Frame, name string) string {
	t.Helper()
	field, idx := frame.FieldByName(name)
	require.NotEqual(t, -1, idx, "missing field %q in frame %q", name, frame.Name)
	require.GreaterOrEqual(t, field.Len(), 1, "field %q is empty", name)
	v, _ := field.At(0).(*string)
	if v == nil {
		return ""
	}
	return *v
}

// TestAppendAssetPropertyValue covers the asset-property value merge in event
// queries. The production logs showed a recovered panic
// ("interface conversion: interface {} is *float64, not *string") when the
// declared destination column type and the concrete value type disagreed. The
// merge must convert across types and must never panic on a mismatch.
func TestAppendAssetPropertyValue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		dstType data.FieldType
		value   interface{}
		want    interface{}
	}{
		{"string<-float", data.FieldTypeNullableString, new(1.5), new("1.5")},
		{"string<-bool", data.FieldTypeNullableString, new(true), new("true")},
		{"string<-string", data.FieldTypeNullableString, new("hello"), new("hello")},
		{"string<-int64", data.FieldTypeNullableString, new(int64(42)), new("42")},
		{"string<-int32", data.FieldTypeNullableString, new(int32(7)), new("7")},
		{"string<-uint64", data.FieldTypeNullableString, new(uint64(9)), new("9")},
		{"string<-float32", data.FieldTypeNullableString, new(float32(2.5)), new("2.5")},
		{"string<-time", data.FieldTypeNullableString, new(time.Date(2026, 6, 16, 12, 0, 0, 0, time.UTC)), new("2026-06-16T12:00:00Z")},
		{"string<-nil", data.FieldTypeNullableString, (*float64)(nil), (*string)(nil)},
		{"string<-nil-int64", data.FieldTypeNullableString, (*int64)(nil), (*string)(nil)},
		{"float<-float", data.FieldTypeNullableFloat64, new(2.5), new(2.5)},
		// Mismatches that previously panicked: unconvertible -> nil, no panic.
		{"float<-string", data.FieldTypeNullableFloat64, new("nope"), (*float64)(nil)},
		{"bool<-float", data.FieldTypeNullableBool, new(1.0), (*bool)(nil)},
		{"bool<-bool", data.FieldTypeNullableBool, new(false), new(false)},
		{"nil value", data.FieldTypeNullableString, nil, (*string)(nil)},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			dst := data.NewFieldFromFieldType(tc.dstType, 0)
			require.NotPanics(t, func() {
				appendAssetPropertyValue(dst, tc.value)
			})
			require.Equal(t, 1, dst.Len())
			assert.Equal(t, tc.want, dst.At(0))
		})
	}
}

// TestGetAssetPropertyFieldTypes_UsesNamedValueField asserts the declared
// column type is taken from the named "value" field, not the positional
// Fields[1]. When frame formatting reorders/inserts fields (so Fields[1] is a
// string metric-name column while "value" stays float), the positional lookup
// previously declared the column as string, manufacturing a declared!=actual
// mismatch against the merge loop (which reads FieldByName("value")).
func TestGetAssetPropertyFieldTypes_UsesNamedValueField(t *testing.T) {
	t.Parallel()

	frame := data.NewFrame("",
		data.NewField("time", nil, []*time.Time{}),
		data.NewField("metricName", nil, []*string{}), // Fields[1] is a string column
		data.NewField(valueFieldName, nil, []*float64{}),
	)
	frame.Meta = &data.FrameMeta{Custom: map[string]interface{}{"AssetProperty": "Pressure"}}

	got := getAssetPropertyFieldTypes(map[uuid.UUID]data.Frames{uuid.New(): {frame}}, false)

	assert.Equal(t, data.FieldTypeNullableFloat64, got["Pressure"],
		"declared type must come from the named value field, not positional Fields[1]")
}

// dataFrameForEventType dereferences events[i].Parent guarded only by
// ParentUUID != nil. An event whose parent is not embedded in the response
// must not panic the query.
func TestEventWithParentUUIDButNoParentDoesNotPanic(t *testing.T) {
	t.Parallel()

	eventTypeUUID := uuid.New()
	parentUUID := uuid.New()
	events := []schemas.Event{{
		UUID:          uuid.New(),
		AssetUUID:     uuid.New(),
		EventTypeUUID: eventTypeUUID,
		StartTime:     time.Unix(0, 0).UTC(),
		ParentUUID:    &parentUUID,
		Parent:        nil, // parent not preloaded
	}}
	eventTypes := []schemas.EventType{{BaseModel: schemas.BaseModel{UUID: eventTypeUUID, Name: "batch"}}}

	assert.NotPanics(t, func() {
		_, _ = EventQueryResultToDataFrame(true, false, nil, events, eventTypes, nil,
			map[string]struct{}{}, map[string]data.FieldType{}, map[uuid.UUID]data.Frames{})
	})
}

// In EventQueryResultToTrendDataFrame the parent stop time must be written to
// labels, not eventLabels, so the Parent_StopTime label on periodic property
// columns carries the parent's stop time instead of being empty.
func TestTrendFrameParentStopTimeLabel(t *testing.T) {
	t.Parallel()

	eventTypeUUID := uuid.New()
	parentEventTypeUUID := uuid.New()
	stopTime := time.Unix(500, 0).UTC()

	parent := schemas.Event{
		UUID:          uuid.New(),
		AssetUUID:     uuid.New(),
		EventTypeUUID: parentEventTypeUUID,
		StartTime:     time.Unix(0, 0).UTC(),
		StopTime:      &stopTime,
	}
	event := schemas.Event{
		UUID:          uuid.New(),
		AssetUUID:     uuid.New(),
		EventTypeUUID: eventTypeUUID,
		StartTime:     time.Unix(100, 0).UTC(),
		Parent:        &parent,
		Properties: &schemas.EventProperties{
			Properties: schemas.Attributes{
				"profile": map[string]interface{}{
					"t": []interface{}{0.0, 1.0},
					"v": []interface{}{1.0, 2.0},
				},
			},
		},
	}

	eventTypes := map[uuid.UUID]schemas.EventType{
		eventTypeUUID:       {BaseModel: schemas.BaseModel{UUID: eventTypeUUID, Name: "batch"}},
		parentEventTypeUUID: {BaseModel: schemas.BaseModel{UUID: parentEventTypeUUID, Name: "order"}},
	}
	properties := map[uuid.UUID][]schemas.EventTypeProperty{
		eventTypeUUID: {{
			BaseModel:     schemas.BaseModel{UUID: uuid.New(), Name: "profile"},
			Datatype:      schemas.EventTypePropertyDatatypeNumber,
			Type:          schemas.EventTypePropertyTypePeriodic,
			EventTypeUUID: eventTypeUUID,
		}},
	}

	frames, err := EventQueryResultToTrendDataFrame(true, nil, []schemas.Event{event}, eventTypes,
		properties, map[string]struct{}{}, map[uuid.UUID]data.Frames{}, false)
	require.NoError(t, err)
	require.Len(t, frames, 1)

	var propertyField *data.Field
	for _, field := range frames[0].Fields {
		if field.Name != "Offset" {
			propertyField = field
		}
	}
	require.NotNil(t, propertyField, "expected a periodic property column")
	assert.Equal(t, stopTime.Format(time.RFC3339), propertyField.Labels[parentEventPrefix+StopTimeColumnName],
		"Parent_StopTime label must carry the parent's stop time")
}
