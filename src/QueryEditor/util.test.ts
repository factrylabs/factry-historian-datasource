import {
  buildLazyCascaderOptions,
  debouncePromise,
  fetchLazyChildOptions,
  getAggregations,
  getAggregationsForDatatypes,
  getAggregationsForVersionAndDatatypes,
  isLazyLoadingEnabled,
  matchedAssets,
  migrateMeasurementQuery,
  propertyFilterToQueryTags,
  resolveAssetLabel,
  resolveSelectedAssets,
  searchAssetsAndProperties,
  selectable,
  sortByLabel,
  sortByName,
  tagsToQueryTags,
  updateTreeChildren,
  valueFiltersToQueryTags,
} from './util'
import { AggregationName, Asset, AssetProperty, MeasurementQuery } from 'types'
import { DataSource } from 'datasource'

const UUID = '11111111-1111-1111-1111-111111111111'
const PARENT = '22222222-2222-2222-2222-222222222222'

// Minimal DataSource stub exposing only the methods the lazy helpers call.
function makeDS(overrides: Record<string, jest.Mock> = {}): DataSource {
  return {
    getAssets: jest.fn().mockResolvedValue([]),
    getAssetProperties: jest.fn().mockResolvedValue([]),
    multiSelectReplace: jest.fn((value: string) => [value]),
    ...overrides,
  } as unknown as DataSource
}

describe('resolveAssetLabel', () => {
  it('returns an empty label for an empty selection without fetching', async () => {
    const ds = makeDS()
    expect(await resolveAssetLabel(ds, undefined)).toEqual({ label: '' })
    expect(ds.getAssets).not.toHaveBeenCalled()
  })

  it('keeps template variables and regex visible without fetching', async () => {
    const ds = makeDS()
    expect(await resolveAssetLabel(ds, '$asset')).toEqual({ label: '$asset' })
    expect(await resolveAssetLabel(ds, '/pump.*/')).toEqual({ label: '/pump.*/' })
    expect(ds.getAssets).not.toHaveBeenCalled()
  })

  it('resolves a UUID to its asset path (falling back to name)', async () => {
    const withPath = { UUID, Name: 'Pump', AssetPath: 'Line 1\\Pump' } as Asset
    const ds = makeDS({ getAssets: jest.fn().mockResolvedValue([withPath]) })
    expect(await resolveAssetLabel(ds, UUID)).toEqual({ label: 'Line 1\\Pump', asset: withPath })
    expect(ds.getAssets).toHaveBeenCalledWith({ UUIDs: [UUID] })

    const noPath = { UUID, Name: 'Pump' } as Asset
    const ds2 = makeDS({ getAssets: jest.fn().mockResolvedValue([noPath]) })
    expect((await resolveAssetLabel(ds2, UUID)).label).toBe('Pump')
  })

  it('returns an empty label when the UUID is not found', async () => {
    const ds = makeDS({ getAssets: jest.fn().mockResolvedValue([]) })
    expect(await resolveAssetLabel(ds, UUID)).toEqual({ label: '' })
  })
})

describe('resolveSelectedAssets', () => {
  it('fetches a UUID selection by UUIDs', async () => {
    const asset = { UUID, Name: 'Pump' } as Asset
    const ds = makeDS({ getAssets: jest.fn().mockResolvedValue([asset]) })
    expect(await resolveSelectedAssets(ds, UUID)).toEqual([asset])
    expect(ds.getAssets).toHaveBeenCalledWith({ UUIDs: [UUID] })
  })

  it('resolves a regex selection via keyword search, then matches by regex', async () => {
    const a1 = { UUID: 'u1', Name: 'pump-1', AssetPath: 'pump-1' } as Asset
    const a2 = { UUID: 'u2', Name: 'valve-1', AssetPath: 'valve-1' } as Asset
    const ds = makeDS({ getAssets: jest.fn().mockResolvedValue([a1, a2]) })
    expect(await resolveSelectedAssets(ds, '/pump.*/')).toEqual([a1])
    expect(ds.getAssets).toHaveBeenCalledWith({ Keyword: '/pump.*/' })
  })

  it('expands a template variable to UUIDs', async () => {
    const asset = { UUID, Name: 'Pump' } as Asset
    const ds = makeDS({
      getAssets: jest.fn().mockResolvedValue([asset]),
      multiSelectReplace: jest.fn(() => [UUID]),
    })
    expect(await resolveSelectedAssets(ds, '$asset')).toEqual([asset])
    expect(ds.getAssets).toHaveBeenCalledWith({ UUIDs: [UUID] })
  })

  it('returns empty (without fetching) when a template expands to no UUIDs', async () => {
    const ds = makeDS({ multiSelectReplace: jest.fn(() => ['not-a-uuid']) })
    expect(await resolveSelectedAssets(ds, '$asset')).toEqual([])
    expect(ds.getAssets).not.toHaveBeenCalled()
  })
})

describe('fetchLazyChildOptions', () => {
  it('requests Include flags and maps child assets plus property leaves', async () => {
    const child = { UUID: 'c1', Name: 'Child' } as Asset
    const prop = { UUID: 'p1', Name: 'Speed', AssetUUID: PARENT } as AssetProperty
    const ds = makeDS({
      getAssets: jest.fn().mockResolvedValue([child]),
      getAssetProperties: jest.fn().mockResolvedValue([prop]),
    })

    const opts = await fetchLazyChildOptions(ds, PARENT, true)

    expect(ds.getAssets).toHaveBeenCalledWith({
      ParentUUIDs: [PARENT],
      IncludeHasChildren: true,
      IncludeHasAssetProperties: true,
    })
    expect(ds.getAssetProperties).toHaveBeenCalledWith({ AssetUUIDs: [PARENT] })
    expect(opts).toHaveLength(2)
    expect(opts.find((o) => o.value === 'p1')).toMatchObject({ label: '📏 Speed', value: 'p1', isLeaf: true })
  })

  it('skips property fetching when includeProperties is false', async () => {
    const child = { UUID: 'c1', Name: 'Child' } as Asset
    const ds = makeDS({ getAssets: jest.fn().mockResolvedValue([child]) })

    const opts = await fetchLazyChildOptions(ds, PARENT, false)

    expect(ds.getAssets).toHaveBeenCalledWith({ ParentUUIDs: [PARENT], IncludeHasChildren: true })
    expect(ds.getAssetProperties).not.toHaveBeenCalled()
    expect(opts).toHaveLength(1)
    expect(opts[0]).toMatchObject({ label: '📦 Child', value: 'c1' })
  })
})

describe('searchAssetsAndProperties', () => {
  it('returns empty for short keywords without fetching', async () => {
    const ds = makeDS()
    expect(await searchAssetsAndProperties(ds, 'a')).toEqual([])
    expect(ds.getAssets).not.toHaveBeenCalled()
  })

  it('returns asset and property results from the backend without re-filtering', async () => {
    const asset = { UUID: 'a1', Name: 'Pump', AssetPath: 'Line\\Pump' } as Asset
    const prop = { UUID: 'p1', Name: 'Speed', AssetUUID: 'a1' } as AssetProperty
    const ds = makeDS({
      getAssets: jest.fn().mockResolvedValue([asset]),
      getAssetProperties: jest.fn().mockResolvedValue([prop]),
    })

    const res = await searchAssetsAndProperties(ds, 'pump')

    expect(ds.getAssets).toHaveBeenCalledWith({ Keyword: 'pump', UseAssetPath: true })
    expect(ds.getAssetProperties).toHaveBeenCalledWith({ Keyword: 'pump' })
    expect(res).toEqual([
      { label: '📦 Line\\Pump', value: ['a1'] },
      { label: '📦 Line\\Pump\\📏 Speed', value: ['a1', 'p1'], description: 'Line\\Pump' },
    ])
  })

  it('keeps a property whose name does not contain the keyword (regex/description backend match)', async () => {
    // The client used to drop these, breaking regex searches; the backend already filtered.
    const asset = { UUID: 'a1', Name: 'Pump', AssetPath: 'Pump' } as Asset
    const prop = { UUID: 'p1', Name: 'Speed', AssetUUID: 'a1' } as AssetProperty
    const ds = makeDS({
      getAssets: jest.fn().mockResolvedValue([asset]),
      getAssetProperties: jest.fn().mockResolvedValue([prop]),
    })

    const res = await searchAssetsAndProperties(ds, '/spe.*/')

    expect(res.some((r) => r.value?.[r.value.length - 1] === 'p1')).toBe(true)
  })

  it('fetches missing parent assets for properties absent from the asset results', async () => {
    const prop = { UUID: 'p1', Name: 'Speed', AssetUUID: 'parent-1' } as AssetProperty
    const parent = { UUID: 'parent-1', Name: 'Pump', AssetPath: 'Line\\Pump' } as Asset
    const getAssets = jest
      .fn()
      .mockResolvedValueOnce([]) // keyword asset search returns nothing
      .mockResolvedValueOnce([parent]) // missing-parent lookup by UUIDs
    const ds = makeDS({ getAssets, getAssetProperties: jest.fn().mockResolvedValue([prop]) })

    const res = await searchAssetsAndProperties(ds, 'speed')

    expect(getAssets).toHaveBeenNthCalledWith(2, { UUIDs: ['parent-1'] })
    expect(res).toEqual([
      { label: '📦 Line\\Pump\\📏 Speed', value: ['parent-1', 'p1'], description: 'Line\\Pump' },
    ])
  })
})

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
    expect(result.IsRegex).toBe(true)
    expect(result.Regex).toBe('sensor-.*')
    expect(result.Measurements).toEqual([])
  })

  it('does not mutate the original query', () => {
    const query: MeasurementQuery = {
      IsRegex: false,
      Measurements: ['/sensor-.*/'],
      Options: {} as any,
    }
    migrateMeasurementQuery(query)
    expect(query.IsRegex).toBe(false)
    expect(query.Regex).toBeUndefined()
    expect(query.Measurements).toEqual(['/sensor-.*/'])
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

describe('isLazyLoadingEnabled', () => {
  it('is disabled for unknown version (info not loaded)', () => {
    expect(isLazyLoadingEnabled('')).toBe(false)
  })

  it('is disabled before v8.2.0', () => {
    expect(isLazyLoadingEnabled('v8.1.0')).toBe(false)
  })

  it('is enabled from v8.2.0', () => {
    expect(isLazyLoadingEnabled('v8.2.0')).toBe(true)
    expect(isLazyLoadingEnabled('v9.0.0')).toBe(true)
  })

  it('is enabled for non-semver debug builds', () => {
    expect(isLazyLoadingEnabled('debug')).toBe(true)
  })
})

describe('buildLazyCascaderOptions', () => {
  const assets: Asset[] = [
    { Name: 'Pump-01', UUID: 'uuid-1', Description: '', Status: 'active' },
    { Name: 'Motor-A', UUID: 'uuid-2', Description: '', Status: 'active' },
  ]

  const assetProperties: AssetProperty[] = [
    { Name: 'Temperature', UUID: 'prop-1', AssetUUID: 'uuid-1', MeasurementUUID: 'meas-1' },
    { Name: 'Pressure', UUID: 'prop-2', AssetUUID: 'uuid-1', MeasurementUUID: 'meas-2' },
  ]

  it('returns empty array for empty assets', () => {
    expect(buildLazyCascaderOptions([], [])).toEqual([])
  })

  it('creates options with 📦 prefix and isLeaf false for assets', () => {
    const result = buildLazyCascaderOptions(assets, [])
    expect(result).toHaveLength(2)
    result.forEach((option) => {
      expect(option.label).toMatch(/^📦 /)
      expect(option.isLeaf).toBe(false)
    })
  })

  it('attaches properties with 📏 prefix and isLeaf true', () => {
    const result = buildLazyCascaderOptions(assets, assetProperties)
    const pump = result.find((o) => o.value === 'uuid-1')
    expect(pump?.items).toHaveLength(2)
    pump?.items?.forEach((item) => {
      expect(item.label).toMatch(/^📏 /)
      expect(item.isLeaf).toBe(true)
    })
  })

  it('does not attach properties to unrelated assets', () => {
    const result = buildLazyCascaderOptions(assets, assetProperties)
    const motor = result.find((o) => o.value === 'uuid-2')
    expect(motor?.items).toBeUndefined()
  })

  it('sorts options by label', () => {
    const result = buildLazyCascaderOptions(assets, [])
    const labels = result.map((o) => o.label)
    expect(labels).toEqual(['📦 Motor-A', '📦 Pump-01'])
  })

  it('marks leaf when HasChildren and HasAssetProperties are both false (>= v8.2.0)', () => {
    const flagged: Asset[] = [
      { Name: 'Leaf', UUID: 'uuid-leaf', Description: '', Status: 'active', HasChildren: false, HasAssetProperties: false },
    ]
    const result = buildLazyCascaderOptions(flagged, [])
    expect(result[0].isLeaf).toBe(true)
  })

  it('keeps node expandable when HasChildren is true', () => {
    const flagged: Asset[] = [
      { Name: 'Branch', UUID: 'uuid-branch', Description: '', Status: 'active', HasChildren: true, HasAssetProperties: false },
    ]
    const result = buildLazyCascaderOptions(flagged, [])
    expect(result[0].isLeaf).toBe(false)
  })

  it('keeps node expandable when HasAssetProperties is true', () => {
    const flagged: Asset[] = [
      { Name: 'WithProps', UUID: 'uuid-props', Description: '', Status: 'active', HasChildren: false, HasAssetProperties: true },
    ]
    const result = buildLazyCascaderOptions(flagged, [])
    expect(result[0].isLeaf).toBe(false)
  })
})

describe('updateTreeChildren', () => {
  it('replaces children of the target node', () => {
    const options = [
      { label: '📦 Root', value: 'root-1', isLeaf: false },
      { label: '📦 Root2', value: 'root-2', isLeaf: false },
    ]
    const children = [
      { label: '📦 Child', value: 'child-1', isLeaf: false },
    ]
    const result = updateTreeChildren(options, 'root-1', children)
    expect(result[0].items).toHaveLength(1)
    expect(result[0].items![0].value).toBe('child-1')
    expect(result[1]).toBe(options[1]) // unchanged node is same reference
  })

  it('marks node as isLeaf when children are empty', () => {
    const options = [
      { label: '📦 Root', value: 'root-1', isLeaf: false },
    ]
    const result = updateTreeChildren(options, 'root-1', [])
    expect(result[0].isLeaf).toBe(true)
    expect(result[0].items).toBeUndefined()
  })

  it('fully replaces items with new children', () => {
    const options = [
      {
        label: '📦 Root',
        value: 'root-1',
        isLeaf: false,
        items: [{ label: '📏 Temperature', value: 'prop-1', isLeaf: true }],
      },
    ]
    const children = [
      { label: '📦 Child', value: 'child-1', isLeaf: false },
      { label: '📏 Pressure', value: 'prop-2', isLeaf: true },
    ]
    const result = updateTreeChildren(options, 'root-1', children)
    expect(result[0].items).toHaveLength(2)
    expect(result[0].items).toBe(children)
  })

  it('handles deeply nested target nodes', () => {
    const options = [
      {
        label: '📦 L1',
        value: 'l1',
        isLeaf: false,
        items: [
          {
            label: '📦 L2',
            value: 'l2',
            isLeaf: false,
            items: [],
          },
        ],
      },
    ]
    const children = [{ label: '📦 L3', value: 'l3', isLeaf: false }]
    const result = updateTreeChildren(options, 'l2', children)
    expect(result[0].items![0].items).toHaveLength(1)
    expect(result[0].items![0].items![0].value).toBe('l3')
  })

  it('returns unchanged array when parent not found', () => {
    const options = [
      { label: '📦 Root', value: 'root-1', isLeaf: false },
    ]
    const result = updateTreeChildren(options, 'nonexistent', [])
    expect(result).toBe(options)
  })

  it('preserves structural sharing for untouched branches', () => {
    const untouched = {
      label: '📦 Untouched',
      value: 'untouched',
      isLeaf: false,
      items: [{ label: '📦 Sub', value: 'sub', isLeaf: false }],
    }
    const options = [
      untouched,
      { label: '📦 Target', value: 'target', isLeaf: false },
    ]
    const result = updateTreeChildren(options, 'target', [{ label: '📦 Child', value: 'child', isLeaf: false }])
    expect(result).not.toBe(options)
    expect(result[0]).toBe(untouched)
    expect(result[0].items).toBe(untouched.items)
  })

  it('returns new top-level array reference (immutable)', () => {
    const options = [
      { label: '📦 Root', value: 'root-1', isLeaf: false },
    ]
    const result = updateTreeChildren(options, 'root-1', [])
    expect(result).not.toBe(options)
    expect(result[0]).not.toBe(options[0])
  })
})
