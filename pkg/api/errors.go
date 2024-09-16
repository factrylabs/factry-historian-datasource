package api

import (
	"encoding/json"
	"fmt"

	"github.com/go-resty/resty/v2"
)

// HttpError historian http error
type HttpError struct {
	Info  string
	Error string
}

func handleHistorianError(response *resty.Response) error {
	var httpErr HttpError
	if err := json.Unmarshal(response.Body(), &httpErr); err != nil {
		return fmt.Errorf(string(response.Body()))
	}

	if httpErr.Info == "" {
		return fmt.Errorf("StatusCode: %v, Error: %v", response.StatusCode(), httpErr.Error)
	}

	return fmt.Errorf("StatusCode: %v, Info: %v, Error: %v", response.StatusCode(), httpErr.Info, httpErr.Error)
}
