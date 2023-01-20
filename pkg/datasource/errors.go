package datasource

import "github.com/pkg/errors"

// error consts
var (
	ErrorMessageInvalidJSON              = errors.New("could not parse json")
	ErrorMessageInvalidURL               = errors.New("invalid url. Either empty or not set")
	ErrorMessageInvalidPort              = errors.New("invalid port")
	ErrorMessageInvalidUserName          = errors.New("username is either empty or not set")
	ErrorMessageInvalidPassword          = errors.New("password is either empty or not set")
	ErrorQueryDataNotImplemented         = errors.New("query data not implemented")
	ErrorInvalidResourceCallQuery        = errors.New("invalid resource query")
	ErrorFailedUnmarshalingResourceQuery = errors.New("failed to unmarshal resource query")
	ErrorQueryParsingNotImplemented      = errors.New("query parsing not implemented yet")
	ErrorUnmarshalingSettings            = errors.New("error while unmarshaling settings")
	ErrorInvalidSentryConfig             = errors.New("invalid sentry configuration")
	ErrorInvalidAuthToken                = errors.New("empty or invalid auth token found")
	ErrorInvalidOrganizationSlug         = errors.New("invalid or empty organization slug")
	ErrorUnknownQueryType                = errors.New("unknown query type")
	ErrorMessageMissingCredentials       = errors.New("no token")
	ErrorMessageNoOrganization           = errors.New("no organization selected")
)
