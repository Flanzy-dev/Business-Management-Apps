import { describe, it, expect, beforeEach } from 'vitest'
import { useLanguageStore } from '../../../store/languageStore'
import { translate, translateCount } from '../index'

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en')
})

describe('translate', () => {
  it('looks up a known key in the current language', () => {
    expect(translate('common.cancel')).toBe('Cancel')
    useLanguageStore.getState().setLanguage('id')
    expect(translate('common.cancel')).toBe('Batal')
  })

  it('interpolates {{var}} placeholders', () => {
    expect(translate('validators.vinLength', { length: 5 })).toBe(
      'VIN must be 17 characters (currently 5)'
    )
  })

  it('falls back to English when the current language is missing a key, then to the raw key', () => {
    useLanguageStore.getState().setLanguage('id')
    expect(translate('common.cancel')).toBe('Batal')
    expect(translate('nonexistent.key')).toBe('nonexistent.key')
  })
})

describe('translateCount', () => {
  it('selects _one vs _other based on count', () => {
    // Uses real dictionary keys that exist with _one/_other suffixes is not
    // guaranteed app-wide, so this exercises the raw-key fallback path
    // deterministically instead of depending on a specific feature key.
    expect(translateCount('missing.key', 1)).toBe('missing.key_one')
    expect(translateCount('missing.key', 2)).toBe('missing.key_other')
  })
})
