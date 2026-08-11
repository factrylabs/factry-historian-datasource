package main

import (
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"github.com/google/uuid"
)

// Fixtures form a small deterministic "plant": one timeseries database, a
// three-level asset tree (Site \\ Line 1 \\ Motor), two asset properties
// backed by measurements, and a Batch event type configured on the Motor
// asset. UUIDs are fixed so tests can assert against them.
var (
	databaseUUID = uuid.MustParse("11111111-1111-1111-1111-111111111111")

	speedMeasurementUUID       = uuid.MustParse("22222222-2222-2222-2222-222222222222")
	temperatureMeasurementUUID = uuid.MustParse("33333333-3333-3333-3333-333333333333")

	siteAssetUUID  = uuid.MustParse("44444444-4444-4444-4444-444444444444")
	lineAssetUUID  = uuid.MustParse("55555555-5555-5555-5555-555555555555")
	motorAssetUUID = uuid.MustParse("66666666-6666-6666-6666-666666666666")

	speedPropertyUUID       = uuid.MustParse("77777777-7777-7777-7777-777777777777")
	temperaturePropertyUUID = uuid.MustParse("88888888-8888-8888-8888-888888888888")

	batchEventTypeUUID = uuid.MustParse("99999999-9999-9999-9999-999999999999")

	codePropertyUUID  = uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	goodPropertyUUID  = uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	yieldPropertyUUID = uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")

	eventConfigurationUUID = uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")

	collectorUUID = uuid.MustParse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
)

var database = schemas.TimeseriesDatabase{
	BaseModel:              schemas.BaseModel{UUID: databaseUUID, Name: "historian"},
	TimeseriesDatabaseType: &schemas.TimeseriesDatabaseType{Name: "QuestDB"},
	Description:            "Mock timeseries database for e2e tests",
}

var collector = schemas.Collector{
	BaseModel:     schemas.BaseModel{UUID: collectorUUID, Name: "e2e-collector"},
	Description:   "Mock collector for e2e tests",
	CollectorType: "OPCUA",
}

var measurements = []schemas.Measurement{
	{
		BaseModel:     schemas.BaseModel{UUID: speedMeasurementUUID, Name: "e2e.motor.speed"},
		Database:      &database,
		DatabaseUUID:  databaseUUID,
		Collector:     &collector,
		CollectorUUID: collectorUUID,
		Datatype:      "float64",
		Status:        "Good",
		Description:   "Mock motor speed for e2e tests",
	},
	{
		BaseModel:     schemas.BaseModel{UUID: temperatureMeasurementUUID, Name: "e2e.motor.temperature"},
		Database:      &database,
		DatabaseUUID:  databaseUUID,
		Collector:     &collector,
		CollectorUUID: collectorUUID,
		Datatype:      "float64",
		Status:        "Good",
		Description:   "Mock motor temperature for e2e tests",
	},
}

// tagsPerMeasurement backs the tag key/value endpoints.
var tagsPerMeasurement = map[uuid.UUID]map[string][]string{
	speedMeasurementUUID: {
		"location": {"ghent", "aalst"},
		"unit":     {"rpm"},
	},
	temperatureMeasurementUUID: {
		"location": {"ghent"},
		"unit":     {"degC"},
	},
}

// assets returns the asset tree. Built as a function (not a package var) so
// the HasChildren/HasAssetProperties pointers cannot be mutated between
// requests; the datasource only expects them when the matching Include* flag
// is set, which the handler decides per request.
func assets() []schemas.Asset {
	return []schemas.Asset{
		{
			BaseModel:          schemas.BaseModel{UUID: siteAssetUUID, Name: "Site"},
			Description:        "Mock site",
			Status:             "active",
			AssetPath:          `Site`,
			HasChildren:        new(true),
			HasAssetProperties: new(false),
		},
		{
			BaseModel:          schemas.BaseModel{UUID: lineAssetUUID, Name: "Line 1"},
			ParentUUID:         &siteAssetUUID,
			Description:        "Mock production line",
			Status:             "active",
			AssetPath:          `Site\\Line 1`,
			HasChildren:        new(true),
			HasAssetProperties: new(false),
		},
		{
			BaseModel:          schemas.BaseModel{UUID: motorAssetUUID, Name: "Motor"},
			ParentUUID:         &lineAssetUUID,
			Description:        "Mock motor asset",
			Status:             "active",
			AssetPath:          `Site\\Line 1\\Motor`,
			HasChildren:        new(false),
			HasAssetProperties: new(true),
		},
	}
}

var assetProperties = []schemas.AssetProperty{
	{
		BaseModel:       schemas.BaseModel{UUID: speedPropertyUUID, Name: "Speed"},
		AssetUUID:       motorAssetUUID,
		MeasurementUUID: speedMeasurementUUID,
	},
	{
		BaseModel:       schemas.BaseModel{UUID: temperaturePropertyUUID, Name: "Temperature"},
		AssetUUID:       motorAssetUUID,
		MeasurementUUID: temperatureMeasurementUUID,
	},
}

var eventTypeProperties = []schemas.EventTypeProperty{
	{
		BaseModel:     schemas.BaseModel{UUID: codePropertyUUID, Name: "code"},
		Datatype:      schemas.EventTypePropertyDatatypeString,
		Type:          schemas.EventTypePropertyTypeSimple,
		EventTypeUUID: batchEventTypeUUID,
	},
	{
		BaseModel:     schemas.BaseModel{UUID: goodPropertyUUID, Name: "good"},
		Datatype:      schemas.EventTypePropertyDatatypeBool,
		Type:          schemas.EventTypePropertyTypeSimple,
		EventTypeUUID: batchEventTypeUUID,
	},
	{
		BaseModel:     schemas.BaseModel{UUID: yieldPropertyUUID, Name: "yield"},
		Datatype:      schemas.EventTypePropertyDatatypeNumber,
		Type:          schemas.EventTypePropertyTypeSimple,
		EventTypeUUID: batchEventTypeUUID,
		UoM:           "%",
	},
}

var eventTypes = []schemas.EventType{
	{
		BaseModel:   schemas.BaseModel{UUID: batchEventTypeUUID, Name: "Batch"},
		Description: "Mock batch event type",
		Properties:  eventTypeProperties,
	},
}

var eventConfigurations = []schemas.EventConfiguration{
	{
		BaseModel:     schemas.BaseModel{UUID: eventConfigurationUUID, Name: "Motor batches"},
		AssetUUID:     motorAssetUUID,
		EventTypeUUID: batchEventTypeUUID,
	},
}

// eventFixture describes one deterministic event relative to the queried
// time range: offsets are fractions of the range so events always fall
// inside the dashboard's window regardless of when the test runs.
type eventFixture struct {
	uuid          uuid.UUID
	startFraction float64  // position of StartTime inside [start, end]
	stopFraction  *float64 // nil = still open
	status        schemas.EventStatus
	properties    schemas.Attributes
}

var eventFixtures = []eventFixture{
	{
		uuid:          uuid.MustParse("12121212-1212-1212-1212-121212121212"),
		startFraction: 0.10,
		stopFraction:  new(0.35),
		status:        schemas.EventStatusProcessed,
		properties:    schemas.Attributes{"code": "batch-41", "good": true, "yield": 92.5},
	},
	{
		uuid:          uuid.MustParse("13131313-1313-1313-1313-131313131313"),
		startFraction: 0.40,
		stopFraction:  new(0.70),
		status:        schemas.EventStatusProcessed,
		properties:    schemas.Attributes{"code": "batch-42", "good": false, "yield": 55.0},
	},
	{
		uuid:          uuid.MustParse("14141414-1414-1414-1414-141414141414"),
		startFraction: 0.75,
		stopFraction:  nil,
		status:        schemas.EventStatusOpen,
		properties:    schemas.Attributes{"code": "batch-43", "good": true, "yield": 88.0},
	},
}

// eventsInRange materializes the event fixtures inside [start, end].
func eventsInRange(start, end time.Time) []schemas.Event {
	span := end.Sub(start)
	events := make([]schemas.Event, 0, len(eventFixtures))
	for _, fixture := range eventFixtures {
		properties := fixture.properties
		event := schemas.Event{
			UUID:                   fixture.uuid,
			AssetUUID:              motorAssetUUID,
			EventTypeUUID:          batchEventTypeUUID,
			EventConfigurationUUID: eventConfigurationUUID,
			Source:                 schemas.EventSourceAutomatic,
			Status:                 fixture.status,
			StartTime:              start.Add(time.Duration(fixture.startFraction * float64(span))),
			Properties: &schemas.EventProperties{
				EventUUID:  fixture.uuid,
				Properties: properties,
			},
		}
		if fixture.stopFraction != nil {
			stop := start.Add(time.Duration(*fixture.stopFraction * float64(span)))
			event.StopTime = &stop
		}
		events = append(events, event)
	}
	return events
}

func measurementByUUID(id uuid.UUID) (schemas.Measurement, bool) {
	for i := range measurements {
		if measurements[i].UUID == id {
			return measurements[i], true
		}
	}
	return schemas.Measurement{}, false
}
