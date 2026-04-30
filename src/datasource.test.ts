import { DataSource } from './datasource'
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data'
import { TemplateSrv } from '@grafana/runtime'
import { HistorianDataSourceOptions, TabIndex } from './types'

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
