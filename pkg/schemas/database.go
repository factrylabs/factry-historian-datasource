package schemas

import (
	"github.com/google/uuid"
)

// Collector has the fields of a collector that are used by the data source
type Collector struct {
	Name          string
	UUID          uuid.UUID
	Description   string
	CollectorType string
}

// TimeseriesDatabase has the fields of a time series database that are used by the data source
type TimeseriesDatabase struct {
	Name        string
	UUID        uuid.UUID
	Description string
}

// Measurement has the fields of a measurement that are used by the data source
type Measurement struct {
	Name          string
	UUID          uuid.UUID
	Description   string
	Datatype      string
	Status        string
	CollectorUUID uuid.UUID
	Collector     *Collector
	DatabaseUUID  uuid.UUID
	Database      *TimeseriesDatabase
	UoM           string
}

// Asset has the fields of an asset that are used by the data source
type Asset struct {
	Name        string
	UUID        uuid.UUID
	Description string
	Status      string
	ParentUUID  *uuid.UUID
	Parent      *Asset
}

// AssetMeasurement has the fields of an asset measurement that are used by the data source
type AssetMeasurement struct {
	Name            string
	UUID            uuid.UUID
	AssetUUID       uuid.UUID
	MeasurementUUID uuid.UUID
}
