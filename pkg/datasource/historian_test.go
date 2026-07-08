package datasource

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The tlsSkipVerify (and timeout) datasource settings are decoded in
// LoadSettings and must be wired into the HTTP client, so a historian behind a
// self-signed certificate is reachable when TLS verification is disabled in the
// datasource config.
func TestTLSSkipVerifySettingIsApplied(t *testing.T) {
	t.Parallel()

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"Version":"v7.0.0","APIVersion":"v1"}`))
	}))
	t.Cleanup(server.Close)

	instance, err := NewDataSource(context.Background(), backend.DataSourceInstanceSettings{
		JSONData:                []byte(`{"url":"` + server.URL + `","organization":"org","tlsSkipVerify":true}`),
		DecryptedSecureJSONData: map[string]string{"token": "token"},
	})
	require.NoError(t, err)
	ds, ok := instance.(*HistorianDataSource)
	require.True(t, ok)

	_, err = ds.API.GetInfo(context.Background())
	assert.NoError(t, err, "tlsSkipVerify=true must allow connecting to a historian with a self-signed certificate")
}
