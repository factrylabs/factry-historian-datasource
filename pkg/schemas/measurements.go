package schemas

import (
	"github.com/google/uuid"
)

// MeasurementFilter is used to filter measurements
type MeasurementFilter struct {
	Keyword             *string    `param:"Keyword"`
	Database            *uuid.UUID `param:"Database"`
	Collector           *uuid.UUID `param:"Collector"`
	Statuses            *[]string  `param:"Statuses"`
	WithBadQualityOnly  *bool      `param:"WithBadQualityOnly"`
	ExcludeCalculations *bool      `param:"ExcludeCalculations"`
}

type Collector struct {
	Name          string
	UUID          uuid.UUID
	Description   string
	CollectorType string
}

type TimeseriesDatabase struct {
	Name string
	UUID uuid.UUID
}

type Measurement struct {
	Name         string
	UUID         uuid.UUID
	Description  string
	Datatype     string
	Status       string
	Collector    *Collector
	DatabaseUUID uuid.UUID
	Database     *TimeseriesDatabase
	UoM          string
}
