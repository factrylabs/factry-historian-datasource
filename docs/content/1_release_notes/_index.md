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
