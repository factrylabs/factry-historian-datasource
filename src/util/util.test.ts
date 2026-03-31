import { isRegex, isUUID, isValidRegex } from './util'

describe('isRegex', () => {
  it('returns true for a valid regex string', () => {
    expect(isRegex('/foo/')).toBe(true)
  })

  it('returns true for a complex regex', () => {
    expect(isRegex('/^sensor-[0-9]+$/')).toBe(true)
  })

  it('returns false for a plain string', () => {
    expect(isRegex('foo')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isRegex('')).toBe(false)
  })

  it('returns false for a single slash', () => {
    expect(isRegex('/')).toBe(false)
  })

  it('returns true for two slashes (edge case: empty regex)', () => {
    expect(isRegex('//')).toBe(true)
  })

  it('returns false when only starts with slash', () => {
    expect(isRegex('/foo')).toBe(false)
  })

  it('returns false when only ends with slash', () => {
    expect(isRegex('foo/')).toBe(false)
  })
})

describe('isValidRegex', () => {
  it('returns true for a valid regex string', () => {
    expect(isValidRegex('/^foo.*bar$/')).toBe(true)
  })

  it('returns true for a simple pattern', () => {
    expect(isValidRegex('/sensor/')).toBe(true)
  })

  it('returns false for an invalid regex pattern', () => {
    expect(isValidRegex('/[/')).toBe(false)
  })

  it('returns false for an unclosed group', () => {
    expect(isValidRegex('/(unclosed/')).toBe(false)
  })

  it('returns false for a plain string (not regex-formatted)', () => {
    expect(isValidRegex('foo')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidRegex('')).toBe(false)
  })

  it('returns true for empty regex //', () => {
    expect(isValidRegex('//')).toBe(true)
  })
})

describe('isUUID', () => {
  it('returns true for a valid UUID v4', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('returns true for uppercase UUID', () => {
    expect(isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('returns true for mixed-case UUID', () => {
    expect(isUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true)
  })

  it('returns false for a plain string', () => {
    expect(isUUID('not-a-uuid')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isUUID('')).toBe(false)
  })

  it('returns false for UUID with wrong segment lengths', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false)
  })

  it('returns false for UUID missing hyphens', () => {
    expect(isUUID('550e8400e29b41d4a716446655440000')).toBe(false)
  })
})
