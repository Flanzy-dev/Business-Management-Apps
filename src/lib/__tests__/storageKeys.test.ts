import { describe, it, expect } from 'vitest'
import { DEVICE_LOCAL_KEYS, PERSISTED_STORES, isShopDataKey, isDeviceLocalKey, classifyKey } from '../storageKeys'

describe('PERSISTED_STORES', () => {
  it('has 22 entries', () => {
    expect(PERSISTED_STORES).toHaveLength(22)
  })

  it('has a unique storageKey per entry', () => {
    const keys = PERSISTED_STORES.map((s) => s.storageKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has a unique backupField per entry', () => {
    const fields = PERSISTED_STORES.map((s) => s.backupField)
    expect(new Set(fields).size).toBe(fields.length)
  })
})

describe('DEVICE_LOCAL_KEYS', () => {
  it('has exactly 7 keys', () => {
    expect(Object.values(DEVICE_LOCAL_KEYS)).toHaveLength(7)
  })

  it('is disjoint from PERSISTED_STORES\' storage keys', () => {
    const shopKeys = new Set<string>(PERSISTED_STORES.map((s) => s.storageKey))
    for (const deviceKey of Object.values(DEVICE_LOCAL_KEYS)) {
      expect(shopKeys.has(deviceKey)).toBe(false)
    }
  })
})

describe('isShopDataKey / isDeviceLocalKey', () => {
  it('accepts every registered store key as shop data', () => {
    for (const { storageKey } of PERSISTED_STORES) {
      expect(isShopDataKey(storageKey)).toBe(true)
      expect(isDeviceLocalKey(storageKey)).toBe(false)
    }
  })

  it('accepts every device-local key as device-local, not shop data', () => {
    for (const key of Object.values(DEVICE_LOCAL_KEYS)) {
      expect(isDeviceLocalKey(key)).toBe(true)
      expect(isShopDataKey(key)).toBe(false)
    }
  })

  it('rejects an unregistered key from both', () => {
    expect(isShopDataKey('some-future-key')).toBe(false)
    expect(isDeviceLocalKey('some-future-key')).toBe(false)
  })
})

describe('classifyKey', () => {
  it("classifies a store key as 'shop-data'", () => {
    expect(classifyKey('customer-store')).toBe('shop-data')
  })

  it("classifies device-id/sync-host/sync-outbox/sync-cursor/auth-mode as 'device-local'", () => {
    expect(classifyKey('device-id')).toBe('device-local')
    expect(classifyKey('sync-host')).toBe('device-local')
    expect(classifyKey('sync-outbox')).toBe('device-local')
    expect(classifyKey('sync-cursor')).toBe('device-local')
    expect(classifyKey('auth-mode')).toBe('device-local')
  })

  it("classifies anything else as 'unknown'", () => {
    expect(classifyKey('something-nobody-registered')).toBe('unknown')
  })
})
