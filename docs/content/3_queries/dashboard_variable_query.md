---
title: 'Dashboard variable query'
description: ''
draft: false
collapsible: false
weight: 14
---

## Dashboard variable query

The datasource can be used to query dashboard variables, these dashboard variables are available to use in most places in the query editor.

Available query types:

- Measurement
- Asset
- Even type
- Database
- Event type property
- Asset property
- Event property values

Most query filters can also use other dashboard variables, so for example the asset property query could use another dashboard variable of type asset.

## Measurement query

![Measurement dashboard variable query](../../images/3_queries/dashboard-variable-measurement.png 'Measurement dashboard variable query')

### Filter measurement

Filters the measurement by name, allows regular expressions(must be surrounded by '/').

### Filter by database

By default measurements from all time series databases are accessible to query, one or more databases can be selected to filter on.

### Filter datatypes

By default measurements of all datatypes are accessible to query, one or more datatypes can be selected to filter on.

## Asset query

![Asset dashboard variable query](../../images/3_queries/dashboard-variable-asset.png 'Asset dashboard variable query')

### Filter by asset path

Filters assets by asset path, allows regular expressions(must be surrounded by '/').

### Parent assets

Filter assets by (direct) parent assets, or assets without parent assets.

`Use asset path` can be toggled to use the asset path instead of the asset name when displaying the asset in the dashboard variable dropdown.

## Event type query

![Event type dashboard variable query](../../images/3_queries/dashboard-variable-event-type.png 'Event type dashboard variable query')

### Filter event type

Filters the event type by name, allows regular expressions(must be surrounded by '/').

## Database query

![Database dashboard variable query](../../images/3_queries/dashboard-variable-database.png 'Database dashboard variable query')

### Filter database

Filters the database by name, allows regular expressions(must be surrounded by '/').

## Event type property query

![Event type property dashboard variable query](../../images/3_queries/dashboard-variable-event-type-property.png 'Event type property dashboard variable query')

### Filter by event types

Select one or more event type(s) to show the properties for.

### Property types

Optionally select a property type to filter on, `simple`, `periodic` or `periodic with dimension`.

### Datatype

Select one or more datatypes to filter on, by default all datatypes are selected.

## Asset property query

![Asset property dashboard variable query](../../images/3_queries/dashboard-variable-asset-property.png 'Asset property dashboard variable query')

### Assets

Select for which asset(s) to show asset properties for.

### Filter by keyword

Filters the asset properties by name or description, allows regular expressions(must be surrounded by '/').

### Filter by datatype

Filters the asset properties by datatype, allows multiple datatypes to be selected. By default all datatypes are selected.

## Event property values query

![Event property values dashboard variable query](../../images/3_queries/dashboard-variable-event-property-values.png 'Event property values dashboard variable query')

Uses the same query editor as the [events query](./events_query.md), returns the distinct values for the selected event property of the events that match the query.
