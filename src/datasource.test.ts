import { DataSource } from './datasource'
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data'
import { TemplateSrv } from '@grafana/runtime'
import {
  EventQuery,
  HistorianDataSourceOptions,
  MeasurementQuery,
  MeasurementQueryOptions,
  Query,
  TabIndex,
} from './types'

const TEMPLATE_VARIABLE_PATTERN =
  /\$\{([_a-zA-Z][_a-zA-Z0-9]*)(?::[a-zA-Z0-9_]+)?\}|\$([_a-zA-Z][_a-zA-Z0-9]*)|\[\[([_a-zA-Z][_a-zA-Z0-9]*)(?::[a-zA-Z0-9_]+)?\]\]/
const TEMPLATE_VARIABLE_GLOBAL_RE = new RegExp(TEMPLATE_VARIABLE_PATTERN, 'g')
const TEMPLATE_VARIABLE_TEST_RE = new RegExp(TEMPLATE_VARIABLE_PATTERN)

function makeTemplateSrv(values: Record<string, string | string[]>): TemplateSrv {
  const replace = (
    value?: string,
    _scopedVars?: ScopedVars,
    formatOrFormatter?: string | ((v: string | string[]) => string)
  ): string => {
    if (value === undefined) {
      return ''
    }
    return value.replace(TEMPLATE_VARIABLE_GLOBAL_RE, (match, p1, p2, p3) => {
      const name = p1 ?? p2 ?? p3
      if (!(name in values)) {
        return match
      }
      const resolved = values[name]
      if (typeof formatOrFormatter === 'function') {
        return formatOrFormatter(resolved)
      }
      if (formatOrFormatter === 'csv') {
        return Array.isArray(resolved) ? resolved.join(',') : resolved
      }
      return Array.isArray(resolved) ? resolved.join(',') : resolved
    })
  }

  return {
    replace,
    getVariables: () => [],
    containsTemplate: (target?: string) => target !== undefined && TEMPLATE_VARIABLE_TEST_RE.test(target),
    updateTimeRange: () => {},
  } as unknown as TemplateSrv
}

function makeDataSource(templateSrv: TemplateSrv): DataSource {
  const instanceSettings = {
    id: 1,
    uid: 'test',
    type: 'historian',
    name: 'historian',
    jsonData: { defaultTab: TabIndex.Measurements } as HistorianDataSourceOptions,
    meta: { jsonData: {} },
    readOnly: false,
    access: 'proxy',
  } as unknown as DataSourceInstanceSettings<HistorianDataSourceOptions>
  return new DataSource(instanceSettings, templateSrv)
}

describe('DataSource.multiSelectReplace', () => {
  it('preserves a literal comma in an asset property name', () => {
    const ds = makeDataSource(makeTemplateSrv({}))
    expect(ds.multiSelectReplace('me:me,me')).toEqual(['me:me,me'])
  })

  it('preserves a comma inside a resolved variable value', () => {
    const ds = makeDataSource(makeTemplateSrv({ single: 'foo,bar' }))
    expect(ds.multiSelectReplace('$single')).toEqual(['foo,bar'])
  })

  it('expands a multi-value $var into multiple entries', () => {
    const ds = makeDataSource(makeTemplateSrv({ multi: ['a', 'b', 'c'] }))
    expect(ds.multiSelectReplace('$multi')).toEqual(['a', 'b', 'c'])
  })

  it('expands a multi-value [[var]] into multiple entries', () => {
    const ds = makeDataSource(makeTemplateSrv({ multi: ['a', 'b', 'c'] }))
    expect(ds.multiSelectReplace('[[multi]]')).toEqual(['a', 'b', 'c'])
  })

  it('returns [""] for undefined input', () => {
    const ds = makeDataSource(makeTemplateSrv({}))
    expect(ds.multiSelectReplace(undefined)).toEqual([''])
  })
})

describe('DataSource.containsTemplate', () => {
  const ds = makeDataSource(makeTemplateSrv({}))

  it('detects $var syntax', () => {
    expect(ds.containsTemplate('$foo')).toBe(true)
  })

  it('detects ${var} syntax', () => {
    expect(ds.containsTemplate('${foo}')).toBe(true)
  })

  it('detects [[var]] syntax', () => {
    expect(ds.containsTemplate('[[foo]]')).toBe(true)
  })

  it('returns false for plain strings', () => {
    expect(ds.containsTemplate('me:me,me')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMeasurementQuery(optionsOverrides?: Partial<MeasurementQueryOptions>): MeasurementQuery {
  return {
    IsRegex: false,
    Options: {
      IncludeLastKnownPoint: false,
      FillInitialEmptyValues: false,
      UseEngineeringSpecs: false,
      DisplayDatabaseName: false,
      DisplayDescription: false,
      MetadataAsLabels: false,
      TruncateInterval: false,
      ...optionsOverrides,
    },
  }
}

function makeQuery(overrides?: Partial<Query>): Query {
  return {
    refId: 'A',
    tabIndex: TabIndex.Measurements,
    queryType: 'MeasurementQuery',
    seriesLimit: undefined as unknown as number,
    query: makeMeasurementQuery(),
    ...overrides,
  } as Query
}

function makeEventQuery(overrides?: Partial<EventQuery>): EventQuery {
  return {
    Type: '',
    Assets: [],
    PropertyFilter: [],
    QueryAssetProperties: false,
    OverrideAssets: [],
    OverrideTimeRange: false,
    TimeRange: { from: '', to: '' },
    Ascending: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// applyTemplateVariables — default value tests
// ---------------------------------------------------------------------------

describe('DataSource.applyTemplateVariables', () => {
  describe('seriesLimit', () => {
    it('defaults to 50 when seriesLimit is undefined', () => {
      const ds = makeDataSource(makeTemplateSrv({}))
      const result = ds.applyTemplateVariables(makeQuery({ seriesLimit: undefined as unknown as number }), {})
      expect(result.seriesLimit).toBe(50)
    })

    it('keeps an explicit numeric seriesLimit unchanged', () => {
      const ds = makeDataSource(makeTemplateSrv({}))
      const result = ds.applyTemplateVariables(makeQuery({ seriesLimit: 100 }), {})
      expect(result.seriesLimit).toBe(100)
    })

    it('resolves a variable string to a number', () => {
      const ds = makeDataSource(makeTemplateSrv({ limit: '25' }))
      const result = ds.applyTemplateVariables(makeQuery({ seriesLimit: '$limit' }), {})
      expect(result.seriesLimit).toBe(25)
    })

    it('falls back to 50 when a variable resolves to a non-numeric string', () => {
      const ds = makeDataSource(makeTemplateSrv({ limit: 'bad' }))
      const result = ds.applyTemplateVariables(makeQuery({ seriesLimit: '$limit' }), {})
      expect(result.seriesLimit).toBe(50)
    })
  })

  describe('options.Limit (MeasurementQuery / AssetMeasurementQuery)', () => {
    it('defaults to 0 when options.Limit is undefined', () => {
      const ds = makeDataSource(makeTemplateSrv({}))
      const query = makeQuery({ query: makeMeasurementQuery({ Limit: undefined }) })
      const result = ds.applyTemplateVariables(query, {}) as Query
      expect((result.query as MeasurementQuery).Options.Limit).toBe(0)
    })

    it('keeps an explicit numeric options.Limit unchanged', () => {
      const ds = makeDataSource(makeTemplateSrv({}))
      const query = makeQuery({ query: makeMeasurementQuery({ Limit: 200 }) })
      const result = ds.applyTemplateVariables(query, {}) as Query
      expect((result.query as MeasurementQuery).Options.Limit).toBe(200)
    })

    it('resolves a variable string in options.Limit to a number', () => {
      const ds = makeDataSource(makeTemplateSrv({ lim: '75' }))
      const query = makeQuery({ query: makeMeasurementQuery({ Limit: '$lim' }) })
      const result = ds.applyTemplateVariables(query, {}) as Query
      expect((result.query as MeasurementQuery).Options.Limit).toBe(75)
    })

    it('falls back to 0 when a variable resolves to a non-numeric string', () => {
      const ds = makeDataSource(makeTemplateSrv({ lim: 'bad' }))
      const query = makeQuery({ query: makeMeasurementQuery({ Limit: '$lim' }) })
      const result = ds.applyTemplateVariables(query, {}) as Query
      expect((result.query as MeasurementQuery).Options.Limit).toBe(0)
    })
  })

  describe('eventQuery.Limit', () => {
    it('defaults to 500 when eventQuery.Limit is undefined', () => {
      const ds = makeDataSource(makeTemplateSrv({}))
      const query = makeQuery({
        queryType: 'EventQuery',
        tabIndex: TabIndex.Events,
        query: makeEventQuery({ Limit: undefined }),
      })
      const result = ds.applyTemplateVariables(query, {}) as Query
      expect((result.query as EventQuery).Limit).toBe(500)
    })

    it('keeps an explicit numeric eventQuery.Limit unchanged', () => {
      const ds = makeDataSource(makeTemplateSrv({}))
      const query = makeQuery({
        queryType: 'EventQuery',
        tabIndex: TabIndex.Events,
        query: makeEventQuery({ Limit: 1000 }),
      })
      const result = ds.applyTemplateVariables(query, {}) as Query
      expect((result.query as EventQuery).Limit).toBe(1000)
    })

    it('resolves a variable string in eventQuery.Limit to a number', () => {
      const ds = makeDataSource(makeTemplateSrv({ elim: '250' }))
      const query = makeQuery({
        queryType: 'EventQuery',
        tabIndex: TabIndex.Events,
        query: makeEventQuery({ Limit: '$elim' }),
      })
      const result = ds.applyTemplateVariables(query, {}) as Query
      expect((result.query as EventQuery).Limit).toBe(250)
    })

    it('falls back to 500 when a variable resolves to a non-numeric string', () => {
      const ds = makeDataSource(makeTemplateSrv({ elim: 'bad' }))
      const query = makeQuery({
        queryType: 'EventQuery',
        tabIndex: TabIndex.Events,
        query: makeEventQuery({ Limit: '$elim' }),
      })
      const result = ds.applyTemplateVariables(query, {}) as Query
      expect((result.query as EventQuery).Limit).toBe(500)
    })
  })
})

describe('DataSource.applyTemplateVariables interpolates event query Options', () => {
  it('replaces variables in Tags, ValueFilters and Aggregation of an event query', () => {
    const ds = makeDataSource(makeTemplateSrv({ status: 'Good', threshold: '42', period: '1m' }))
    const target: Query = {
      refId: 'A',
      queryType: 'EventQuery',
      query: makeEventQuery({
        QueryAssetProperties: true,
        Options: {
          Tags: { status: '$status' },
          ValueFilters: [{ Value: '$threshold', Operator: '>', Condition: 'AND' }],
          Aggregation: { Name: 'mean', Period: '$period' },
          GroupBy: [],
          IncludeLastKnownPoint: false,
          FillInitialEmptyValues: false,
          UseEngineeringSpecs: false,
          DisplayDatabaseName: false,
          DisplayDescription: false,
          MetadataAsLabels: false,
          TruncateInterval: false,
        },
      } as Partial<EventQuery>),
    } as Query

    const result = ds.applyTemplateVariables(target, {})
    const eventQuery = result.query as EventQuery

    expect(eventQuery.Options?.Tags).toEqual({ status: 'Good' })
    expect(eventQuery.Options?.ValueFilters?.[0].Value).toBe('42')
    expect(eventQuery.Options?.Aggregation?.Period).toBe('1m')
  })
})

describe('DataSource.applyTemplateVariables tolerates a missing AssetProperties', () => {
  it('does not throw for an asset measurement query without AssetProperties', () => {
    const ds = makeDataSource(makeTemplateSrv({}))
    const target = {
      refId: 'A',
      queryType: 'AssetMeasurementQuery',
      query: {
        Assets: ['asset-uuid'],
        // AssetProperties deliberately missing (old/hand-edited dashboard JSON)
        Options: { GroupBy: [], Tags: {} },
      },
    } as unknown as Query

    expect(() => ds.applyTemplateVariables(target, {})).not.toThrow()
  })
})

describe('DataSource.filterQuery rejects targets without a queryType', () => {
  it('filters out a target that has no queryType', () => {
    const ds = makeDataSource(makeTemplateSrv({}))
    const target = { refId: 'A', query: makeEventQuery() } as unknown as Query
    expect(ds.filterQuery(target)).toBe(false)
  })
})

describe('DataSource.applyTemplateVariables seriesLimit falls back on an empty variable', () => {
  it('uses the default seriesLimit when the variable resolves to ""', () => {
    const ds = makeDataSource(makeTemplateSrv({ lim: '' }))
    const target = {
      refId: 'A',
      queryType: 'EventQuery',
      seriesLimit: '$lim',
      query: makeEventQuery(),
    } as unknown as Query

    const result = ds.applyTemplateVariables(target, {})
    expect(result.seriesLimit).toBe(50)
  })
})

// Historian >= 8.2 validates query parameters against its OpenAPI spec and
// rejects an empty value with 400 'empty value is not allowed'. A dashboard
// variable that resolves to "" (an unset variable, or a chained variable whose
// query returned no options) makes multiSelectReplace return [''], which
// grafana serializes as 'X='. Such an entry must be dropped before the request
// is built.
describe('DataSource resource filters drop values from empty variables', () => {
  function makeCapturingDataSource(values: Record<string, string | string[]>): {
    ds: DataSource
    params: () => Record<string, unknown>
  } {
    const ds = makeDataSource(makeTemplateSrv(values))
    let captured: Record<string, unknown> = {}
    ;(ds as unknown as { getResource: (path: string, params?: Record<string, unknown>) => Promise<unknown> }).getResource =
      (_path: string, params?: Record<string, unknown>) => {
        captured = params ?? {}
        return Promise.resolve([])
      }
    return { ds, params: () => captured }
  }

  it('omits DatabaseUUIDs from a measurement filter when the variable resolves to ""', async () => {
    const { ds, params } = makeCapturingDataSource({ db: '' })
    await ds.getMeasurements({ Keyword: 'pump', DatabaseUUIDs: ['$db'], ScopedVars: {} }, { Limit: 100, Page: 1 })
    expect(params().DatabaseUUIDs).toBeUndefined()
  })

  it('keeps the resolved DatabaseUUIDs of a variable that has a value', async () => {
    const { ds, params } = makeCapturingDataSource({ db: 'db-uuid' })
    await ds.getMeasurements({ Keyword: 'pump', DatabaseUUIDs: ['$db'], ScopedVars: {} }, { Limit: 100, Page: 1 })
    expect(params().DatabaseUUIDs).toEqual(['db-uuid'])
  })

  it('omits AssetUUIDs from an asset property filter when the variable resolves to ""', async () => {
    const { ds, params } = makeCapturingDataSource({ asset: '' })
    await ds.getAssetProperties({ AssetUUIDs: ['$asset'], ScopedVars: {} })
    expect(params().AssetUUIDs).toBeUndefined()
  })

  it('keeps the resolved AssetUUIDs of a variable that has a value', async () => {
    const { ds, params } = makeCapturingDataSource({ asset: 'asset-uuid' })
    await ds.getAssetProperties({ AssetUUIDs: ['$asset'], ScopedVars: {} })
    expect(params().AssetUUIDs).toEqual(['asset-uuid'])
  })

  it('omits EventTypeUUIDs from an event type property filter when the variable resolves to ""', async () => {
    const { ds, params } = makeCapturingDataSource({ etype: '' })
    await ds.getEventTypeProperties({ EventTypeUUIDs: ['$etype'], ScopedVars: {} })
    expect(params().EventTypeUUIDs).toBeUndefined()
  })

  it('keeps the resolved EventTypeUUIDs of a variable that has a value', async () => {
    const { ds, params } = makeCapturingDataSource({ etype: 'event-type-uuid' })
    await ds.getEventTypeProperties({ EventTypeUUIDs: ['$etype'], ScopedVars: {} })
    expect(params().EventTypeUUIDs).toEqual(['event-type-uuid'])
  })
})
