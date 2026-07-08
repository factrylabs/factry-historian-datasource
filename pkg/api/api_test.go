package api_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	arrow_pb "github.com/factrylabs/factry-historian-datasource.git/pkg/proto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
)

// baseURLRoundTripper rewrites req.URL.Path but must also update RawPath. When
// the historian URL has a path prefix, a stale RawPath is discarded by Go's
// URL.EscapedPath and percent-escaped segments are re-escaped from the decoded
// Path, so a tag key like "a/b" (escaped as "a%2Fb" by GetTagValues) would
// reach the server as two path segments.
func TestBaseURLPrefixPreservesEscapedPathSegments(t *testing.T) {
	t.Parallel()

	var gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		body, err := proto.Marshal(&arrow_pb.DataResponse{})
		assert.NoError(t, err)
		w.Header().Set("Content-Type", "application/protobuf")
		_, _ = w.Write(body)
	}))
	t.Cleanup(server.Close)

	historianAPI, err := api.NewAPIWithToken(server.URL+"/historian", "token", "org")
	require.NoError(t, err)

	_, err = historianAPI.GetTagValues(context.Background(), "meas-uuid", "a/b")
	require.NoError(t, err)

	assert.Equal(t, "/historian/api/timeseries/measurements/meas-uuid/tags/a%2Fb", gotPath,
		"the escaped tag key must survive the base-URL path rewrite")
}
