package datasource

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// Settings - data loaded from grafana settings database
type Settings struct {
	URL                string `json:"url,omitempty"`
	Username           string `json:"username,omitempty"`
	Token              string `json:"token,omitempty"`
	InsecureSkipVerify bool   `json:"tlsSkipVerify,omitempty"`
	Password           string `json:"-,omitempty"`
	Timeout            string `json:"timeout,omitempty"`
	QueryTimeout       string `json:"queryTimeout,omitempty"`
}

func (settings *Settings) isValid() (err error) {
	if settings.URL == "" {
		return ErrorMessageInvalidURL
	}

	if settings.Token == "" && (settings.Username == "" || settings.Password == "") {
		return ErrorMessageMissingCredentials
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
	settings.Password = config.DecryptedSecureJSONData["password"]
	settings.Token = config.DecryptedSecureJSONData["token"]
	return settings, settings.isValid()
}
