import { describe, it, expect } from 'vitest'
import { compareAppVersions } from '../versionCompare'

describe('compareAppVersions', () => {
  it('same version', () => {
    expect(compareAppVersions('1.1.4', '1.1.4')).toBe('same')
  })

  it('client older than host', () => {
    expect(compareAppVersions('1.1.4', '1.1.6')).toBe('client-older')
  })

  it('client newer than host', () => {
    expect(compareAppVersions('1.2.0', '1.1.9')).toBe('client-newer')
  })

  it('null host version is unknown (host predates the version field with an explicit null)', () => {
    expect(compareAppVersions('1.1.4', null)).toBe('unknown')
  })

  it('undefined host version is unknown (old host with no version key at all)', () => {
    expect(compareAppVersions('1.1.4', undefined)).toBe('unknown')
  })

  it('unparseable host version is unknown', () => {
    expect(compareAppVersions('1.1.4', 'banana')).toBe('unknown')
  })

  it('compares numeric segments, not strings (1.10.0 > 1.9.0)', () => {
    expect(compareAppVersions('1.10.0', '1.9.0')).toBe('client-newer')
  })

  it('treats a missing trailing segment as zero', () => {
    expect(compareAppVersions('1.2', '1.2.0')).toBe('same')
    expect(compareAppVersions('1.2.0', '1.2')).toBe('same')
  })
})
