package api

import (
	"context"
	"net/url"
	"regexp"
	"strings"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/factrylabs/factry-historian-datasource.git/pkg/util"
	"github.com/google/uuid"
)

// GetFilteredAssets returns a map of assets that match the given asset strings
func (api *API) GetFilteredAssets(ctx context.Context, assetStrings []string, historianInfo *schemas.HistorianInfo) (map[uuid.UUID]schemas.Asset, error) {
	assetUUIDSet := map[uuid.UUID]schemas.Asset{}
	if util.CheckMinimumVersion(historianInfo, "6.4.0", false) {
		for _, assetString := range assetStrings {
			searchKey := "Path"
			if _, err := uuid.Parse(assetString); err == nil {
				searchKey = "Keyword"
			}
			assetQuery := url.Values{}
			assetQuery.Add(searchKey, assetString)
			assets, err := api.GetAssets(ctx, assetQuery.Encode())
			if err != nil {
				return nil, err
			}

			for _, asset := range assets {
				assetUUIDSet[asset.UUID] = asset
			}
		}
	} else {
		// Deprecated
		assets, err := api.GetAssets(ctx, "")
		if err != nil {
			return nil, err
		}

		for _, assetString := range assetStrings {
			if filteredAssets := filterAssetUUIDs(assets, assetString); len(filteredAssets) > 0 {
				for _, asset := range filteredAssets {
					assetUUIDSet[asset.UUID] = asset
				}
			}
		}
	}

	return assetUUIDSet, nil
}

// GetFilteredEventTypes returns a map of event types that match the given event type strings
func (api *API) GetFilteredEventTypes(ctx context.Context, eventTypeStrings []string, historianInfo *schemas.HistorianInfo) (map[uuid.UUID]schemas.EventType, error) {
	eventTypeUUIDSet := map[uuid.UUID]schemas.EventType{}

	if util.CheckMinimumVersion(historianInfo, "6.4.0", false) {
		for _, eventTypeString := range eventTypeStrings {
			eventTypeQuery := url.Values{}
			eventTypeQuery.Add("Keyword", eventTypeString)
			eventTypes, err := api.GetEventTypes(ctx, eventTypeQuery.Encode())
			if err != nil {
				return nil, err
			}

			for _, eventType := range eventTypes {
				eventTypeUUIDSet[eventType.UUID] = eventType
			}
		}
	} else {
		// Deprecated
		eventTypes, err := api.GetEventTypes(ctx, "")
		if err != nil {
			return nil, err
		}

		for _, eventTypeString := range eventTypeStrings {
			if filteredEventTypes := filterEventTypeUUIDs(eventTypes, eventTypeString); len(filteredEventTypes) > 0 {
				for _, eventType := range filteredEventTypes {
					eventTypeUUIDSet[eventType.UUID] = eventType
				}
			}
		}
	}

	return eventTypeUUIDSet, nil
}

func filterItems[T any](items []T, searchValue string, matchFuncs ...func(T) string) []T {
	filteredItems := make([]T, 0, len(items))
	if len(searchValue) == 0 {
		return filteredItems // Early exit for empty search
	}
	var re *regexp.Regexp
	if strings.HasPrefix(searchValue, "/") && strings.HasSuffix(searchValue, "/") {
		if len(searchValue) > 2 {
			pattern := searchValue[1 : len(searchValue)-1]
			var err error
			re, err = regexp.Compile(pattern)
			if err != nil {
				return filteredItems
			}
		}
	}

	for _, item := range items {
		for _, matchFunc := range matchFuncs {
			if (re != nil && re.MatchString(matchFunc(item))) || (re == nil && matchFunc(item) == searchValue) {
				filteredItems = append(filteredItems, item)
				break
			}
		}
	}
	return filteredItems
}
func filterAssetUUIDs(assets []schemas.Asset, searchValue string) []schemas.Asset {
	return filterItems(assets, searchValue,
		func(asset schemas.Asset) string { return asset.AssetPath },
		func(asset schemas.Asset) string { return asset.UUID.String() })
}
func filterEventTypeUUIDs(eventTypes []schemas.EventType, searchValue string) []schemas.EventType {
	return filterItems(eventTypes, searchValue,
		func(eventType schemas.EventType) string { return eventType.Name },
		func(eventType schemas.EventType) string { return eventType.UUID.String() })
}
