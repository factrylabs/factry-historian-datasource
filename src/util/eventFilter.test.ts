import { eventFilterOperators, needsValue, operatorsWithoutValue } from './eventFilter'

describe('needsValue', () => {
  it('returns true for comparison operators', () => {
    expect(needsValue('=')).toBe(true)
    expect(needsValue('!=')).toBe(true)
    expect(needsValue('<')).toBe(true)
    expect(needsValue('<=')).toBe(true)
    expect(needsValue('>')).toBe(true)
    expect(needsValue('>=')).toBe(true)
  })

  it('returns true for set and regex operators', () => {
    expect(needsValue('IN')).toBe(true)
    expect(needsValue('NOT IN')).toBe(true)
    expect(needsValue('~')).toBe(true)
    expect(needsValue('!~')).toBe(true)
  })

  it('returns false for every operator in operatorsWithoutValue', () => {
    for (const op of operatorsWithoutValue) {
      expect(needsValue(op)).toBe(false)
    }
  })
})

describe('eventFilterOperators', () => {
  it('exposes the full set of comparison operators', () => {
    expect(eventFilterOperators).toEqual(
      expect.arrayContaining(['=', '!=', '<', '<=', '>', '>='])
    )
  })

  it('exposes set and regex operators', () => {
    expect(eventFilterOperators).toEqual(
      expect.arrayContaining(['IN', 'NOT IN', '~', '!~'])
    )
  })

  it('exposes every operator in operatorsWithoutValue', () => {
    expect(eventFilterOperators).toEqual(expect.arrayContaining(operatorsWithoutValue))
  })

  it('contains no duplicate entries', () => {
    expect(new Set(eventFilterOperators).size).toBe(eventFilterOperators.length)
  })
})
