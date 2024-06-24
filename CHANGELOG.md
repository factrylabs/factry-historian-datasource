# Changelog

## v2.0.1

- Pass datasource request context to the historian client
- Automatic instance management for data source
- Removed pprof code

## v2.0.0

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
