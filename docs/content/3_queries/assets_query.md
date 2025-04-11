---
title: 'Assets query'
description: ''
draft: false
collapsible: false
weight: 10
---

## Asset properties query

This query type is used to query measurements using the asset tree configured in Factry Historian.

## Configuring the query

![Assets query](../../images/3_queries/assets_query.png 'Assets query')

### Asset selection

There are a couple of ways to select the assets:

- Choose one asset from the cascader menu
- Enter a regular expression (must be surrounded by /)
- Use a dashboard variable

### Asset property selection

All the unique asset properties for the selected asset(s) will be available, to select them:

- Select the desired asset properties from the dropdown menu
- Use a dashboard variable

### Aggregation options

All of the aggregation options options can also be controlled with a dashboard variable.

#### Aggregation

- Select one of the available aggregations, or clear the field for raw data
- Select the aggregation period
- Optionally select a fill type  
  When a fill type is selected, the options to select 'Fill empty initial intervals' and 'Include last known point' will be available.
  - 'Fill empty initial intervals'  
    Uses the last known point to fill any initial empty intervals before the first data point in the series.  
    Does not include the actual last known point in the data, unless `Include last known point` is enabled too.
  - 'Include last known point'  
    This gives the last point before the time range of the query for the series with the `status = Good`, and the other tags that are filtered upon.
    If another status is in the current time window, the last value for that status will be fetched too.

#### Group by

Select which time series tags to group the series by, by default `status` is filled in here.

#### Filter tags

Build the tag filter, by default only data with `status` = `Good` is queried.

Limitations:

- Only the `=` operator is available
- Only `AND` is available when you have multiple tag filters

#### Max values

The maximum amount of measurements values fetched per series.

### Advanced options

![Advanced options](../../images/3_queries/advanced-options.png 'Advanced options')

#### Use engineering specs

Uses the configured engineering specs (like UoM) for the measurement linked to the asset property.

#### Display database name

Includes the database name for the measurement linked to the asset property in the label.

#### Display description

Includes the description for the measurement linked to the asset property in the label (if one is available).

#### Max Measurements

Limits the amount of measurements fetched.

Beware: measurements with no points in the configured interval also count towards the limit. These measurements are not visible, making it seem like less measurements than configured were fetched.
