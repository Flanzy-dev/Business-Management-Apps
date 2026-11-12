// Dated copies of the shop's database file, kept alongside the live one.
//
// Plain Node (fs only, no Electron), so the rules can be tested; the app's main
// process (electron/main.ts) decides WHEN to call these. A copy is made on every
// clean quit and once per day on launch — a quit-only schedule meant a power cut
// or crash left no backup newer than the last time someone closed the app.
//
// File name: surya-baru-2026-11-12T03-04-05-678Z.db — the UTC instant, with the
// colons and dot dashed so Windows accepts it. The time is read back from the
// name, not from the file's mtime, which a copy or a restore rewrites.
import * as fs from 'fs'
import * as path from 'path'

const PREFIX = 'surya-baru-'
const NAME_PATTERN = /^surya-baru-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.db$/

/** How many distinct days that have a backup are kept (the newest ones — a
 *  shop PC left off for a fortnight keeps its last backups rather than losing
 *  them to the calendar), and how many backups per day. A flat "newest 7" let
 *  seven quits in one afternoon push out every earlier day. */
export const KEEP_DAYS = 14
export const KEEP_PER_DAY = 2

export interface BackupFile {
  name: string
  path: string
  /** When it was made, from its name. */
  at: Date
}

function parseName(name: string): Date | null {
  const m = NAME_PATTERN.exec(name)
  if (!m) return null
  const [, y, mo, d, h, mi, s, ms] = m.map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s, ms))
}

export function backupFileName(now: Date): string {
  return `${PREFIX}${now.toISOString().replace(/[:.]/g, '-')}.db`
}

/** Local 'YYYY-MM-DD' — a "day" is the shop's day, not the UTC one. */
function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Every backup in `dir`, newest first. A missing folder is simply none. */
export function listBackups(dir: string): BackupFile[] {
  let names: string[]
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  const files: BackupFile[] = []
  for (const name of names) {
    const at = parseName(name)
    if (at) files.push({ name, path: path.join(dir, name), at })
  }
  return files.sort((a, b) => b.at.getTime() - a.at.getTime())
}

/** The newest backup, or null. */
export function latestBackup(dir: string): BackupFile | null {
  return listBackups(dir)[0] ?? null
}

/** True when no backup exists yet for `now`'s (local) day. */
export function needsDailyBackup(dir: string, now: Date): boolean {
  const latest = latestBackup(dir)
  return !latest || localDay(latest.at) !== localDay(now)
}

/**
 * Which of `files` (newest first) to delete: keep the newest KEEP_PER_DAY of
 * each of the newest KEEP_DAYS days that have any, drop the rest.
 */
export function backupsToDelete(files: BackupFile[], keepDays = KEEP_DAYS, perDay = KEEP_PER_DAY): BackupFile[] {
  const days: string[] = []
  const keptPerDay = new Map<string, number>()
  const doomed: BackupFile[] = []
  for (const file of files) {
    const day = localDay(file.at)
    if (!keptPerDay.has(day)) {
      if (days.length >= keepDays) {
        doomed.push(file)
        continue
      }
      days.push(day)
      keptPerDay.set(day, 0)
    }
    const kept = keptPerDay.get(day) ?? 0
    if (kept >= perDay) doomed.push(file)
    else keptPerDay.set(day, kept + 1)
  }
  return doomed
}

/**
 * Copy `dbFilePath` into `dir` as a dated backup, then prune. Returns the new
 * file, or null when there was nothing to copy. Throws on a failed copy: the
 * caller (main.ts) logs it — a backup that fails must never stop the app from
 * opening or quitting.
 */
export function createBackup(dbFilePath: string, dir: string, now: Date = new Date()): BackupFile | null {
  if (!fs.existsSync(dbFilePath)) return null
  fs.mkdirSync(dir, { recursive: true })
  const name = backupFileName(now)
  const target = path.join(dir, name)
  fs.copyFileSync(dbFilePath, target)
  for (const stale of backupsToDelete(listBackups(dir))) {
    try {
      fs.unlinkSync(stale.path)
    } catch {
      // Pruning is housekeeping; a locked old file is retried next time.
    }
  }
  return { name, path: target, at: now }
}
