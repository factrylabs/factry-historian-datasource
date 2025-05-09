---
title: 'Measurements query'
description: ''
draft: false
collapsible: false
weight: 11
---

## Measurements query

This query type is used to query measurements directly.

## Configuring the query

![Measurements query](../../images/3_queries/measurements_query.png 'Measurements query')

### Database(s) selection

By default, measurements can be queried from all configured time series databases. One or more databases can be selected to filter on.

This can also be controlled by a dashboard variable.

### Measurement(s) selection

There are a couple of ways to select measurements:

- Search and select on or more measurements
- Use a dashboard variable (can be done in combination with manually searching and selecting measurements)

Or enable `Use regular expression` and enter a regular expression. The amount of measurements selected by the regular expression might be limited by the [measurement limit](#measurement-limit).
Dashboard variables can also be used here but it's recommended to use the `${varname}` syntax instead of `$varname` to be able to interpolate a variable in the middle of an expression.

### Aggregation options

All of the aggregation options options can also be controlled with a dashboard variable.

#### Aggregation

- Select one of the available aggregations, or clear the field for raw data
- Select the aggregation period
- Optionally select a fill type

#### Group by

Select which time series tags to group the series by, by default `status` is filled in here.

#### Filter tags

Build the tag filter, by default only data with `status` = `Good` is queried.

Limitations:

- Only the `=` operator is available
- Only `AND` is available when you have multiple tag filters

#### Limit

The maximum amount of returned data points per series.

### Advanced options

![Advanced options](../../images/3_queries/advanced-options.png 'Advanced options')

#### Include last known point

This gives the last point before the time range of the query for the series with the `status = Good`, and the other tags that are filtered upon.

If another status is in the current time window, the last value for that status will be fetched too.

#### Fill empty initial intervals

Uses the last known point to fill any initial empty intervals before the first data point in the series.

Does not include the actual last known point in the data, unless `Include last known point` is enabled too.

#### Use engineering specs

Uses the configured engineering specs (like UoM) for the selected measurement(s).

#### Display database name

Includes the database name for the selected measurement(s) in the label.

#### Display description

Includes the description for the selected measurement(s) in the label (if one is available).

#### Measurement limit

Limits the amount of measurements queried.

Beware: measurements with no points in the configured interval also count towards the limit. These measurements are not visible, making it seem like less measurements than configured were queried.
