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

Most query filters can also use other dashboard variables, so for example the asset property query could use another dashboard variable of type asset.

## Measurement query

![Measurement dashboard variable query](../../images/3_queries/dashboard-variable-measurement.png 'Measurement dashboard variable query')

### Filter measurement

Filters the measurement by name, allows regular expressions(must be surrounded by '/').

### Filter by database

By default measurements from all time series databases are accessible to query, you can select one or more databases to filter on.

## Asset query

![Asset dashboard variable query](../../images/3_queries/dashboard-variable-asset.png 'Asset dashboard variable query')

### Filter by asset path

Filters assets by asset path, allows regular expressions(must be surrounded by '/').

### Parent assets

Filter assets by (direct) parent assets, or assets without parent assets.

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

Optionally select a property type to filter on, `simple` or `periodic`.

## Asset property query

![Asset property dashboard variable query](../../images/3_queries/dashboard-variable-asset-property.png 'Asset property dashboard variable query')

### Assets

Select for which asset(s) to show asset properties for.
