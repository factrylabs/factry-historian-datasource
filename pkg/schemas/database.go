package schemas

import (
	"github.com/google/uuid"

	historianSchemas "gitlab.com/factry/historian/historian-server.git/v5/pkg/schemas"
)

// Collector has the fields of a collector that are used by the data source
type Collector struct {
	Name          string
	UUID          uuid.UUID
	Description   string
	CollectorType string
}

// TimeseriesDatabaseType has the fields of a time series database type that are used by the data source
type TimeseriesDatabaseType struct {
	Name string
}

// TimeseriesDatabase has the fields of a time series database that are used by the data source
type TimeseriesDatabase struct {
	Name                   string
	UUID                   uuid.UUID
	Description            string
	TimeseriesDatabaseType *TimeseriesDatabaseType
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
	Attributes    historianSchemas.Attributes
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

// AssetProperty has the fields of an asset property that are used by the data source
type AssetProperty struct {
	Name            string
	UUID            uuid.UUID
	AssetUUID       uuid.UUID
	MeasurementUUID uuid.UUID
}
