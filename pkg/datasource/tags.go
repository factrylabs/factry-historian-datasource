package datasource

import (
	"context"
	"errors"
	"maps"
	"slices"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/api"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var errMissingPathParameter = errors.New("missing path parameter")

func handleGetTagKeys(ctx context.Context, api *api.API, path []string, rawQuery string) ([]string, error) {
	if len(path) < 1 {
		return nil, errMissingPathParameter
	}

	// if the path contains a measurement uuid fetch keys by measurement uuid
	if len(path) == 2 {
		measurement := path[1]
		frames, err := api.GetTagKeys(ctx, measurement)
		if err != nil {
			return nil, err
		}

		return getStringSetFromFrames(frames, "tagKey"), nil
	}

	// if no measurement in the path use the query parameters
	measurements, err := api.GetMeasurements(ctx, rawQuery)
	if err != nil {
		return nil, err
	}

	frames := data.Frames{}
	for i := range measurements {
		result, err := api.GetTagKeys(ctx, measurements[i].UUID.String())
		if err != nil {
			return nil, err
		}

		frames = mergeFrames(frames, result)
	}
	return getStringSetFromFrames(frames, "tagKey"), nil
}

func handleGetTagValues(ctx context.Context, api *api.API, path []string, rawQuery string) ([]string, error) {
	if len(path) < 2 {
		return nil, errMissingPathParameter
	}

	// if the path contains a measurement uuid fetch values by measurement uuid and tag key
	if len(path) == 3 {
		measurement := path[1]
		key := path[2]
		frames, err := api.GetTagValues(ctx, measurement, key)
		if err != nil {
			return nil, err
		}

		return getStringSetFromFrames(frames, "value"), nil
	}

	// if no measurement in the path use the query parameters to get the measurements
	measurements, err := api.GetMeasurements(ctx, rawQuery)
	if err != nil {
		return nil, err
	}

	frames := data.Frames{}
	key := path[1]
	for i := range measurements {
		result, err := api.GetTagValues(ctx, measurements[i].UUID.String(), key)
		if err != nil {
			return nil, err
		}

		frames = mergeFrames(frames, result)
	}
	return getStringSetFromFrames(frames, "value"), nil
}

func getStringSetFromFrames(frames data.Frames, fieldName string) []string {
	values := map[string]struct{}{}

	for _, frame := range frames {
		field, fieldFound := frame.FieldByName(fieldName)
		if fieldFound == -1 {
			continue
		}

		for i := 0; i < field.Len(); i++ {
			value, ok := field.At(i).(*string)
			if !ok || value == nil {
				continue
			}

			values[*value] = struct{}{}
		}
	}

	return slices.Collect(maps.Keys(values))
}
