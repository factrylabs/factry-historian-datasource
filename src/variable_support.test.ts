import { dateTime } from '@grafana/data'

import { VariableSupport, DataAPI } from './variable_support'
import { VariableQueryType } from './types'

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
