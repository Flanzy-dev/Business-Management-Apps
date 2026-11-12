import { describe, expect, it } from 'vitest'
import { backupStatus, STALE_AFTER_DAYS } from '../app/backupStatus'

const now = new Date(2026, 10, 12, 15, 0) // Nov 12, 2026, 15:00 local
const at = (day: number, hour = 9) => new Date(2026, 10, day, hour, 0).toISOString()

describe('backupStatus', () => {
  it('has nothing to report outside the desktop app', () => {
    expect(backupStatus(null, now)).toEqual({ kind: 'unavailable' })
    expect(backupStatus(undefined, now)).toEqual({ kind: 'unavailable' })
  })

  it('says so when no automatic backup exists yet', () => {
    expect(backupStatus({ lastBackupAt: null, count: 0 }, now)).toEqual({ kind: 'none' })
  })

  it('is fine for a backup made today or yesterday', () => {
    expect(backupStatus({ lastBackupAt: at(12), count: 3 }, now).kind).toBe('ok')
    expect(backupStatus({ lastBackupAt: at(11), count: 3 }, now).kind).toBe('ok')
  })

  it('stays fine just inside the limit', () => {
    expect(backupStatus({ lastBackupAt: at(12 - (STALE_AFTER_DAYS - 1)), count: 3 }, now).kind).toBe('ok')
  })

  it('warns once the newest backup is old enough that daily backups must have stopped', () => {
    const status = backupStatus({ lastBackupAt: at(12 - STALE_AFTER_DAYS), count: 3 }, now)
    expect(status).toEqual({ kind: 'stale', at: at(12 - STALE_AFTER_DAYS), days: STALE_AFTER_DAYS })
  })

  it('counts days by the shop\'s calendar, not elapsed hours', () => {
    // 23:30 last night is 1 day ago at 00:10 today, though only 40 minutes have passed.
    const justAfterMidnight = new Date(2026, 10, 12, 0, 10)
    const status = backupStatus({ lastBackupAt: new Date(2026, 10, 11, 23, 30).toISOString(), count: 1 }, justAfterMidnight)
    expect(status.kind).toBe('ok')
    const stale = backupStatus({ lastBackupAt: new Date(2026, 10, 9, 23, 30).toISOString(), count: 1 }, justAfterMidnight)
    expect(stale).toMatchObject({ kind: 'stale', days: 3 })
  })
})
