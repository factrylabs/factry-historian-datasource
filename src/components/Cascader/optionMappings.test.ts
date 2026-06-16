import { onChangeCascader, onLoadDataCascader } from './optionMappings'

describe('onLoadDataCascader', () => {
  it('passes loaded children through so handlers can skip refetching an expanded node', () => {
    const onLoadData = jest.fn()
    const rcOptions = [
      { value: 'root', label: 'Root' },
      {
        value: 'parent',
        label: 'Parent',
        isLeaf: false,
        items: [{ value: 'child', label: 'Child', isLeaf: true }],
      },
    ]

    onLoadDataCascader(onLoadData)(rcOptions as any)

    expect(onLoadData).toHaveBeenCalledTimes(1)
    const mapped = onLoadData.mock.calls[0][0]
    const target = mapped[mapped.length - 1]
    expect(target.value).toBe('parent')
    expect(target.isLeaf).toBe(false)
    // Regression guard: items must survive the RC -> CascaderOption mapping, otherwise
    // handleLoadData's "already loaded" check is dead and rc-cascader refetches on every expand.
    expect(target.items).toHaveLength(1)
    expect(target.items[0]).toMatchObject({ value: 'child', label: 'Child', isLeaf: true })
  })

  it('leaves items undefined when the option has no loaded children', () => {
    const onLoadData = jest.fn()
    onLoadDataCascader(onLoadData)([{ value: 'parent', label: 'Parent', isLeaf: false }] as any)
    expect(onLoadData.mock.calls[0][0][0].items).toBeUndefined()
  })

  it('does nothing when no callback is provided', () => {
    expect(() => onLoadDataCascader(undefined)([{ value: 'x', label: 'X' }] as any)).not.toThrow()
  })
})

describe('onChangeCascader', () => {
  it('stringifies values and forwards mapped options', () => {
    const onChange = jest.fn()
    onChangeCascader(onChange)([1, 'two', null] as any, [{ value: 'two', label: 'Two' }] as any)
    expect(onChange).toHaveBeenCalledWith(['1', 'two', 'null'], [{ value: 'two', label: 'Two' }])
  })
})
