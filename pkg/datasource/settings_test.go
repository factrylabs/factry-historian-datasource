package datasource

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A malformed resolutionCacheTTL must fall back to the default instead of
// silently disabling the cache. Only an explicit "0" turns it off.
func TestLoadSettingsResolutionCacheTTL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		ttl  string
		want string
	}{
		{name: "absent uses the default", ttl: "", want: defaultResolutionCacheTTL},
		{name: "blank uses the default", ttl: `,"resolutionCacheTTL":"  "`, want: defaultResolutionCacheTTL},
		{name: "a typo uses the default", ttl: `,"resolutionCacheTTL":"60s"`, want: defaultResolutionCacheTTL},
		{name: "a negative value uses the default", ttl: `,"resolutionCacheTTL":"-5"`, want: defaultResolutionCacheTTL},
		{name: "a value overflowing time.Duration uses the default", ttl: `,"resolutionCacheTTL":"9223372037"`, want: defaultResolutionCacheTTL},
		{name: "zero disables", ttl: `,"resolutionCacheTTL":"0"`, want: "0"},
		{name: "surrounding whitespace is trimmed", ttl: `,"resolutionCacheTTL":" 30 "`, want: "30"},
		{name: "a valid value is kept", ttl: `,"resolutionCacheTTL":"120"`, want: "120"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			settings, err := LoadSettings(backend.DataSourceInstanceSettings{
				JSONData:                []byte(`{"url":"http://historian:8000","organization":"org"` + tt.ttl + `}`),
				DecryptedSecureJSONData: map[string]string{"token": "tok"},
			})
			require.NoError(t, err)
			assert.Equal(t, tt.want, settings.ResolutionCacheTTL)
		})
	}
}
