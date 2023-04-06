package schemas

import (
	"time"

	"github.com/google/uuid"
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
	UUID                   uuid.UUID
	AssetUUID              uuid.UUID
	EventTypeUUID          uuid.UUID
	EventConfigurationUUID uuid.UUID
	StartTime              *time.Time
	StopTime               *time.Time
	Source                 EventSource
	Status                 EventStatus
	ParentUUID             *uuid.UUID
	Properties             *EventProperties
}

// EventFilter is used to filter events
type EventFilter struct {
	StartTime           time.Time
	StopTime            time.Time
	AssetUUIDs          []uuid.UUID
	EventTypeUUIDs      []uuid.UUID
	Status              []string
	EventConfigurations []uuid.UUID
	ExcludeManualEvents bool
	Ascending           bool
	PreloadProperties   bool
	PropertyFilter      []EventPropertyValueFilter
	Limit               int
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
