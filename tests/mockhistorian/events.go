package main

import (
	"fmt"
	"net/http"
	"slices"
	"sort"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
)

// handleEvents implements GET /api/events for the form-encoded
// schemas.EventFilter the backend sends. Events are generated relative to the
// requested [StartTime, StopTime] window so they always land inside the
// dashboard's time range.
func handleEvents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	end := time.Now().UTC()
	if t, ok := paramTime(q, "StopTime"); ok {
		end = t
	}
	start := end.Add(-6 * time.Hour)
	if t, ok := paramTime(q, "StartTime"); ok {
		start = t
	}
	if !end.After(start) {
		end = start.Add(time.Hour)
	}

	assetUUIDs := param(q, "AssetUUIDs")
	eventTypeUUIDs := param(q, "EventTypeUUIDs")
	statuses := param(q, "Status")
	limit := paramInt(q, "Limit")
	ascending := paramBool(q, "Ascending")

	result := []schemas.Event{}
	events := eventsInRange(start, end)
	for i := range events {
		if len(assetUUIDs) > 0 && !containsUUID(assetUUIDs, events[i].AssetUUID) {
			continue
		}
		if len(eventTypeUUIDs) > 0 && !containsUUID(eventTypeUUIDs, events[i].EventTypeUUID) {
			continue
		}
		if len(statuses) > 0 && !slices.Contains(statuses, string(events[i].Status)) {
			continue
		}
		if !matchesPropertyFilters(q, &events[i]) {
			continue
		}
		result = append(result, events[i])
	}

	sort.Slice(result, func(i, j int) bool {
		if ascending {
			return result[i].StartTime.Before(result[j].StartTime)
		}
		return result[i].StartTime.After(result[j].StartTime)
	})
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	writeJSON(w, result)
}

// matchesPropertyFilters applies the PropertyFilter[i].* query parameters.
// Only the operators the e2e suite exercises are implemented; unknown
// operators match everything so new UI options degrade gracefully.
func matchesPropertyFilters(q map[string][]string, event *schemas.Event) bool {
	values := func(key string) []string {
		if v, ok := q[key]; ok {
			return v
		}
		return nil
	}

	for i := 0; ; i++ {
		prefix := fmt.Sprintf("PropertyFilter[%d]", i)
		property := values(prefix + ".Property")
		if property == nil {
			return true
		}
		operator := ""
		if op := values(prefix + ".Operator"); len(op) > 0 {
			operator = op[0]
		}
		filterValues := values(prefix + ".Value")
		if indexed := values(prefix + ".Value[0]"); indexed != nil {
			filterValues = indexed
		}

		var actual any
		if event.Properties != nil {
			actual = event.Properties.Properties[property[0]]
		}

		switch operator {
		case "EXISTS", "IS NOT NULL":
			if actual == nil {
				return false
			}
		case "NOT EXISTS", "IS NULL":
			if actual != nil {
				return false
			}
		case "=", "==", "":
			if len(filterValues) == 0 || fmt.Sprintf("%v", actual) != filterValues[0] {
				return false
			}
		case "!=", "<>":
			if len(filterValues) == 0 || fmt.Sprintf("%v", actual) == filterValues[0] {
				return false
			}
		}
	}
}

// handleEventPropertyValues implements
// GET /api/event-type-properties/{uuid}/values: the distinct values of one
// event type property across the events in range.
func handleEventPropertyValues(w http.ResponseWriter, r *http.Request) {
	propertyUUID, err := uuid.Parse(r.PathValue("uuid"))
	if err != nil {
		http.Error(w, "invalid uuid", http.StatusBadRequest)
		return
	}

	var propertyName string
	for _, property := range eventTypeProperties {
		if property.UUID == propertyUUID {
			propertyName = property.Name
		}
	}
	if propertyName == "" {
		http.Error(w, "event type property not found", http.StatusNotFound)
		return
	}

	q := r.URL.Query()
	end := time.Now().UTC()
	if t, ok := paramTime(q, "StopTime"); ok {
		end = t
	}
	start := end.Add(-6 * time.Hour)
	if t, ok := paramTime(q, "StartTime"); ok {
		start = t
	}

	seen := map[string]struct{}{}
	values := []any{}
	events := eventsInRange(start, end)
	for i := range events {
		if events[i].Properties == nil {
			continue
		}
		value, ok := events[i].Properties.Properties[propertyName]
		if !ok {
			continue
		}
		key := fmt.Sprintf("%v", value)
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		values = append(values, value)
	}
	writeJSON(w, values)
}
