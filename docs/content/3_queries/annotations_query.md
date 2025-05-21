---
title: 'Annotations query'
description: ''
draft: false
collapsible: false
weight: 16
---

## Annotations event query

A simplified version of the [event query](./events_query.md) can be used to automatically create annotations for panels.

## Configuring the query

Only the `simple` query type is available here.

![Events annotations query](../../images/3_queries/events_annotations_query.png 'Events annotations query')

### Asset selection

There are a couple of ways to select the assets:

- Choose one asset from the cascader menu
- Enter a regular expression (must be surrounded by /)
- Use a dashboard variable

### Event type selection

Select the event type(s) for which you want to see the events. The event types available in the dropdown will be the event types that are configured on one of the selected assets.

A dashboard variable can also be used.

### Event properties selection

Select the event properties you want to be included in the data, only `simple` properties will be available.

A dashboard variable can also be used.

### Event status selection

By default the events are not filtered by their status, you can select one or more event statuses to include.

A dashboard variable can also be used.

### Asset property filter

The events can be filtered by the values of their `simple` properties.

- Select a property
- Select a comparison operator (=, !=, <, <=, >, =>)
- If filtering multiple properties select a logical operator (AND, OR)

### Query asset properties

If enabled, you can query asset properties on the selected asset(s), like you would do for an [assets query](./assets_query.md#configuring-the-query).

#### Asset property selection

All the unique asset properties for the selected asset(s) will be available, to select them:

- Select the desired asset properties from the dropdown menu
- Use a dashboard variable

#### Aggregation options

All of the aggregation options options can also be controlled with a dashboard variable.

##### Aggregation

Select one of the available aggregations.
