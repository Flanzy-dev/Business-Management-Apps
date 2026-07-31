import { describe, it, expect, beforeEach } from 'vitest'
import { readHostConfig, writeHostConfig, resolveBaseUrl, normalizeHostUrl } from '../sync/hostConfig'

// vitest.config.ts runs this suite under environment: 'node' — there is no
// real localStorage, and storageAdapter.ts's localStorageAdapter calls it
// directly (not through getStorageAdapter's deliberate try/catch, which only
// zustand's persist middleware goes through). A minimal in-memory polyfill
// is enough for the round-trip tests below; resolveBaseUrl's other cases all
// take an explicit `config` argument precisely so they don't need one.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

beforeEach(() => {
  ;(globalThis as any).localStorage = new MemoryStorage()
})

describe('normalizeHostUrl', () => {
  it('adds a scheme and the LAN port to a bare host', () => {
    expect(normalizeHostUrl('192.168.1.20')).toBe('http://192.168.1.20:5174')
  })

  it('keeps an explicit port instead of appending the default one', () => {
    expect(normalizeHostUrl('192.168.1.20:8080')).toBe('http://192.168.1.20:8080')
  })

  it('passes a full URL through unchanged (besides a trailing slash)', () => {
    expect(normalizeHostUrl('https://shop.example.com:9000/')).toBe('https://shop.example.com:9000')
  })
})

describe('resolveBaseUrl', () => {
  it('falls back to the loaded origin when role is main (today\'s behaviour preserved)', () => {
    // No `window` in this environment -> falls back to 'localhost', the same
    // branch a real browser takes when window.location.hostname is empty
    // (an Electron file:// window) — see src/lib/sync/hostConfig.ts.
    expect(resolveBaseUrl({ role: 'main', host: null, token: null })).toBe('http://localhost:5174')
  })

  it('uses the configured host when role is follower', () => {
    expect(resolveBaseUrl({ role: 'follower', host: '192.168.1.50', token: null })).toBe('http://192.168.1.50:5174')
  })

  it('passes a full URL host through as-is', () => {
    expect(resolveBaseUrl({ role: 'follower', host: 'http://10.0.0.5:8080', token: null })).toBe('http://10.0.0.5:8080')
  })

  it('falls back instead of breaking when role is follower but no host is set', () => {
    expect(resolveBaseUrl({ role: 'follower', host: null, token: null })).toBe('http://localhost:5174')
  })
})

describe('readHostConfig / writeHostConfig', () => {
  it('defaults to role main with no host or token when nothing has been saved', () => {
    expect(readHostConfig()).toEqual({ role: 'main', host: null, token: null })
  })

  it('round-trips a follower config through storage', () => {
    writeHostConfig({ role: 'follower', host: '192.168.1.20', token: 'letmein' })
    expect(readHostConfig()).toEqual({ role: 'follower', host: '192.168.1.20', token: 'letmein' })
  })

  it('ignores corrupted storage and falls back to the default', () => {
    localStorage.setItem('sync-host', 'not json')
    expect(readHostConfig()).toEqual({ role: 'main', host: null, token: null })
  })
})
