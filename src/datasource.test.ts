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
