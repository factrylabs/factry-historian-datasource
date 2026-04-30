package datasource

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
		switch {
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
