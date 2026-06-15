package schemas

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAssetLazyFieldsRoundTrip guards against the datasource backend silently
// dropping the lazy-load fields historian >= v8.2.0 returns. The plugin proxies
// GET /assets by decoding the historian response into []schemas.Asset and
// re-serializing it to the frontend; if a field is missing from the struct it is
// dropped on decode, so the frontend never sees HasChildren/HasAssetProperties
// and every node renders a dead expand arrow.
func TestAssetLazyFieldsRoundTrip(t *testing.T) {
	t.Parallel()

	historianResponse := `{
		"UUID": "3db93146-92b3-11ef-b740-0242c0a81002",
		"Name": "Line 1",
		"AssetPath": "Line 1",
		"Ancestors": ["62200f48-950e-11ef-bde6-0242c0a81002"],
		"HasChildren": true,
		"HasAssetProperties": false,
		"HasEventConfigurations": true
	}`

	var asset Asset
	require.NoError(t, json.Unmarshal([]byte(historianResponse), &asset))

	require.NotNil(t, asset.HasChildren)
	assert.True(t, *asset.HasChildren)
	require.NotNil(t, asset.HasAssetProperties)
	assert.False(t, *asset.HasAssetProperties)
	require.NotNil(t, asset.HasEventConfigurations)
	assert.True(t, *asset.HasEventConfigurations)
	assert.Equal(t, []string{"62200f48-950e-11ef-bde6-0242c0a81002"}, asset.Ancestors)

	// Re-serialize the way the resource handler does and confirm the flags survive.
	out, err := json.Marshal(asset)
	require.NoError(t, err)
	roundTripped := string(out)
	assert.Contains(t, roundTripped, `"HasChildren":true`)
	assert.Contains(t, roundTripped, `"HasAssetProperties":false`)
	assert.Contains(t, roundTripped, `"HasEventConfigurations":true`)
	assert.Contains(t, roundTripped, `"Ancestors":["62200f48-950e-11ef-bde6-0242c0a81002"]`)
}

// TestAssetLazyFieldsOmittedWhenAbsent verifies that a request that does not ask
// for the Include* flags (so historian omits them) does not emit zero-valued
// flags back to the frontend. The frontend distinguishes "leaf" (false) from
// "flag not requested" (absent); emitting false here would make hasFlags true on
// requests that never asked, breaking the optimistic-expandable default.
func TestAssetLazyFieldsOmittedWhenAbsent(t *testing.T) {
	t.Parallel()

	var asset Asset
	require.NoError(t, json.Unmarshal([]byte(`{"UUID":"3db93146-92b3-11ef-b740-0242c0a81002","Name":"Line 1","AssetPath":"Line 1"}`), &asset))

	assert.Nil(t, asset.HasChildren)
	assert.Nil(t, asset.HasAssetProperties)
	assert.Nil(t, asset.HasEventConfigurations)
	assert.Nil(t, asset.Ancestors)

	out, err := json.Marshal(asset)
	require.NoError(t, err)
	roundTripped := string(out)
	assert.NotContains(t, roundTripped, "HasChildren")
	assert.NotContains(t, roundTripped, "HasAssetProperties")
	assert.NotContains(t, roundTripped, "HasEventConfigurations")
	assert.NotContains(t, roundTripped, "Ancestors")
}
