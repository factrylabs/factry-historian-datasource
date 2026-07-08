import { dateTime } from '@grafana/data'

import { VariableSupport, DataAPI } from './variable_support'
import { EventQuery, VariableQueryType } from './types'

// Minimal DataAPI stub that captures the filter passed to the distinct
// property-value lookup and resolves $status to "Good".
function makeDataAPIStub(captured: { filter?: unknown }): DataAPI {
  return {
    getMeasurements: jest.fn().mockResolvedValue([]),
    getCollectors: jest.fn().mockResolvedValue([]),
    getTimeseriesDatabases: jest.fn().mockResolvedValue([]),
    getAssets: jest.fn().mockResolvedValue([]),
    getAssetProperties: jest.fn().mockResolvedValue([]),
    getEventTypes: jest.fn().mockResolvedValue([]),
    getEventTypeProperties: jest.fn().mockResolvedValue([]),
    getEventConfigurations: jest.fn().mockResolvedValue([]),
    getDistinctEventPropertyValues: jest.fn().mockImplementation((filter) => {
      captured.filter = filter
      return Promise.resolve([])
    }),
    multiSelectReplace: (value: string | undefined) => [value === '$status' ? 'Good' : value ?? ''],
    replace: (value: string | undefined) => (value === '$status' ? 'Good' : value ?? ''),
  }
}

function makeVariableRequest(target: Record<string, unknown>) {
  return {
    targets: [target],
    scopedVars: {},
    range: { from: dateTime('2026-01-01T00:00:00Z'), to: dateTime('2026-01-02T00:00:00Z') },
  } as never
}

function makeEventQuery(overrides?: Partial<EventQuery>): EventQuery {
  return {
    Type: 'simple',
    Assets: [],
    EventTypes: [],
    Statuses: [],
    Properties: [],
    PropertyFilter: [],
    QueryAssetProperties: false,
    ...overrides,
  } as EventQuery
}

// Every variable query branch does JSON.parse(JSON.stringify(target.filter));
// with filter undefined this is JSON.parse(undefined) -> SyntaxError. Deep-clone
// only when a filter exists so a filter-less variable query returns empty data.
describe('variable query without a filter returns empty data', () => {
  it('does not throw for a filter-less asset variable query', () => {
    const vs = new VariableSupport(makeDataAPIStub({}))
    const request = makeVariableRequest({
      refId: 'A',
      type: VariableQueryType.AssetQuery,
      valid: true,
      // filter deliberately missing (old/provisioned variable)
    })

    expect(() => vs.query(request)).not.toThrow()
  })
})

// A pre-v2.2.0 "Event property values" variable (filter with
// EventTypePropertyUUID, no PropertyFilter) is migrated to an EventFilter
// without PropertyFilter; reading `.PropertyFilter.length` behind an optional
// chain that stops at EventFilter must not throw a TypeError.
describe('PropertyValuesQuery works for migrated pre-v2.2.0 filters', () => {
  it('does not throw when the migrated filter has no PropertyFilter', () => {
    const vs = new VariableSupport(makeDataAPIStub({}))
    const request = makeVariableRequest({
      refId: 'A',
      type: VariableQueryType.PropertyValuesQuery,
      valid: true,
      filter: { EventTypePropertyUUID: 'prop-uuid' },
    })

    expect(() => vs.query(request)).not.toThrow()
  })
})

// The PropertyValuesQuery variable path interpolates Assets, EventTypes,
// Properties and PropertyFilter but must also interpolate EventFilter.Statuses,
// otherwise a $status variable is sent literally and the variable returns no
// values.
describe('PropertyValuesQuery interpolates EventFilter.Statuses', () => {
  it('resolves template variables in Statuses', () => {
    const captured: { filter?: unknown } = {}
    const vs = new VariableSupport(makeDataAPIStub(captured))
    const request = makeVariableRequest({
      refId: 'A',
      type: VariableQueryType.PropertyValuesQuery,
      valid: true,
      filter: {
        EventFilter: makeEventQuery({ Statuses: ['$status'], Properties: ['prop-uuid'] }),
      },
    })

    vs.query(request)

    const filter = captured.filter as { EventFilter?: EventQuery } | undefined
    expect(filter?.EventFilter?.Statuses).toEqual(['Good'])
  })
})
