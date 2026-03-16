import { Cascader, CascaderOption, CascaderProps } from './Cascader'
import { createTheme } from '@grafana/data'

// Build a minimal props object for instantiating the Cascader class in unit tests.
// We only need enough to satisfy TypeScript — render tests use the full component below.
function makeProps(overrides: Partial<CascaderProps> = {}): CascaderProps {
  return {
    theme: createTheme(),
    options: [],
    onSelect: jest.fn(),
    ...overrides,
  } as CascaderProps
}

describe('Cascader.flattenOptions', () => {
  it('returns an empty array for empty options', () => {
    const cascader = new Cascader(makeProps())
    expect(cascader.flattenOptions([])).toEqual([])
  })

  it('returns flat leaf options unchanged', () => {
    const options: CascaderOption[] = [
      { label: 'Alpha', value: 'alpha' },
      { label: 'Beta', value: 'beta' },
    ]
    const cascader = new Cascader(makeProps({ options }))
    const result = cascader.flattenOptions(options)
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('Alpha')
    expect(result[0].value).toEqual(['alpha'])
  })

  it('includes branch nodes and their leaf children', () => {
    const options: CascaderOption[] = [
      {
        label: 'Parent',
        value: 'parent',
        items: [
          { label: 'Child-1', value: 'child-1' },
          { label: 'Child-2', value: 'child-2' },
        ],
      },
    ]
    const cascader = new Cascader(makeProps({ options }))
    const result = cascader.flattenOptions(options)
    // branch node + 2 children = 3 entries
    expect(result).toHaveLength(3)
    const labels = result.map((r) => r.label)
    expect(labels).toContain('Parent')
    expect(labels).toContain('Parent / Child-1')
    expect(labels).toContain('Parent / Child-2')
  })

  it('builds label path using default separator (" / ")', () => {
    const options: CascaderOption[] = [
      {
        label: 'A',
        value: 'a',
        items: [{ label: 'B', value: 'b', items: [{ label: 'C', value: 'c' }] }],
      },
    ]
    const cascader = new Cascader(makeProps({ options }))
    const result = cascader.flattenOptions(options)
    const deepest = result.find((r) => r.singleLabel === 'C')
    expect(deepest?.label).toBe('A / B / C')
  })

  it('uses custom separator when provided', () => {
    const options: CascaderOption[] = [
      {
        label: 'A',
        value: 'a',
        items: [{ label: 'B', value: 'b' }],
      },
    ]
    const cascader = new Cascader(makeProps({ options, separator: ' > ' }))
    const result = cascader.flattenOptions(options)
    const child = result.find((r) => r.singleLabel === 'B')
    expect(child?.label).toBe('A > B')
  })

  it('builds correct value paths for nested options', () => {
    const options: CascaderOption[] = [
      {
        label: 'Root',
        value: 'root',
        items: [{ label: 'Leaf', value: 'leaf' }],
      },
    ]
    const cascader = new Cascader(makeProps({ options }))
    const result = cascader.flattenOptions(options)
    const leaf = result.find((r) => r.singleLabel === 'Leaf')
    expect(leaf?.value).toEqual(['root', 'leaf'])
  })

  it('handles deeply nested options', () => {
    const options: CascaderOption[] = [
      {
        label: 'L1',
        value: 'l1',
        items: [
          {
            label: 'L2',
            value: 'l2',
            items: [
              {
                label: 'L3',
                value: 'l3',
                items: [{ label: 'L4', value: 'l4' }],
              },
            ],
          },
        ],
      },
    ]
    const cascader = new Cascader(makeProps({ options }))
    const result = cascader.flattenOptions(options)
    const deepest = result.find((r) => r.singleLabel === 'L4')
    expect(deepest?.label).toBe('L1 / L2 / L3 / L4')
    expect(deepest?.value).toEqual(['l1', 'l2', 'l3', 'l4'])
  })
})

describe('Cascader.getSearchableOptions (memoization)', () => {
  it('returns the same reference for identical input', () => {
    const options: CascaderOption[] = [{ label: 'A', value: 'a' }]
    const cascader = new Cascader(makeProps({ options }))
    const first = cascader.getSearchableOptions(options)
    const second = cascader.getSearchableOptions(options)
    expect(first).toBe(second)
  })

  it('returns a new result when options change', () => {
    const options1: CascaderOption[] = [{ label: 'A', value: 'a' }]
    const options2: CascaderOption[] = [{ label: 'B', value: 'b' }]
    const cascader = new Cascader(makeProps())
    const first = cascader.getSearchableOptions(options1)
    const second = cascader.getSearchableOptions(options2)
    expect(first).not.toBe(second)
  })
})

describe('Cascader.setInitialValue', () => {
  it('returns empty label when initValue is undefined', () => {
    const cascader = new Cascader(makeProps())
    const result = cascader.setInitialValue([], undefined)
    expect(result).toEqual({ rcValue: [], activeLabel: '' })
  })

  it('finds the matching option and returns its label', () => {
    const options: CascaderOption[] = [{ label: 'Pump', value: 'pump-uuid' }]
    const cascader = new Cascader(makeProps({ options }))
    const searchable = cascader.flattenOptions(options)
    const result = cascader.setInitialValue(searchable, 'pump-uuid')
    expect(result.activeLabel).toBe('Pump')
  })

  it('returns empty when no matching option and allowCustomValue is false', () => {
    const cascader = new Cascader(makeProps({ allowCustomValue: false }))
    const result = cascader.setInitialValue([], 'unknown-uuid')
    expect(result).toEqual({ rcValue: [], activeLabel: '' })
  })

  it('returns the raw value as label when allowCustomValue is true and no match', () => {
    const cascader = new Cascader(makeProps({ allowCustomValue: true }))
    const result = cascader.setInitialValue([], 'custom-value')
    expect(result).toEqual({ rcValue: [], activeLabel: 'custom-value' })
  })
})
