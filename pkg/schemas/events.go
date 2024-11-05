package schemas

import (
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// EventSource enum for the source of an event
type EventSource string

// EventStatus enum for the status of an event
type EventStatus string

// EventSources
const (
	EventSourceManual    EventSource = "manual"
	EventSourceAutomatic EventSource = "auto"
)

// EventStatus
const (
	EventStatusProcessed  EventStatus = "processed"
	EventStatusOpen       EventStatus = "open"
	EventStatusIncomplete EventStatus = "incomplete"
)

// Event has the fields of an event that are used by the data source
type Event struct {
	StartTime              time.Time
	StopTime               *time.Time
	ParentUUID             *uuid.UUID
	Properties             *EventProperties
	Source                 EventSource
	Status                 EventStatus
	UUID                   uuid.UUID
	AssetUUID              uuid.UUID
	EventTypeUUID          uuid.UUID
	EventConfigurationUUID uuid.UUID
}

// EventFilter is used to filter events
type EventFilter struct {
	StartTime           time.Time
	StopTime            time.Time
	AssetUUIDs          []uuid.UUID
	EventTypeUUIDs      []uuid.UUID
	Status              []string
	EventConfigurations []uuid.UUID
	PropertyFilter      []EventPropertyValueFilter
	Limit               int
	ExcludeManualEvents bool
	Ascending           bool
	PreloadProperties   bool
}

// EventProperties is the database representation of event properties
type EventProperties struct {
	Properties Attributes
	EventUUID  uuid.UUID
}

// EventPropertyValueFilter us used to filter event property values
type EventPropertyValueFilter struct {
	Property  string
	Datatype  string
	Value     interface{}
	Operator  string
	Condition string
}

// EventPropertyValuesRequest is a request for event property values
type EventPropertyValuesRequest struct {
	EventQuery
	HistorianInfo
	backend.TimeRange
}

// EventPropertyValues is a list of event property values
type EventPropertyValues []interface{}
