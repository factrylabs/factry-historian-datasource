package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
)

// param collects a query parameter that callers encode either as a repeated
// key (Grafana's resource client: `Key=a&Key=b`) or as an indexed key (the Go
// backend's form encoding: `Key[0]=a&Key[1]=b`).
func param(values url.Values, key string) []string {
	result := append([]string{}, values[key]...)
	for i := 0; ; i++ {
		indexed, ok := values[fmt.Sprintf("%s[%d]", key, i)]
		if !ok {
			break
		}
		result = append(result, indexed...)
	}
	return result
}

func paramBool(values url.Values, key string) bool {
	v, err := strconv.ParseBool(values.Get(key))
	return err == nil && v
}

func paramInt(values url.Values, key string) int {
	v, err := strconv.Atoi(values.Get(key))
	if err != nil {
		return 0
	}
	return v
}

func paramTime(values url.Values, key string) (time.Time, bool) {
	raw := values.Get(key)
	if raw == "" {
		return time.Time{}, false
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05Z0700"} {
		if t, err := time.Parse(layout, raw); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// matchKeyword mimics the historian's search semantics closely enough for the
// datasource: empty matches everything, `/…/` is a regular expression, a
// parseable UUID matches the item's UUID, anything else is a substring match.
func matchKeyword(keyword string, itemUUID uuid.UUID, texts ...string) bool {
	if keyword == "" {
		return true
	}
	if strings.HasPrefix(keyword, "/") && strings.HasSuffix(keyword, "/") && len(keyword) > 2 {
		re, err := regexp.Compile(keyword[1 : len(keyword)-1])
		if err != nil {
			return false
		}
		return slices.ContainsFunc(texts, re.MatchString)
	}
	if parsed, err := uuid.Parse(keyword); err == nil {
		return parsed == itemUUID
	}
	lowered := strings.ToLower(keyword)
	return slices.ContainsFunc(texts, func(text string) bool {
		return strings.Contains(strings.ToLower(text), lowered)
	})
}

// matchPath matches an asset path filter: `/…/` is a regular expression,
// anything else must match the full path exactly.
func matchPath(filter, assetPath string) bool {
	if strings.HasPrefix(filter, "/") && strings.HasSuffix(filter, "/") && len(filter) > 2 {
		re, err := regexp.Compile(filter[1 : len(filter)-1])
		if err != nil {
			return false
		}
		return re.MatchString(assetPath)
	}
	return filter == assetPath
}

func containsUUID(values []string, id uuid.UUID) bool {
	for _, value := range values {
		if parsed, err := uuid.Parse(value); err == nil && parsed == id {
			return true
		}
	}
	return false
}

// writeJSON encodes v as JSON. The datasource unmarshals into pkg/schemas
// structs, so reusing those structs keeps field names in lockstep.
func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func handleInfo(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, schemas.HistorianInfo{Version: "8.2.0", APIVersion: "1.0"})
}

func handleCollectors(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, []schemas.Collector{collector})
}

func handleTimeseriesDatabases(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	keyword := q.Get("Keyword")
	result := []schemas.TimeseriesDatabase{}
	for _, db := range []schemas.TimeseriesDatabase{database} {
		if matchKeyword(keyword, db.UUID, db.Name) {
			result = append(result, db)
		}
	}
	writeJSON(w, result)
}

func handleMeasurements(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	keyword := q.Get("Keyword")
	databaseUUIDs := param(q, "DatabaseUUIDs")
	limit := paramInt(q, "Limit")
	if limit == 0 {
		limit = paramInt(q, "limit")
	}

	result := []schemas.Measurement{}
	for i := range measurements {
		if !matchKeyword(keyword, measurements[i].UUID, measurements[i].Name) {
			continue
		}
		if len(databaseUUIDs) > 0 && !containsUUID(databaseUUIDs, measurements[i].DatabaseUUID) {
			continue
		}
		result = append(result, measurements[i])
	}
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	writeJSON(w, result)
}

func handleMeasurementByUUID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("uuid"))
	if err != nil {
		http.Error(w, "invalid uuid", http.StatusBadRequest)
		return
	}
	measurement, ok := measurementByUUID(id)
	if !ok {
		http.Error(w, "measurement not found", http.StatusNotFound)
		return
	}
	writeJSON(w, measurement)
}

// handleAssets implements the filters used by the datasource across historian
// versions: UUIDs / Path (>=8.1 filtered asset resolution), Keyword (search),
// ParentUUIDs (>=8.2 lazy tree loading, nil UUID = root level) and the
// Include* flags that control whether the lazy-load hint fields are present.
func handleAssets(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	keyword := q.Get("Keyword")
	path := q.Get("Path")
	uuids := param(q, "UUIDs")
	parentUUIDs := param(q, "ParentUUIDs")
	includeHasChildren := paramBool(q, "IncludeHasChildren")
	includeHasAssetProperties := paramBool(q, "IncludeHasAssetProperties")

	result := []schemas.Asset{}
	allAssets := assets()
	for i := range allAssets {
		asset := allAssets[i]
		if !matchKeyword(keyword, asset.UUID, asset.Name, asset.AssetPath) {
			continue
		}
		if path != "" && !matchPath(path, asset.AssetPath) {
			continue
		}
		if len(uuids) > 0 && !containsUUID(uuids, asset.UUID) {
			continue
		}
		if len(parentUUIDs) > 0 {
			parent := uuid.Nil
			if asset.ParentUUID != nil {
				parent = *asset.ParentUUID
			}
			if !containsUUID(parentUUIDs, parent) {
				continue
			}
		}
		if !includeHasChildren {
			asset.HasChildren = nil
		}
		if !includeHasAssetProperties {
			asset.HasAssetProperties = nil
		}
		result = append(result, asset)
	}
	writeJSON(w, result)
}

func handleAssetProperties(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	assetUUIDs := param(q, "AssetUUIDs")

	result := []schemas.AssetProperty{}
	for _, property := range assetProperties {
		if len(assetUUIDs) > 0 && !containsUUID(assetUUIDs, property.AssetUUID) {
			continue
		}
		result = append(result, property)
	}
	writeJSON(w, result)
}

func handleEventTypes(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	keyword := q.Get("Keyword")
	uuids := param(q, "UUIDs")

	result := []schemas.EventType{}
	for _, eventType := range eventTypes {
		if !matchKeyword(keyword, eventType.UUID, eventType.Name) {
			continue
		}
		if len(uuids) > 0 && !containsUUID(uuids, eventType.UUID) {
			continue
		}
		result = append(result, eventType)
	}
	writeJSON(w, result)
}

func handleEventTypeProperties(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	eventTypeUUIDs := param(q, "EventTypeUUIDs")
	types := param(q, "Types")

	result := []schemas.EventTypeProperty{}
	for _, property := range eventTypeProperties {
		if len(eventTypeUUIDs) > 0 && !containsUUID(eventTypeUUIDs, property.EventTypeUUID) {
			continue
		}
		if len(types) > 0 && !slices.Contains(types, string(property.Type)) {
			continue
		}
		result = append(result, property)
	}
	writeJSON(w, result)
}

func handleEventConfigurations(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, eventConfigurations)
}
