import { describe, it, expect } from 'vitest'
import { en } from '../../i18n/en'
import { id } from '../../i18n/id'

// package.json's `version` is the ONLY place a version number should ever
// be written by hand — see src/lib/appVersion.ts's header. It reaches the
// UI through {{version}} interpolation (src/lib/i18n's `interpolate`), and
// this test is what makes sure it stays that way: the version string
// already drifted once (package.json said 1.1.3 while Profile.tsx had a
// stale hardcoded "v1.0.0"), so this is real regression coverage, not
// theoretical.
describe('version stays out of the i18n dictionaries', () => {
  it('versionFooter and aboutVersion interpolate {{version}} instead of a literal number', () => {
    expect(en.layout.versionFooter).toContain('{{version}}')
    expect(en.settings.aboutVersion).toContain('{{version}}')
    expect(id.layout.versionFooter).toContain('{{version}}')
    expect(id.settings.aboutVersion).toContain('{{version}}')
  })

  it('none of those strings contains a hardcoded dotted version number', () => {
    const strings = [
      en.layout.versionFooter,
      en.settings.aboutVersion,
      id.layout.versionFooter,
      id.settings.aboutVersion,
    ]
    for (const s of strings) {
      expect(s).not.toMatch(/\d+\.\d+\.\d+/)
    }
  })
})
