package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strconv"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
)

// handleEvents implements GET /api/events for the form-encoded
// schemas.EventFilter the backend sends.
func handleEvents(w http.ResponseWriter, r *http.Request) {
	writeEvents(w, r.URL.Query())
}

// handleEventQuery implements POST /api/events/query (Historian 8.2+). The
// JSON filter is converted to the GET query parameters so both routes share
// one filter implementation.
func handleEventQuery(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Filter schemas.EventFilter
		Limit  int
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeEvents(w, eventFilterValues(body.Filter, body.Limit))
}

func eventFilterValues(filter schemas.EventFilter, limit int) url.Values {
	q := url.Values{}
	if filter.StartTime != nil {
		q.Set("StartTime", filter.StartTime.Format(time.RFC3339Nano))
	}
	if filter.StopTime != nil {
		q.Set("StopTime", filter.StopTime.Format(time.RFC3339Nano))
	}
	for _, id := range filter.AssetUUIDs {
		q.Add("AssetUUIDs", id.String())
	}
	for _, id := range filter.EventTypeUUIDs {
		q.Add("EventTypeUUIDs", id.String())
	}
	q["Status"] = filter.Status
	q.Set("Limit", strconv.Itoa(limit))
	q.Set("Ascending", strconv.FormatBool(filter.Ascending))
	for i, propertyFilter := range filter.PropertyFilter {
		prefix := fmt.Sprintf("PropertyFilter[%d]", i)
		q.Set(prefix+".Property", propertyFilter.Property)
		q.Set(prefix+".Operator", propertyFilter.Operator)
		for _, value := range propertyFilter.Value {
			q.Add(prefix+".Value", fmt.Sprintf("%v", value))
		}
	}
	return q
}

// writeEvents writes the events matching the filter in q. Events are
// generated relative to the requested [StartTime, StopTime] window so they
// always land inside the dashboard's time range.
func writeEvents(w http.ResponseWriter, q url.Values) {
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
