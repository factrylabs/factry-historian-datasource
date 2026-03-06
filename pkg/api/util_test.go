package api_test

import (
	"testing"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
)

func TestAppendEscapedQuery(t *testing.T) {
	t.Parallel()

	type args struct {
		baseURL string
		query   string
	}
	tests := []struct {
		name    string
		args    args
		want    string
		wantErr bool
	}{
		{
			name: "appends query to base URL",
			args: args{
				baseURL: "/api/assets",
				query:   "name=asset1",
			},
			want:    "/api/assets?name=asset1",
			wantErr: false,
		},
		{
			name: "appends query with special characters",
			args: args{
				baseURL: "/api/assets",
				query:   "name=asset 1&status=active",
			},
			want:    "/api/assets?name=asset+1&status=active",
			wantErr: false,
		},
		{
			name: "does not double encode regex query value",
			args: args{
				baseURL: "/api/measurements",
				query:   "Keyword=/rand_number.*/",
			},
			want:    "/api/measurements?Keyword=%2Frand_number.%2A%2F",
			wantErr: false,
		},
		{
			name: "returns error for invalid query",
			args: args{
				baseURL: "/api/assets",
				query:   "name=%",
			},
			want:    "",
			wantErr: true,
		},
	}
	for i := range tests {
		tt := tests[i]
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := api.AppendEscapedQuery(tt.args.baseURL, tt.args.query)
			if (err != nil) != tt.wantErr {
				t.Errorf("AppendEscapedQuery() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("AppendEscapedQuery() = %v, want %v", got, tt.want)
			}
		})
	}
}
