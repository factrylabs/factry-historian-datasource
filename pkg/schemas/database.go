package schemas

import (
	"github.com/google/uuid"
)

// BaseModel has the fields of a base model that are used by the data source
type BaseModel struct {
	UUID uuid.UUID
	Name string
}

// GetUUID returns the UUID of the base model
func (m BaseModel) GetUUID() uuid.UUID {
	return m.UUID
}

// Collector has the fields of a collector that are used by the data source
type Collector struct {
	BaseModel
	Description   string
	CollectorType string
}

// TimeseriesDatabaseType has the fields of a time series database type that are used by the data source
type TimeseriesDatabaseType struct {
	Name string
}

// TimeseriesDatabase has the fields of a time series database that are used by the data source
type TimeseriesDatabase struct {
	BaseModel
	TimeseriesDatabaseType *TimeseriesDatabaseType
	Description            string
}

// Measurement has the fields of a measurement that are used by the data source
type Measurement struct {
	BaseModel
	Collector     *Collector
	Database      *TimeseriesDatabase
	Attributes    Attributes
	Description   string
	Datatype      string
	Status        string
	CollectorUUID uuid.UUID
	DatabaseUUID  uuid.UUID
}

// Asset has the fields of an asset that are used by the data source
type Asset struct {
	BaseModel
	ParentUUID  *uuid.UUID
	Parent      *Asset
	Description string
	Status      string
	AssetPath   string
}

// AssetProperty has the fields of an asset property that are used by the data source
type AssetProperty struct {
	BaseModel
	AssetUUID       uuid.UUID
	MeasurementUUID uuid.UUID
}

// EventType has the fields of an event type that are used by the data source
type EventType struct {
	BaseModel
	Description string
	Properties  []EventTypeProperty
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
	BaseModel
	Datatype      PropertyDatatype
	Type          PropertyType
	EventTypeUUID uuid.UUID
	UoM           string
}

// EventConfiguration has the fields of an event configuration that are used by the data source
type EventConfiguration struct {
	BaseModel
	AssetUUID     uuid.UUID
	EventTypeUUID uuid.UUID
}

// HistorianInfo has the fields of the historian info that are used by the data source
type HistorianInfo struct {
	Version    string
	APIVersion string
}
