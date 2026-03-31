import { isFeatureEnabled, semverCompare } from './semver'

describe('semverCompare', () => {
  it('returns 0 for equal versions', () => {
    expect(semverCompare('1.2.3', '1.2.3')).toBe(0)
  })

  it('returns positive when a is greater by major', () => {
    expect(semverCompare('2.0.0', '1.9.9')).toBeGreaterThan(0)
  })

  it('returns negative when a is less by major', () => {
    expect(semverCompare('1.0.0', '2.0.0')).toBeLessThan(0)
  })

  it('returns positive when a is greater by minor', () => {
    expect(semverCompare('1.3.0', '1.2.9')).toBeGreaterThan(0)
  })

  it('returns negative when a is less by minor', () => {
    expect(semverCompare('1.2.0', '1.3.0')).toBeLessThan(0)
  })

  it('returns positive when a is greater by patch', () => {
    expect(semverCompare('1.2.4', '1.2.3')).toBeGreaterThan(0)
  })

  it('returns negative when a is less by patch', () => {
    expect(semverCompare('1.2.2', '1.2.3')).toBeLessThan(0)
  })

  it('treats pre-release as less than release', () => {
    expect(semverCompare('1.0.0-alpha', '1.0.0')).toBeLessThan(0)
    expect(semverCompare('1.0.0', '1.0.0-alpha')).toBeGreaterThan(0)
  })

  it('handles v-prefixed versions', () => {
    expect(semverCompare('v1.2.3', '1.2.3')).toBe(0)
    expect(semverCompare('v2.0.0', 'v1.0.0')).toBeGreaterThan(0)
  })

  it('debug version (non-semver) is treated as greater than any version', () => {
    expect(semverCompare('not-a-version', '9.9.9')).toBeGreaterThan(0)
  })

  it('two debug versions are equal', () => {
    expect(semverCompare('debug', 'also-debug')).toBe(0)
  })

  it('debug vs debug returns 0', () => {
    expect(semverCompare('not-valid', 'also-not-valid')).toBe(0)
  })
})

describe('isFeatureEnabled', () => {
  it('returns true when version equals target', () => {
    expect(isFeatureEnabled('7.3.0', '7.3.0')).toBe(true)
  })

  it('returns true when version is above target', () => {
    expect(isFeatureEnabled('8.0.0', '7.3.0')).toBe(true)
  })

  it('returns false when version is below target', () => {
    expect(isFeatureEnabled('7.2.9', '7.3.0')).toBe(false)
  })

  it('returns true for debug/non-semver versions (treated as latest)', () => {
    expect(isFeatureEnabled('debug', '99.0.0')).toBe(true)
  })

  it('handles v-prefixed version strings', () => {
    expect(isFeatureEnabled('v7.3.0', '7.3.0')).toBe(true)
    expect(isFeatureEnabled('v7.2.0', '7.3.0')).toBe(false)
  })

  it('with includePreReleases=true, strips pre-release before comparing', () => {
    // v7.3.0-beta should be treated as 7.3.0 when includePreReleases=true
    expect(isFeatureEnabled('7.3.0-beta', '7.3.0', true)).toBe(true)
  })

  it('without includePreReleases, pre-release version is less than release', () => {
    expect(isFeatureEnabled('7.3.0-alpha', '7.3.0')).toBe(false)
  })
})
