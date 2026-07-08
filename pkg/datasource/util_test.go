package datasource

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// handleJSON must set the Content-Type header before writing the body, so
// resource responses are served as application/json instead of being
// content-sniffed as text/plain.
func TestResourceResponsesHaveJSONContentType(t *testing.T) {
	t.Parallel()

	handler := handleJSON(func(_ http.ResponseWriter, _ *http.Request) (interface{}, error) {
		return []string{"a", "b"}, nil
	})
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, server.URL, http.NoBody)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	assert.Contains(t, resp.Header.Get("Content-Type"), "application/json")
}
