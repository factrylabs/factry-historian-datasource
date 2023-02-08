package api

import (
	"github.com/go-resty/resty/v2"
)

// API is used to communicate with the historian API
type API struct {
	client *resty.Client
}

// NewAPIWithToken creates a new instance of API using a token
func NewAPIWithToken(url string, token string, organization string) (*API, error) {
	headers := map[string]string{
		"x-organization-uuid": organization,
	}
	client := resty.New()
	client.SetHeaders(headers)
	client.SetAuthToken(token)
	client.SetBaseURL(url)
	api := &API{client}
	return api, nil
}
