package api

import (
	"gitlab.com/factry/factry-core/rest.git"
)

// API is used to communicate with the historian API
type API struct {
	client rest.Client
}

// NewAPIWithToken creates a new instance of API using a token
func NewAPIWithToken(url string, token string, organization string) (*API, error) {
	headers := map[string]string{
		"x-organization-uuid": organization,
	}
	client := rest.New(url)
	client.SetToken(token)
	client.SetHeaders(headers)
	api := &API{client}
	return api, nil
}
