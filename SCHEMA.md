# Grafana datasource

## Query schemas

### Query

```json
{
  "query": {}, // MeasurementQuery | AssetMeasurementQuery | RawQuery | EventQuery
  "tabIndex": 0, // 0 | 1 | 2 | 3
  "selectedAssetPath": "", // for backwards compatibility
  "selectedAssetProperties": "" // for backwards compatibility
}
```

### Measurement query

```json
{
  "Database": "", // kept for backwards compatibility
  "Databases": [], // array of database uuids / dashboard variables
  "IsRegex": false,
  "Regex": "", // regex without slashes
  "Measurement": "", // kept for backwards compatibility
  "Measurements": [], // array of measurement uuids / dashboard variables
  // measurement query options
  "Options": {
    // ...
  }
}
```

### Asset measurement query

```json
{
  "Assets": [], // array of asset uuids / asset regex / dashboards variables
  "AssetProperties": [], // array of asset property names
  // measurement query options
  "Options": {
    // ...
  }
}
```

### Event query

```json
{
  "Type": "simple", // simple | periodic
  "Assets": [], // array of asset uuids / asset regex / dashboards variables
  "EventTypes": [], // array of event type uuids / dashboard variables
  "Statuses": [],
  "Properties": [], // array of property names
  "PropertyFilter": [
    {
      "Property": "", // name of the property
      "Datatype": "", // datatype of the property
      "Value": "", // string | number | boolean
      "Operator": "", // < | > | <= | >= | = | !=
      "Condition": "" // AND | OR
    }
  ],
  "QueryAssetProperties": false,
  "AssetProperties": [],
  // measurement query options
  "Options": {
    // ...
  }
}
```

### Raw query

```json
{
  "TimeseriesDatabase": "",
  "Query": ""
}
```

### Measurement query options

```json
{
  "Tags": {
    "status": "Good"
  },
  "GroupBy": ["status"],
  "Aggregation": {
    "Name": "mean",
    "Period": "$__interval", // or something like 10s
    "Arguments": [],
    "Fill": "" // influx fill options
  },
  "IncludeLastKnownPoint": false,
  "FillInitialEmptyValues": false,
  "UseEngineeringSpecs": true,
  "DisplayDatabaseName": false,
  "DisplayDescription": false
}
```

## Query responses

### Measurement query

Returns (aggregated) timeseries data for one or more measurements with each measurement in a separate series.

The name of the frame includes:

- name of the measurement
- measurement tag/value pair used in 'group by'
- optionally the description
- optionally the database name

### Asset measurement query

Returns (aggregated) timeseries data for one or more asset properties with each asset property corresponding to a measurement and in a separate series.

The name of the frame includes:

- the asset path
- the property name
- measurement tag/value pair used in 'group by'
- optionally the description
- optionally the database name

### Event query

#### Simple query

Returns simple event info and properties in a format usable for the table panel.

- EventUUID
- EventParentUUID
- AssetUUID
- EventTypeUUID
- Asset (name)
- AssetPath
- EventType
- StartTime
- StopTime
- Duration
- ... (properties)

The name of the frame is the name of the event type

#### Periodic query

Returns periodic event properties in a format usable for the trends panel in a single frame.

- offset (in seconds)
- periodic property
  - name => {event uuid}
  - labels:
    - Asset (name)
    - AssetPath
    - AssetUUID
    - EventType (name)
    - EventTypeUUID
    - EventUUID
    - Property (name)
    - StartTime
    - StopTime
    - ... {simple properties name and value}

### Raw query

Returns the raw timeseries response using the grafana frames format.
