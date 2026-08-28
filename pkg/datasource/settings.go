package datasource

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// defaultResolutionCacheTTL is how long resolved metadata is reused when the
// datasource does not set resolutionCacheTTL. At a 2 second dashboard refresh it
// removes about 97% of the resolution requests; a longer TTL wins little and
// only widens the window in which a reconfigured asset stays unnoticed.
const defaultResolutionCacheTTL = "60"

// Settings - data loaded from grafana settings database
type Settings struct {
	URL          string `json:"url,omitempty"`
	Token        string `json:"-,omitempty"`
	Organization string `json:"organization,omitempty"`
	Timeout      string `json:"timeout,omitempty"`
	QueryTimeout string `json:"queryTimeout,omitempty"`
	// ResolutionCacheTTL is the number of seconds a resolved asset or
	// measurement lookup is reused, as a string of seconds like the timeouts.
	// "0" disables the caches. It also bounds how long a dashboard can keep
	// showing a measurement from a since-reconfigured asset.
	ResolutionCacheTTL string `json:"resolutionCacheTTL,omitempty"`
	InsecureSkipVerify bool   `json:"tlsSkipVerify,omitempty"`
}

func (settings *Settings) isValid() (err error) {
	if settings.URL == "" {
		return ErrorMessageInvalidURL
	}

	if settings.Token == "" {
		return ErrorMessageMissingCredentials
	}

	if settings.Organization == "" {
		return ErrorMessageNoOrganization
	}

	return nil
}

// LoadSettings will read and validate Settings from the DataSourceConfig
func LoadSettings(config backend.DataSourceInstanceSettings) (settings Settings, err error) {
	if err := json.Unmarshal(config.JSONData, &settings); err != nil {
		return settings, fmt.Errorf("%s: %w", err.Error(), ErrorMessageInvalidJSON)
	}

	if strings.TrimSpace(settings.Timeout) == "" {
		settings.Timeout = "10"
	}
	if strings.TrimSpace(settings.QueryTimeout) == "" {
		settings.QueryTimeout = "60"
	}
	// A value that does not parse as a non-negative number of seconds, or that
	// would overflow time.Duration, falls back to the default, so a typo cannot
	// silently disable the cache.
	settings.ResolutionCacheTTL = strings.TrimSpace(settings.ResolutionCacheTTL)
	if seconds, err := strconv.Atoi(settings.ResolutionCacheTTL); err != nil || seconds < 0 || int64(seconds) > math.MaxInt64/int64(time.Second) {
		settings.ResolutionCacheTTL = defaultResolutionCacheTTL
	}
	settings.Token = config.DecryptedSecureJSONData["token"]
	return settings, settings.isValid()
}
