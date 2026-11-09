package datasource

import (
	"context"
	"testing"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func displayNameOf(t *testing.T, frame *data.Frame) string {
	t.Helper()
	field, _ := frame.FieldByName(valueFieldName)
	require.NotNil(t, field)
	require.NotNil(t, field.Config)
	return field.Config.DisplayNameFromDS
}

func makeMeasurementFrame(t *testing.T, labels map[string]interface{}) *data.Frame {
	t.Helper()
	frame := makeFrame(t, data.NewField(valueFieldName, nil, []*float64{nil}), "")
	custom, ok := frame.Meta.Custom.(map[string]interface{})
	require.True(t, ok)
	custom["Description"] = "Oven temperature"
	custom["Labels"] = labels
	return frame
}

func TestSetMeasurementFrameNames_EmptyTemplateKeepsBuiltInName(t *testing.T) {
	t.Parallel()

	frame := makeMeasurementFrame(t, map[string]interface{}{"status": "Good", "site": "Ghent"})

	setMeasurementFrameNames(data.Frames{frame}, schemas.MeasurementQueryOptions{DisplayDatabaseName: true, DisplayDescription: true}, "")

	assert.Equal(t, "temperature {site: Ghent, status: Good, Description: Oven temperature, Database: factory}", displayNameOf(t, frame))
}

func TestSetMeasurementFrameNames_TemplateReplacesLabelPlaceholders(t *testing.T) {
	t.Parallel()

	frame := makeMeasurementFrame(t, map[string]interface{}{"status": "Good", "site": "Ghent"})

	setMeasurementFrameNames(data.Frames{frame}, schemas.MeasurementQueryOptions{}, `${__field.labels["MeasurementName"]} @ ${__field.labels.site} (${__field.labels["DatabaseName"]}, ${__field.labels.Description})`)

	assert.Equal(t, "temperature @ Ghent (factory, Oven temperature)", displayNameOf(t, frame))
}

func TestSetMeasurementFrameNames_TemplateIgnoresDisplayOptions(t *testing.T) {
	t.Parallel()

	frame := makeMeasurementFrame(t, map[string]interface{}{"status": "Good"})

	setMeasurementFrameNames(data.Frames{frame}, schemas.MeasurementQueryOptions{DisplayDatabaseName: true, DisplayDescription: true}, `${__field.labels.MeasurementName}`)

	assert.Equal(t, "temperature", displayNameOf(t, frame))
}

func TestSetMeasurementFrameNames_UnknownLabelRendersEmpty(t *testing.T) {
	t.Parallel()

	frame := makeMeasurementFrame(t, map[string]interface{}{"status": "Good"})

	setMeasurementFrameNames(data.Frames{frame}, schemas.MeasurementQueryOptions{}, `${__field.labels.MeasurementName}[${__field.labels["missing"]}]`)

	assert.Equal(t, "temperature[]", displayNameOf(t, frame))
}

func TestSetMeasurementFrameNames_KeepsOtherText(t *testing.T) {
	t.Parallel()

	frame := makeMeasurementFrame(t, map[string]interface{}{"status": "Good"})

	setMeasurementFrameNames(data.Frames{frame}, schemas.MeasurementQueryOptions{}, `$__interval ${__field.name} ${__field.labels.status}`)

	assert.Equal(t, "$__interval ${__field.name} Good", displayNameOf(t, frame))
}

func makeAssetQueryInput(t *testing.T) (data.Frames, map[uuid.UUID]schemas.Asset, []schemas.AssetProperty) {
	t.Helper()
	measurementUUID := uuid.New()
	assetUUID := uuid.New()
	frame := makeMeasurementFrame(t, map[string]interface{}{"status": "Good"})
	custom, ok := frame.Meta.Custom.(map[string]interface{})
	require.True(t, ok)
	custom["MeasurementUUID"] = measurementUUID.String()

	assets := map[uuid.UUID]schemas.Asset{
		assetUUID: {BaseModel: schemas.BaseModel{UUID: assetUUID, Name: "Line 1"}, AssetPath: `Plant\Line 1`},
	}
	properties := []schemas.AssetProperty{
		{BaseModel: schemas.BaseModel{UUID: uuid.New(), Name: "Speed"}, AssetUUID: assetUUID, MeasurementUUID: measurementUUID},
	}
	return data.Frames{frame}, assets, properties
}

func TestSetAssetFrameNames_EmptyTemplateKeepsBuiltInName(t *testing.T) {
	t.Parallel()

	frames, assets, properties := makeAssetQueryInput(t)

	frames = setAssetFrameNames(frames, assets, properties, schemas.MeasurementQueryOptions{}, "")

	require.Len(t, frames, 1)
	assert.Equal(t, `Plant\Line 1\\Speed {status: Good}`, displayNameOf(t, frames[0]))
}

func TestSetAssetFrameNames_TemplateReplacesLabelPlaceholders(t *testing.T) {
	t.Parallel()

	frames, assets, properties := makeAssetQueryInput(t)

	frames = setAssetFrameNames(frames, assets, properties, schemas.MeasurementQueryOptions{}, `${__field.labels["AssetName"]} - ${__field.labels["AssetProperty"]}`)

	require.Len(t, frames, 1)
	assert.Equal(t, "Line 1 - Speed", displayNameOf(t, frames[0]))
}

func TestAssetMeasurementQueryUsesDatasourceDisplayName(t *testing.T) {
	t.Parallel()

	assetUUID := uuid.New()
	ds := assetQueryFixture(t, assetUUID, []schemas.AssetProperty{{
		BaseModel:       schemas.BaseModel{UUID: uuid.New(), Name: "temperature"},
		AssetUUID:       assetUUID,
		MeasurementUUID: uuid.New(),
	}})
	ds.displayNameAssets = `${__field.labels.AssetProperty} (${__field.labels.DatabaseName})`

	timeRange := backend.TimeRange{From: time.Unix(0, 0).UTC(), To: time.Unix(3600, 0).UTC()}
	frames, err := ds.handleAssetMeasurementQuery(context.Background(), schemas.AssetMeasurementQuery{
		Assets: []string{"plant"},
	}, timeRange, time.Minute, 50, &schemas.HistorianInfo{Version: "v7.0.0"})

	require.NoError(t, err)
	require.Len(t, frames, 1)
	assert.Equal(t, "temperature (factory)", displayNameOf(t, frames[0]))
}

func TestLoadSettingsDisplayNameTemplates(t *testing.T) {
	t.Parallel()

	settings, err := LoadSettings(backend.DataSourceInstanceSettings{
		JSONData:                []byte(`{"url":"http://historian:8000","organization":"org","displayNameAssets":"  ","displayNameMeasurements":" ${__field.labels.MeasurementName} "}`),
		DecryptedSecureJSONData: map[string]string{"token": "tok"},
	})
	require.NoError(t, err)
	assert.Empty(t, settings.DisplayNameAssets, "a blank template keeps the built-in name")
	assert.Equal(t, "${__field.labels.MeasurementName}", settings.DisplayNameMeasurements)
}
