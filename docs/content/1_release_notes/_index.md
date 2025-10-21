---
title: 'Release Notes'
description: ''
draft: false
collapsible: false
weight: 1
aliases:
  - ./release-notes
---

{{< notice warning "Watch out" >}}
Always check the compatibility matrix below before installing a new version.
{{< /notice >}}

## Compatibility Matrix

This is the compatibility matrix for version listed on this page. If you have downloaded a newer version than the one listed on this page please check the release notes of that version.

| Historian Grafana Datasource Version | Compatible Factry Historian Versions |
| ------------------------------------ | ------------------------------------ |
| <= v1.2.x                            | <= v6.3.x                            |
| >= v2.x                              | > v6.3                               |

## v2.3.2

### Bug fixes

- Fixed an issue where dashboard variables of type Event Property Values could break if the configured Event Type was also a variable.

## v2.3.1

### Bug fixes

- Fixed dashboard variables of type Event Property Values not being migrated correctly and breaking dashboards

## v2.3.0

### Changes

- Changed minimum Grafana version to 10.4.0
- Added support for time weighted average aggregation for historian version v7.3.0 and later.
- If no asset properties are selected in the assets query editor or in the events query editor, the query will now return data for all asset properties instead of no asset properties
- Changed default unit for event duration column to use `dtdhms` format
- Refresh data from Factry Historian when opening a selection field instead of only on dashboard load
- Added keyword and datatype filter for asset property variable query editor
- Debounce keyword searches in variable query editors to reduce query load
- Show asset path in asset property variable query editor to help distinguish between properties on assets with the same name but different paths
- Added a configurable limit to the events query editor to limit the amount of events returned, default is 1000, 0 means no limit
- Allow to select which parent event properties to include in the result and allow to filter on them
- Added event duration filter to the event query editor, also works with parent events
- Allow use of dashboard variables in measurement regex queries
- Moved settings related to aggregations and grouped them together
- Added filtering on datatypes for measurement, asset property and event type property queries
- Added an `Override time range` option to the event query editor
- Enabled support for sql expressions
- Filter out selected event types and asset properties when changing the selected assets
- Add the option to override assets to select asset properties on in the event query editor

### Bug fixes

- Fixed multi value filter for the event property values query
- Updating the selected databases in a measurement query will now correctly update the available measurements
- Fixed the display name for raw queries
- Fixed an issue when selecting parent event properties in the event query editor
- Don't show an error if the query returns no results
- Fixed UoM not being set for asset properties in event queries
- Fixed the use of dashboard variables in event property values variable queries
- Fixed a potential panicy race condition in the query handler that could be triggered by executing multiple queries.

## v2.2.0

### Changes

- Introduced the ability to include parent event information in event queries.
- Implemented support for event property value filters compatible with v7.2.0.
- Added an option to only return changed values in measurement queries.
- Added support for event properties with dimensions in event queries.
- Description of measurements and or asset properties are now available as labels in query results.

### Bug Fixes

- Checked the validity of regular expressions before sending them to the historian.
- Fixed issues with custom interval selection in the event query.
- Fixed an issue where modifying a duplicated panel could impact the original panel.

## v2.1.0

### Bug Fixes

- Resolved issue where only one result was returned when multiple assets were queried in the asset property query.
- Corrected results for asset property queries using a regular expression.
- Ensured re-rendering after mount completion in the query editor.
- Fixed saving of Grafana variables in annotation queries.
- Addressed issue where aggregation reset to 'last' instead of clearing.

### Changes

- Enabled aggregation over the entire time period of a dashboard.
- Added variable query for distinct event property values (requires historian > v7.2.0).
- Introduced support for value filters in time series queries (requires historian > v7.1.0).

## v2.0.4

### Changes

- Fixed logo in the README.
- The datasource now detects the running version of the historian and adapts to the available features.
- Error messages are now more descriptive.
- Enhanced units for event duration.

### Bug Fixes

- Resolved styling issue with the dropdown cascader in the asset property query editor.
- Resolved an issue where the repeat by variable feature was malfunctioning.

## v2.0.3

### Changes

- Fixed filtering of event types in the event query when using a regular expression for the assets
- Fixed event queries when filtering on multiple statuses

## v2.0.2

### Changes

- Added 'first', 'last' and 'count' as aggregation options for array datatypes
- Fixed event property type selection
- Fixed broken link in the README
- Reworked introduction in the README

## v2.0.1

### Changes

- Pass datasource request context to the historian client
- Automatic instance management for data source
- Removed pprof code

## v2.0.0

### Changes

- Enabled annotations for events
- Added dashboard variable query editors for: measurement, databases, assets, asset properties, event types and event type properties
- Improved support for dashboard variables
  - Can use everywhere where it makes sense
  - Multi-value supported
- Reworked measurement selection, using a regular expression is now a toggle
- Fetch tag keys/values from the historian
- Support periodic values in the event query
- Optionally query asset properties in the event query
- Improved error handling
