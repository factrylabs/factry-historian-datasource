package api

import (
	"gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"

	"gitlab.com/factry/factry-core/rest.git"
)

type API struct {
	client rest.Client
}

// NewAPIWithToken creates a new instance of API using a token
func NewAPIWithToken(url string, token string) (*API, error) {
	client := rest.New(url)
	client.SetToken(token)
	api := &API{client}
	return api, nil
}

// NewAPIWithUser creates a new instance of API using user/password
func NewAPIWithUser(url string, user string, password string) (*API, error) {
	client := rest.New(url)

	login := schemas.LoginUser{
		Name:     user,
		Password: password,
	}

	result := struct {
		Token string
		Name  string
	}{}

	err := client.Post("/api/login", login, &result)
	if err != nil {
		return nil, err
	}

	client.SetToken(result.Token)
	api := &API{client}
	return api, nil
}
