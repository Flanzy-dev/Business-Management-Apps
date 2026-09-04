import { describe, it, expect } from 'vitest'
import { syncStatusLabel, syncStatusDotClass, SYNC_TONE_BY_PHASE } from '../syncStatus'

const t = (key: string, vars?: Record<string, string | number>) => `${key}${vars ? `:${JSON.stringify(vars)}` : ''}`

describe('syncStatusLabel', () => {
  it('labels each simple phase', () => {
    expect(syncStatusLabel('synced', 0, t)).toBe('sync.statusSynced')
    expect(syncStatusLabel('syncing', 0, t)).toBe('sync.statusSyncing')
    expect(syncStatusLabel('error', 0, t)).toBe('sync.statusError')
    expect(syncStatusLabel('unauthorized', 0, t)).toBe('sync.statusUnauthorized')
  })

  it('shows the plain offline label with nothing pending', () => {
    expect(syncStatusLabel('offline', 0, t)).toBe('sync.statusOffline')
  })

  it('shows the pending-count label once something is queued', () => {
    expect(syncStatusLabel('offline', 3, t)).toBe('sync.statusOfflinePending:{"count":3}')
  })
})

describe('syncStatusDotClass', () => {
  it('maps each phase to its dot color', () => {
    expect(syncStatusDotClass('synced')).toBe('bg-success')
    expect(syncStatusDotClass('syncing')).toBe('bg-accent')
    expect(syncStatusDotClass('error')).toBe('bg-danger')
    expect(syncStatusDotClass('unauthorized')).toBe('bg-danger')
    expect(syncStatusDotClass('offline')).toBe('bg-warning')
  })
})

describe('SYNC_TONE_BY_PHASE', () => {
  it('covers every phase', () => {
    expect(Object.keys(SYNC_TONE_BY_PHASE).sort()).toEqual(['error', 'idle', 'offline', 'synced', 'syncing', 'unauthorized'])
  })
})
