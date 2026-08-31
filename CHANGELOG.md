# Changelog

> ⚠️ **Minimum supported Factry Historian version: v7.3.0.**
> Versions of this plugin from v4.0.0 onwards no longer ship compatibility code for Historian instances older than v7.3.0. Earlier Historian versions are not supported, so upgrade your Historian before updating this plugin.

## v4.0.0

released: 31/08/2026

### ⚠️ Breaking changes

- Factry Historian v7.3.0 is now the minimum supported version. Upgrade your Historian before updating the plugin.
- All filtering of assets, event types and asset properties is done by Historian. The plugin no longer falls back to fetching everything and filtering it itself, which only older Historian versions needed.
- Features that were hidden on older Historian versions are now always available: datatype filters, value filters, the regex, `IN`, `IS NULL` and duration event property filters, periodic-with-dimension property types, the time-weighted average aggregation, the event property values variable query and the asset property keyword and datatype variable filters.

### Bug fixes

- Fixed UUID query parameters being encoded as byte arrays, which Historian's request validation silently dropped. Asset, event type and event configuration filters had no effect on event queries and on the event property values variable query.

### Misc

- Property lookups are skipped when the asset or event type filter matched nothing, instead of asking Historian for every property.
- Overrode `js-cookie` to 3.0.8, which resolves CVE-2026-46625 reported against the version `@grafana/data` pulls in.
- Expanded the end-to-end test suite to cover every editor, and added coverage reporting.

## v3.3.0

released: 11/08/2026

### Changes

- The asset tree cascader loads nodes on demand instead of fetching the whole tree up front, which keeps the asset pickers responsive on large trees. Requires Historian v8.2.0 or later; earlier versions keep loading the tree eagerly.
- Requests to the Historian API identify themselves with a `User-Agent` of `factry-historian-datasource/<version>`.
- Historian failures are reported to Grafana as downstream errors carrying their original status code, so a 429 or a 504 is no longer attributed to the plugin.

### Bug fixes

- Fixed regex input disappearing in every field that accepts a regex.
- Fixed the event property pickers offering parent properties that cannot match when the event type is selected through a template variable, and fixed the parent property datatype falling back to number in that case, which made the query fail.
- Fixed template variables not being interpolated in event query options, event filter statuses and asset properties.
- Fixed a template variable that resolves to an empty value being sent as an empty query parameter, which Historian v8.2 and later reject. The filter is left out of the request instead, matching the behaviour before v8.2 tightened validation.
- Fixed a chained variable listing every measurement, asset property or event type property when its parent variable resolved to an empty value, instead of listing nothing.
- Fixed asset property value parsing, and derived the asset property column type from the named value field.
- Fixed asset property values being appended twice when a query returned multiple frames.
- Fixed an event with a parent reference but no parent data failing the query.
- Fixed `Parent_StopTime` being written to the event labels instead of the periodic column labels.
- Fixed unknown event property datatypes failing instead of falling back to a nullable string column.
- Fixed duplicate asset properties in measurement selection.
- Fixed the prepended last-known point being removed from frames that never received one.
- Fixed a `seriesLimit` of zero or less being applied as a limit instead of meaning unlimited.
- Fixed the Timeout, Query timeout and Skip TLS verify settings not being applied to the Historian client.
- Fixed percent-escaped path segments being decoded when the Historian URL contains a path prefix.
- Fixed the organization field in the datasource configuration reusing the URL field's name attribute.
- Fixed tag queries using a regex operator the API does not support.
- Fixed feature detection treating an unknown Historian version as supported, and corrected pre-release version comparison.
- Hardened variable queries against unknown query types, legacy migrated property filters and filters modified in place.
- Hardened query and frame handling against empty frames, missing aggregations, a zero query interval, out-of-range periodic values and frame merges with differing field counts.

### Misc

- Added an end-to-end testing framework
- Updated dependencies

## v3.2.1

released: 11/05/2026

### Bug fixes

- Replace limit number inputs with text inputs again
- Fix max values default being set to a low value
- Prevent datasource from trying to use unsupported asset API features when connecting to older Historian versions

## v3.2.0

released: 05/05/2026

### Changes

- Added a frame format option to control the shape of frames returned by queries.
- Changed the default event annotation query to ascending order, which better handles events without a stop time.
- Batched UUID asset lookups into a single request to reduce backend load.

### Bug fixes

- Fixed the last-known point being dropped when its type differed from the result series.
- Fixed parent event asset name and path resolution when including parent info in event queries.
- Fixed asset measurement queries returning only one result when multiple properties linked to the same measurement.
- Fixed asset property names containing commas being split into separate properties, and ensured Grafana's legacy `[[var]]` multi-value syntax expands correctly.
- Fixed limit field defaults not being initialised in explore views, which caused invalid queries.
- Fixed `No parent` no longer being displayed when reloading the Asset Variable editor.

## v3.1.0

released: 22/04/2026

### Changes

- Add support for using variables in all free-form text inputs
- Change limit number inputs to combobox
- Sort frames in a query result by name to ensure consistent ordering in the frontend

### Bug fixes

- Fixed using variables in SQL expressions.

### Misc

- Updated dependencies to address security vulnerabilities.
- Added frontend unit tests and configured jest.

## v3.0.1

released: 06/03/2026

### Bug fixes

- Fixed an issue escaping special characters when calling the historian API
- Fixed the asset selection cascader only showing root level assets

## v3.0.0

released: 05/03/2026

### ⚠️ Breaking changes

- Dropped support for Grafana versions earlier than **11.0**

### Changes

- Improve handling of dimension event properties in event queries when also querying asset properties
- Added options to order time series and events queries by both ascending and descending time
- Performance improvements when editing panels with multiple queries

### Bug fixes

- Fixed regex selection for measurements not always working correctly
- Filter out UUIDs from other datasources in query displays
- Fixed possible panic in the event query
- Sort labels to ensure consistent ordering of series in the frontend

## v2.4.0

released: 17/12/2025

### Changes

- Added option to align the start of an aggregation to the start of the query interval or to the truncated aggregation interval.
- Added option to override limit filter for measurement queries in dashboard variables.
- Updated the max measurements setting for measurement queries to be unlimited if set to 0.

### Bug fixes

- Avoid duplicate columns when a parent event has the same periodic property as the child event in event queries.

## v2.3.2

released: 21/10/2025

### Bug fixes

- Fixed an issue where dashboard variables of type Event Property Values could break if the configured Event Type was also a variable.

## v2.3.1

released: 11/08/2025

### Bug fixes

- Fixed dashboard variables of type `Event Property Values` not being migrated correctly and breaking dashboards

## v2.3.0

released: 27/06/2025

:::hint{type="warning"}
Migrating from an older version to v2.3.0 has the possibility to break dashboards that have variables of type `Event Property Values`. To mitigate, upgrade to v2.3.1 or later.
:::

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

released: 22/02/2025

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

released: 18/11/2024

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

released: 26/09/2024

### Changes

- Fixed logo in the README.
- The datasource now detects the running version of the historian and adapts to the available features.
- Error messages are now more descriptive.
- Enhanced units for event duration.

### Bug Fixes

- Resolved styling issue with the dropdown cascader in the asset property query editor.
- Resolved an issue where the repeat by variable feature was malfunctioning.

## v2.0.3

released: 02/08/2024

### Changes

- Fixed filtering of event types in the event query when using a regular expression for the assets
- Fixed event queries when filtering on multiple statuses

## v2.0.2

released: 04/07/2024

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
