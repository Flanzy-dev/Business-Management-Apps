import { describe, it, expect, vi } from 'vitest'
import { createBackupOps, backupFilename } from '../ops/backupOps'

function buildDeps(overrides: Partial<Parameters<typeof createBackupOps>[0]> = {}) {
  const data: Record<string, string | null> = { customers: '[]' }
  const persistence = {
    collectBackup: vi.fn(() => data),
    applyBackup: vi.fn((d: Record<string, unknown>) => Object.keys(d).length),
    clearAllData: vi.fn(),
  }
  const download = vi.fn()
  const deps = {
    persistence,
    deviceId: () => 'device-1',
    now: () => new Date('2026-09-02T00:00:00.000Z'),
    download,
    restoreBlockReason: () => null,
    ...overrides,
  }
  return { deps, persistence, download }
}

describe('backupFilename', () => {
  // A local-time instant, so the expected day holds in any timezone.
  const sep2 = new Date(2026, 8, 2, 12, 0)

  it('has no reason suffix for a plain backup', () => {
    expect(backupFilename(undefined, sep2)).toBe('oil-shop-backup-2026-09-02.json')
  })

  it('appends the reason for a safety backup', () => {
    expect(backupFilename('before-restore', sep2)).toBe('oil-shop-backup-2026-09-02-before-restore.json')
    expect(backupFilename('before-clear', sep2)).toBe('oil-shop-backup-2026-09-02-before-clear.json')
    expect(backupFilename('crash', sep2)).toBe('oil-shop-backup-2026-09-02-crash.json')
  })

  it('names the file by the local day, not the UTC day', () => {
    // 00:30 local on the 1st: in Jakarta (UTC+7) the UTC date is still the 30th.
    expect(backupFilename(undefined, new Date(2026, 9, 1, 0, 30))).toBe('oil-shop-backup-2026-10-01.json')
  })
})

describe('exportBackup', () => {
  it('downloads the current backup as JSON with no reason suffix', () => {
    const { deps, download } = buildDeps()
    createBackupOps(deps).exportBackup()
    expect(download).toHaveBeenCalledWith(JSON.stringify({ customers: '[]' }, null, 2), 'oil-shop-backup-2026-09-02.json', 'application/json')
  })

  it('accepts a reason for the crash-recovery / safety-backup call sites', () => {
    const { deps, download } = buildDeps()
    createBackupOps(deps).exportBackup('crash')
    expect(download).toHaveBeenCalledWith(expect.any(String), 'oil-shop-backup-2026-09-02-crash.json', 'application/json')
  })
})

describe('restoreBackup', () => {
  it('takes a safety backup BEFORE applying — order matters, an undo must exist before data changes', () => {
    const { deps, download, persistence } = buildDeps()
    const order: string[] = []
    download.mockImplementation(() => order.push('safety-backup'))
    persistence.applyBackup.mockImplementation(() => {
      order.push('apply')
      return 1
    })

    createBackupOps(deps).restoreBackup({ customers: '[]' })

    expect(order).toEqual(['safety-backup', 'apply'])
    expect(download).toHaveBeenCalledWith(expect.any(String), 'oil-shop-backup-2026-09-02-before-restore.json', 'application/json')
  })

  it('rebinds the admin device before applying — the restored data carries this device\'s binding', () => {
    const { deps, persistence } = buildDeps()
    const securityEnvelope = JSON.stringify({ state: { security: { adminPasswordHash: 'hash', adminDeviceId: 'old-device' } } })

    createBackupOps(deps).restoreBackup({ security: securityEnvelope })

    const appliedData = persistence.applyBackup.mock.calls[0][0] as Record<string, unknown>
    const appliedSecurity = JSON.parse(appliedData.security as string)
    expect(appliedSecurity.state.security.adminDeviceId).toBe('device-1')
  })

  it('returns the restored-field count from applyBackup', () => {
    const { deps, persistence } = buildDeps()
    persistence.applyBackup.mockReturnValue(3)
    expect(createBackupOps(deps).restoreBackup({})).toEqual({ restored: 3 })
  })

  it.each(['follower', 'peers'] as const)('blocks restore for %s sync topology before downloading or applying', (blocked) => {
    const { deps, download, persistence } = buildDeps({ restoreBlockReason: () => blocked })

    expect(createBackupOps(deps).restoreBackup({ customers: '[]' })).toEqual({ restored: 0, blocked })
    expect(download).not.toHaveBeenCalled()
    expect(persistence.applyBackup).not.toHaveBeenCalled()
  })
})

describe('clearAllShopData', () => {
  it('takes a safety backup BEFORE clearing', () => {
    const { deps, download, persistence } = buildDeps()
    const order: string[] = []
    download.mockImplementation(() => order.push('safety-backup'))
    persistence.clearAllData.mockImplementation(() => order.push('clear'))

    createBackupOps(deps).clearAllShopData()

    expect(order).toEqual(['safety-backup', 'clear'])
    expect(download).toHaveBeenCalledWith(expect.any(String), 'oil-shop-backup-2026-09-02-before-clear.json', 'application/json')
  })
})
