# Changelog

## v2.3.0

### Changes

- Added support for time weighted average aggregation for historian version v7.3.0 and later.

### Bug Fixes

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
