# Changelog

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
