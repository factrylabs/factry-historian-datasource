import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
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

describe('Cascader.loadData', () => {
  it('stores loadData prop for rc-cascader wiring', () => {
    const loadData = jest.fn()
    const cascader = new Cascader(makeProps({ loadData }))
    expect(cascader.props.loadData).toBe(loadData)
  })
})

describe('Cascader.onSearchAsync', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('calls onSearchAsync instead of local filtering when provided', async () => {
    const onSearchAsync = jest.fn().mockResolvedValue([
      { label: 'Factory\\Pump-01', value: ['uuid-1'] },
    ])
    const cascader = new Cascader(makeProps({ onSearchAsync }))

    const event = { target: { value: 'Pump' } }
    cascader.handleChange(event)

    jest.advanceTimersByTime(300)
    await Promise.resolve() // flush microtask

    expect(onSearchAsync).toHaveBeenCalledWith('Pump')
  })

  it('does not call onSearchAsync for short input', () => {
    const onSearchAsync = jest.fn().mockResolvedValue([])
    const cascader = new Cascader(makeProps({ onSearchAsync }))

    const event = { target: { value: 'P' } }
    cascader.handleChange(event)

    jest.advanceTimersByTime(300)

    expect(onSearchAsync).not.toHaveBeenCalled()
  })

  it('debounces onSearchAsync calls', () => {
    const onSearchAsync = jest.fn().mockResolvedValue([])
    const cascader = new Cascader(makeProps({ onSearchAsync }))

    cascader.handleChange({ target: { value: 'Pu' } })
    cascader.handleChange({ target: { value: 'Pum' } })
    cascader.handleChange({ target: { value: 'Pump' } })

    jest.advanceTimersByTime(300)

    expect(onSearchAsync).toHaveBeenCalledTimes(1)
    expect(onSearchAsync).toHaveBeenCalledWith('Pump')
  })

  it('does not have onSearchAsync by default', () => {
    const options: CascaderOption[] = [
      { label: 'Alpha', value: 'alpha' },
      { label: 'Beta', value: 'beta' },
    ]
    const cascader = new Cascader(makeProps({ options }))
    // Without onSearchAsync, handleChange uses local filtering via getSearchableOptions
    expect(cascader.props.onSearchAsync).toBeUndefined()
    // Verify getSearchableOptions still works for local filtering
    const searchable = cascader.getSearchableOptions(options)
    expect(searchable).toHaveLength(2)
    expect(searchable.map((s) => s.label)).toEqual(['Alpha', 'Beta'])
  })
})

const searchOptions: CascaderOption[] = [
  { label: 'Pump-01', value: 'pump-uuid' },
  { label: 'Tank-01', value: 'tank-uuid' },
]

function renderCascader(overrides: Partial<React.ComponentProps<typeof Cascader>> = {}) {
  const onSelect = jest.fn()
  render(<Cascader theme={createTheme()} options={searchOptions} onSelect={onSelect} {...overrides} />)
  return { input: screen.getByRole('textbox'), onSelect }
}

describe('Cascader search suggestions', () => {
  it('closes the suggestions when the input loses focus', () => {
    const { input } = renderCascader()
    fireEvent.change(input, { target: { value: 'Pump' } })
    expect(screen.getByText('Pump-01')).toBeInTheDocument()

    fireEvent.blur(input)

    expect(screen.queryByText('Pump-01')).not.toBeInTheDocument()
  })

  it('closes the suggestions on Escape and keeps the typed text', () => {
    const { input } = renderCascader()
    fireEvent.change(input, { target: { value: 'Pump' } })

    fireEvent.keyDown(input, { key: 'Escape', keyCode: 27 })

    expect(screen.queryByText('Pump-01')).not.toBeInTheDocument()
    expect(input).toHaveValue('Pump')
  })

  it('keeps focus in the input while a suggestion is pressed so the click still selects it', () => {
    const { input, onSelect } = renderCascader()
    fireEvent.change(input, { target: { value: 'Pump' } })
    const suggestion = screen.getByText('Pump-01')
    // jsdom does not implement innerText, which the click handler reads.
    Object.defineProperty(suggestion, 'innerText', { value: suggestion.textContent })

    // A false return means the default (moving focus out of the input) was prevented.
    expect(fireEvent.mouseDown(suggestion)).toBe(false)
    fireEvent.click(suggestion)

    expect(onSelect).toHaveBeenLastCalledWith('pump-uuid')
  })

  it('does not reopen the suggestions when an async search resolves after the input lost focus', async () => {
    jest.useFakeTimers()
    try {
      let resolve: (v: Array<{ label: string; value: string[] }>) => void = () => {}
      const onSearchAsync = jest.fn(() => new Promise<Array<{ label: string; value: string[] }>>((r) => (resolve = r)))
      const { input } = renderCascader({ onSearchAsync })
      fireEvent.change(input, { target: { value: '/Pump.*/' } })
      act(() => {
        jest.advanceTimersByTime(300)
      })

      fireEvent.blur(input)
      await act(async () => {
        resolve([{ label: 'Pump-01', value: ['pump-uuid'] }])
      })

      expect(screen.queryByText('Pump-01')).not.toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })
})
