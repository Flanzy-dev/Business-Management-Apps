// Backup / restore / clear-all — the one module whose bugs lose a shop's data,
// and which was untestable until storage arrived through a parameter.
//
// The properties here are deliberately registry-shaped rather than
// store-by-store: the failure this code has actually suffered wasn't a broken
// loop, it was a persisted store missing from PERSISTED_STORES and therefore
// silently absent from every backup. A test naming stores one by one would have
// missed that exactly as thoroughly as the loop did.
import { describe, it, expect } from 'vitest'
import { createPersistence } from '../persistence'
import { PERSISTED_STORES } from '../storageKeys'
import type { StorageAdapter } from '../storageAdapter'

/** An in-memory StorageAdapter — the seam's whole point. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial))
  const adapter: StorageAdapter = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
  return { adapter, data }
}

/** One distinct JSON blob per registered store, so a mix-up is visible. */
function seedEveryStore(): Record<string, string> {
  const seed: Record<string, string> = {}
  for (const { storageKey } of PERSISTED_STORES) {
    seed[storageKey] = JSON.stringify({ state: { marker: storageKey }, version: 0 })
  }
  return seed
}

describe('collectBackup', () => {
  it('captures every registered store, keyed by its backup field name', () => {
    const { adapter } = fakeStorage(seedEveryStore())
    const backup = createPersistence(adapter).collectBackup()

    expect(Object.keys(backup).sort()).toEqual(PERSISTED_STORES.map((s) => s.backupField).sort())
    for (const { storageKey, backupField } of PERSISTED_STORES) {
      expect(backup[backupField]).toContain(storageKey)
    }
  })

  it('records a store that has never been written as null rather than omitting it', () => {
    // An absent key must still appear, or a restore couldn't tell "no data yet"
    // apart from "this store didn't exist when the backup was taken".
    const { adapter } = fakeStorage()
    const backup = createPersistence(adapter).collectBackup()

    expect(Object.keys(backup)).toHaveLength(PERSISTED_STORES.length)
    for (const value of Object.values(backup)) expect(value).toBeNull()
  })

  it('reads nothing outside the registry — device-local keys stay out of backups', () => {
    const { adapter, data } = fakeStorage({ ...seedEveryStore(), 'device-id': 'dev-abc' })
    const backup = createPersistence(adapter).collectBackup()

    expect(JSON.stringify(backup)).not.toContain('dev-abc')
    // Still present in storage — collecting a backup reads, it never prunes.
    expect(data.get('device-id')).toBe('dev-abc')
  })
})

describe('applyBackup', () => {
  it('restores every field it recognizes and reports the count', () => {
    const { adapter, data } = fakeStorage()
    const file = Object.fromEntries(
      PERSISTED_STORES.map(({ backupField, storageKey }) => [backupField, `restored:${storageKey}`])
    )
    const restored = createPersistence(adapter).applyBackup(file)

    expect(restored).toBe(PERSISTED_STORES.length)
    for (const { storageKey } of PERSISTED_STORES) {
      expect(data.get(storageKey)).toBe(`restored:${storageKey}`)
    }
  })

  it('ignores unknown fields instead of writing junk keys', () => {
    const { adapter, data } = fakeStorage()
    const restored = createPersistence(adapter).applyBackup({
      customers: 'ok',
      somethingFromAFutureVersion: 'ignore me',
    })

    expect(restored).toBe(1)
    expect(data.has('somethingFromAFutureVersion')).toBe(false)
  })

  it('leaves a store untouched when the backup omits its field', () => {
    const { adapter, data } = fakeStorage({ 'customer-store': 'existing' })
    const restored = createPersistence(adapter).applyBackup({ vehicles: 'new-vehicles' })

    expect(restored).toBe(1)
    expect(data.get('customer-store')).toBe('existing')
  })

  it('skips non-string values rather than writing "[object Object]"', () => {
    const { adapter, data } = fakeStorage()
    const restored = createPersistence(adapter).applyBackup({
      customers: { not: 'a string' },
      vehicles: null,
      workers: 42,
      companies: 'fine',
    })

    expect(restored).toBe(1)
    expect(data.get('company-store')).toBe('fine')
    expect(data.has('customer-store')).toBe(false)
  })
})

describe('clearAllData', () => {
  it('removes every registered store', () => {
    const { adapter, data } = fakeStorage(seedEveryStore())
    createPersistence(adapter).clearAllData()

    for (const { storageKey } of PERSISTED_STORES) expect(data.has(storageKey)).toBe(false)
  })

  it('resets this device\'s own sync cursor, so its next sync cold-joins instead of catching up from a now-stale point', () => {
    const { adapter, data } = fakeStorage({ ...seedEveryStore(), 'sync-cursor': '42' })
    createPersistence(adapter).clearAllData()

    expect(data.has('sync-cursor')).toBe(false)
  })

  it('leaves device-local keys alone — clearing shop data must not reset this device', () => {
    // Wiping device-id would re-identify the install and break stock-movement
    // attribution; wiping sync-host would silently unpair a follower tablet.
    const { adapter, data } = fakeStorage({
      ...seedEveryStore(),
      'device-id': 'dev-abc',
      'sync-host': '{"role":"follower"}',
    })
    createPersistence(adapter).clearAllData()

    expect(data.get('device-id')).toBe('dev-abc')
    expect(data.get('sync-host')).toBe('{"role":"follower"}')
  })
})

describe('the round trip', () => {
  it('collect -> clear -> apply restores every registered store exactly', () => {
    // The property that catches the real bug class: a store missing from
    // PERSISTED_STORES cannot survive this, however well the loops work.
    const seed = seedEveryStore()
    const { adapter, data } = fakeStorage(seed)
    const persistence = createPersistence(adapter)

    const backup = persistence.collectBackup()
    persistence.clearAllData()
    expect([...data.keys()]).toEqual([])

    const restored = persistence.applyBackup(backup)

    expect(restored).toBe(PERSISTED_STORES.length)
    expect(Object.fromEntries(data)).toEqual(seed)
  })

  it('survives a backup taken while some stores had no data yet', () => {
    const partial = { 'customer-store': 'only-this-one' }
    const { adapter, data } = fakeStorage(partial)
    const persistence = createPersistence(adapter)

    const backup = persistence.collectBackup()
    persistence.clearAllData()
    persistence.applyBackup(backup)

    expect(Object.fromEntries(data)).toEqual(partial)
  })
})

describe('the registry itself', () => {
  it('has no duplicate storage keys or backup fields', () => {
    // Two stores sharing either name would silently overwrite each other in a
    // backup, and the round-trip test above would still pass.
    const storageKeys = PERSISTED_STORES.map((s) => s.storageKey)
    const backupFields = PERSISTED_STORES.map((s) => s.backupField)

    expect(new Set(storageKeys).size).toBe(storageKeys.length)
    expect(new Set(backupFields).size).toBe(backupFields.length)
  })
})
