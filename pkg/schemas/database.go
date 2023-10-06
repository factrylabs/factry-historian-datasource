package schemas

import (
	"github.com/google/uuid"
)

// Collector has the fields of a collector that are used by the data source
type Collector struct {
	Name          string
	Description   string
	CollectorType string
	UUID          uuid.UUID
}

// TimeseriesDatabaseType has the fields of a time series database type that are used by the data source
type TimeseriesDatabaseType struct {
	Name string
}

// TimeseriesDatabase has the fields of a time series database that are used by the data source
type TimeseriesDatabase struct {
	TimeseriesDatabaseType *TimeseriesDatabaseType
	Name                   string
	Description            string
	UUID                   uuid.UUID
}

// Measurement has the fields of a measurement that are used by the data source
type Measurement struct {
	Collector     *Collector
	Database      *TimeseriesDatabase
	Attributes    Attributes
	Name          string
	Description   string
	Datatype      string
	Status        string
	UUID          uuid.UUID
	CollectorUUID uuid.UUID
	DatabaseUUID  uuid.UUID
}

// Asset has the fields of an asset that are used by the data source
type Asset struct {
	ParentUUID  *uuid.UUID
	Parent      *Asset
	Name        string
	Description string
	Status      string
	AssetPath   string
	UUID        uuid.UUID
}

// AssetProperty has the fields of an asset property that are used by the data source
type AssetProperty struct {
	Name            string
	UUID            uuid.UUID
	AssetUUID       uuid.UUID
	MeasurementUUID uuid.UUID
}

// EventType has the fields of an event type that are used by the data source
type EventType struct {
	Name        string
	Description string
	Properties  []EventTypeProperty
	UUID        uuid.UUID
}

// PropertyDatatype enum for the event type property datatype
type PropertyDatatype string

// PropertyType enum for the event type property type
type PropertyType string

// The order determines how EventTypePropertyDatatype gets sorted
const (
	EventTypePropertyDatatypeNumber PropertyDatatype = "number"
	EventTypePropertyDatatypeBool   PropertyDatatype = "boolean"
	EventTypePropertyDatatypeString PropertyDatatype = "string"
)

// The order determines how EventTypePropertyType gets sorted
const (
	EventTypePropertyTypeSimple   PropertyType = "simple"
	EventTypePropertyTypePeriodic PropertyType = "periodic"
)

// EventTypeProperty has the fields of an event type property that are used by the data source
type EventTypeProperty struct {
	Name          string
	Datatype      PropertyDatatype
	Type          PropertyType
	UUID          uuid.UUID
	EventTypeUUID uuid.UUID
}

// EventConfiguration has the fields of an event configuration that are used by the data source
type EventConfiguration struct {
	Name          string
	UUID          uuid.UUID
	AssetUUID     uuid.UUID
	EventTypeUUID uuid.UUID
}
