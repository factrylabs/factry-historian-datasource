import {
  debouncePromise,
  getAggregations,
  getAggregationsForDatatypes,
  getAggregationsForVersionAndDatatypes,
  matchedAssets,
  migrateMeasurementQuery,
  propertyFilterToQueryTags,
  selectable,
  sortByLabel,
  sortByName,
  tagsToQueryTags,
  valueFiltersToQueryTags,
} from './util'
import { AggregationName, Asset, MeasurementQuery } from 'types'

describe('selectable', () => {
  const store = [
    { label: 'Alpha', value: 'alpha' },
    { label: 'Beta', value: 'beta' },
  ]

  it('returns matching item', () => {
    const result = selectable(store, 'alpha')
    expect(result).toEqual([{ label: 'Alpha', value: 'alpha' }])
  })

  it('returns empty array when value not found', () => {
    expect(selectable(store, 'gamma')).toEqual([])
  })

  it('returns empty object when value is undefined', () => {
    expect(selectable(store, undefined)).toEqual({})
  })
})

describe('getAggregations', () => {
  it('returns all AggregationName values', () => {
    const result = getAggregations()
    const expectedValues = Object.values(AggregationName)
    expect(result.map((r) => r.value)).toEqual(expect.arrayContaining(expectedValues))
    expect(result).toHaveLength(expectedValues.length)
  })

  it('each entry has label and value', () => {
    const result = getAggregations()
    result.forEach((r) => {
      expect(r.label).toBeDefined()
      expect(r.value).toBeDefined()
    })
  })
})

describe('getAggregationsForDatatypes', () => {
  it('returns all aggregations for number datatype', () => {
    const result = getAggregationsForDatatypes(['number'])
    const values = result.map((r) => r.value)
    expect(values).toContain('mean')
    expect(values).toContain('sum')
    expect(values).toContain('count')
  })

  it('returns limited aggregations for string datatype', () => {
    const result = getAggregationsForDatatypes(['string'])
    const values = result.map((r) => r.value)
    expect(values).toContain('count')
    expect(values).toContain('first')
    expect(values).toContain('last')
    expect(values).toContain('mode')
    expect(values).not.toContain('mean')
    expect(values).not.toContain('sum')
  })

  it('returns limited aggregations for boolean datatype', () => {
    const result = getAggregationsForDatatypes(['boolean'])
    const values = result.map((r) => r.value)
    expect(values).toContain('count')
    expect(values).toContain('min')
    expect(values).toContain('max')
    expect(values).not.toContain('mean')
  })

  it('returns limited aggregations for array datatype', () => {
    const result = getAggregationsForDatatypes(['[]number'])
    const values = result.map((r) => r.value)
    expect(values).toContain('count')
    expect(values).toContain('first')
    expect(values).toContain('last')
    expect(values).not.toContain('mean')
  })

  it('returns all aggregations when datatypes is empty', () => {
    const all = getAggregations()
    const result = getAggregationsForDatatypes([])
    expect(result).toHaveLength(all.length)
  })
})

describe('getAggregationsForVersionAndDatatypes', () => {
  it('excludes twa for versions before 7.3.0', () => {
    const result = getAggregationsForVersionAndDatatypes([], '7.2.0')
    expect(result.map((r) => r.value)).not.toContain('twa')
  })

  it('includes twa for version 7.3.0', () => {
    const result = getAggregationsForVersionAndDatatypes([], '7.3.0')
    expect(result.map((r) => r.value)).toContain('twa')
  })

  it('includes twa for versions after 7.3.0', () => {
    const result = getAggregationsForVersionAndDatatypes([], '8.0.0')
    expect(result.map((r) => r.value)).toContain('twa')
  })
})

describe('tagsToQueryTags', () => {
  it('converts attributes to query tags', () => {
    const result = tagsToQueryTags({ status: 'Good', region: 'EU' })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ key: 'status', value: 'Good', condition: 'AND', operator: '=' })
  })

  it('returns empty array for undefined', () => {
    expect(tagsToQueryTags(undefined)).toEqual([])
  })

  it('returns empty array for empty object', () => {
    expect(tagsToQueryTags({})).toEqual([])
  })
})

describe('valueFiltersToQueryTags', () => {
  it('converts value filters to query tags', () => {
    const result = valueFiltersToQueryTags([
      { Value: 42, Operator: '>', Condition: 'AND' },
      { Value: 100, Operator: '<', Condition: 'OR' },
    ])
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ key: 'value', value: '42', operator: '>', condition: 'AND' })
    expect(result[1]).toMatchObject({ key: 'value', value: '100', operator: '<', condition: 'OR' })
  })

  it('returns empty array for empty input', () => {
    expect(valueFiltersToQueryTags([])).toEqual([])
  })
})

describe('propertyFilterToQueryTags', () => {
  it('converts property filters to query tags', () => {
    const result = propertyFilterToQueryTags([
      { Property: 'severity', Datatype: 'string', Value: 'High', Operator: '=', Condition: 'AND', Parent: false },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ key: 'severity', value: 'High', operator: '=', condition: 'AND' })
  })

  it('handles undefined value as empty string', () => {
    const result = propertyFilterToQueryTags([
      { Property: 'severity', Datatype: 'string', Value: undefined, Operator: '=', Condition: 'AND', Parent: false },
    ])
    expect(result[0].value).toBe('')
  })

  it('returns empty array for empty input', () => {
    expect(propertyFilterToQueryTags([])).toEqual([])
  })
})

describe('matchedAssets', () => {
  const assets: Asset[] = [
    { Name: 'Pump-01', UUID: 'uuid-1', Description: '', Status: 'active', AssetPath: '/factory/Pump-01' },
    { Name: 'Pump-02', UUID: 'uuid-2', Description: '', Status: 'active', AssetPath: '/factory/Pump-02' },
    { Name: 'Motor-A', UUID: 'uuid-3', Description: '', Status: 'active', AssetPath: '/factory/Motor-A' },
  ]

  it('matches by UUID', () => {
    const result = matchedAssets(['uuid-1'], assets)
    expect(result).toHaveLength(1)
    expect(result[0].UUID).toBe('uuid-1')
  })

  it('matches by regex against AssetPath', () => {
    const result = matchedAssets(['/Pump.*/'], assets)
    expect(result).toHaveLength(2)
  })

  it('matches by regex against Name when AssetPath is absent', () => {
    const assetsNoPath: Asset[] = [
      { Name: 'Sensor-1', UUID: 'uuid-4', Description: '', Status: 'active' },
      { Name: 'Valve-1', UUID: 'uuid-5', Description: '', Status: 'active' },
    ]
    const result = matchedAssets(['/Sensor.*/'], assetsNoPath)
    expect(result).toHaveLength(1)
    expect(result[0].UUID).toBe('uuid-4')
  })

  it('returns empty array when selectedAssets is empty', () => {
    expect(matchedAssets([], assets)).toEqual([])
  })

  it('returns empty array when no match found', () => {
    expect(matchedAssets(['uuid-999'], assets)).toEqual([])
  })

  it('handles invalid regex gracefully (no match)', () => {
    const result = matchedAssets(['/[invalid/'], assets)
    expect(result).toEqual([])
  })
})

describe('sortByLabel', () => {
  it('sorts alphabetically ascending', () => {
    const items = [{ label: 'Zebra' }, { label: 'Apple' }, { label: 'Mango' }]
    const sorted = [...items].sort(sortByLabel)
    expect(sorted.map((i) => i.label)).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  it('is case-insensitive', () => {
    const items = [{ label: 'b' }, { label: 'A' }]
    const sorted = [...items].sort(sortByLabel)
    expect(sorted.map((i) => i.label)).toEqual(['A', 'b'])
  })

  it('returns 0 when labels are missing', () => {
    expect(sortByLabel({}, {})).toBe(0)
  })
})

describe('sortByName', () => {
  it('sorts alphabetically ascending', () => {
    const items = [{ Name: 'Zebra' }, { Name: 'Apple' }, { Name: 'Mango' }]
    const sorted = [...items].sort(sortByName)
    expect(sorted.map((i) => i.Name)).toEqual(['Apple', 'Mango', 'Zebra'])
  })
})

describe('migrateMeasurementQuery', () => {
  it('does not mutate a query without regex measurements', () => {
    const query: MeasurementQuery = {
      IsRegex: false,
      Measurements: ['uuid-1', 'uuid-2'],
      Options: {} as any,
    }
    const result = migrateMeasurementQuery(query)
    expect(result.IsRegex).toBe(false)
    expect(result.Measurements).toEqual(['uuid-1', 'uuid-2'])
  })

  it('migrates regex-formatted measurement to Regex field', () => {
    const query: MeasurementQuery = {
      IsRegex: false,
      Measurements: ['/sensor-.*/'],
      Options: {} as any,
    }
    const result = migrateMeasurementQuery(query)
    // The source sets IsRegex on the original query object (mutation), returns a shallow clone
    expect(query.IsRegex).toBe(true)
    expect(query.Regex).toBe('sensor-.*')
    expect(query.Measurements).toEqual([])
  })
})

describe('debouncePromise', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('delays function execution by the specified wait time', async () => {
    const fn = jest.fn().mockResolvedValue('result')
    const debounced = debouncePromise(fn, 200)

    const promise = debounced('arg')
    expect(fn).not.toHaveBeenCalled()

    jest.advanceTimersByTime(200)
    const result = await promise
    expect(fn).toHaveBeenCalledWith('arg')
    expect(result).toBe('result')
  })

  it('only calls the function once for multiple rapid calls', async () => {
    const fn = jest.fn().mockResolvedValue('result')
    const debounced = debouncePromise(fn, 200)

    debounced('a')
    debounced('b')
    const promise = debounced('c')

    jest.advanceTimersByTime(200)
    await promise

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('all callers during debounce window receive the same resolved value', async () => {
    const fn = jest.fn().mockResolvedValue('shared')
    const debounced = debouncePromise(fn, 200)

    const p1 = debounced('x')
    const p2 = debounced('x')
    const p3 = debounced('x')

    jest.advanceTimersByTime(200)
    const results = await Promise.all([p1, p2, p3])
    expect(results).toEqual(['shared', 'shared', 'shared'])
  })
})
