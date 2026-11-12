// What Settings > Backup says about the automatic backups. The desktop app makes
// a dated copy of the database once a day and at every quit (electron/main.ts),
// so the newest one should never be old: an old one means backups have quietly
// stopped working — a full disk, a locked folder — which is exactly the thing a
// shop owner would otherwise only find out about on the day they need one.
import { dayKeyLocal, localDayOf } from '../format/dateKeys'

export interface BackupInfo {
  /** ISO instant of the newest automatic backup, or null if there is none. */
  lastBackupAt: string | null
  count: number
}

export type BackupStatus =
  /** Not the desktop app (a browser tab): there are no automatic backups to report. */
  | { kind: 'unavailable' }
  | { kind: 'none' }
  | { kind: 'ok'; at: string }
  /** Older than STALE_AFTER_DAYS. */
  | { kind: 'stale'; at: string; days: number }

/** A backup is made daily, so this many days without one is a fault, not a quiet spell. */
export const STALE_AFTER_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole local days between a stored instant and `now`. */
function daysSince(instant: string, now: Date): number {
  const [y, m, d] = localDayOf(instant).split('-').map(Number)
  const [ny, nm, nd] = dayKeyLocal(now).split('-').map(Number)
  return Math.round((Date.UTC(ny, nm - 1, nd) - Date.UTC(y, m - 1, d)) / DAY_MS)
}

export function backupStatus(info: BackupInfo | null | undefined, now: Date): BackupStatus {
  if (!info) return { kind: 'unavailable' }
  if (!info.lastBackupAt) return { kind: 'none' }
  const days = daysSince(info.lastBackupAt, now)
  return days >= STALE_AFTER_DAYS ? { kind: 'stale', at: info.lastBackupAt, days } : { kind: 'ok', at: info.lastBackupAt }
}
