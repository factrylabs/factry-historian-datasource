# Grafana datasource

## Query schemas

### Query

```json
{
  "query": {}, // MeasurementQuery | AssetMeasurementQuery | RawQuery | EventQuery | LookupTableQuery
  "tabIndex": 0, // 0 | 1 | 2 | 3 | 4
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

### Lookup table query

Requires Historian v8.3.0 or newer.

`Filter` narrows the rows with a tree of conditions, on the shape the tag filters already
use. It combines its `ConditionGroups` with `Condition`, `and` or `or`, and every group is
either a leaf comparing one `Column` against `Values` with an `Operator`, or another
`Filter`, nested. The operators are `IN`, `NOT IN`, `>`, `>=`, `<`, `<=`, `IS NULL` and
`IS NOT NULL`; an absent operator reads as `IN` and an absent condition as `and`. Every
operator reads its values as "any one of", which is why there is no `=`, and a `null` among
them matches a cell that is not filled in. The orderings compare numerically, so a cell not
holding a number never matches one. `Columns` is a projection, empty meaning every column of
the table; the response keeps the table's own column order either way.

A condition that is not finished never goes on the wire: one naming no column, or holding no
values under an operator that reads values, is dropped before the request is sent, and a
filter left with no condition groups is left off entirely. The editor saves a filter row the
moment it is added, and this is what keeps a row being filled in from erroring or emptying
the panel. The cost is that an empty `Values` cannot be sent to mean "no rows": it reads as a
condition that is not finished, and the query returns the table unfiltered.

```json
{
  "LookupTable": "3b2d8b1e-6a1f-4c6e-9f2b-0a7d5a1c4e88",
  "Columns": ["line", "setpoint"],
  "Filter": {
    "Condition": "and",
    "ConditionGroups": [
      { "Column": "line", "Operator": "IN", "Values": ["L1", "L2"] },
      {
        "Filter": {
          "Condition": "or",
          "ConditionGroups": [
            { "Column": "setpoint", "Operator": ">", "Values": [20] },
            { "Column": "setpoint", "Operator": "IS NULL" }
          ]
        }
      }
    ]
  }
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

### Lookup table query

Returns a single frame named after the lookup table, with `PreferredVisualization` set to
`table` and no time field. Each selected column becomes one nullable field, named after the
column and typed by the type the Historian validates its cells against: `string` to string,
`number` to float64, `boolean` to bool. A cell that is not filled in, and a row that was
written before a column was added, both read as null.

A column holding a value its type does not allow falls back to a string field for the whole
column, rendering non-string values as the JSON they arrived as.
