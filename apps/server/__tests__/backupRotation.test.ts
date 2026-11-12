import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  backupFileName,
  backupsToDelete,
  createBackup,
  KEEP_DAYS,
  latestBackup,
  listBackups,
  needsDailyBackup,
  type BackupFile,
} from '../backupRotation'

let dir: string
let dbFile: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'surya-backups-'))
  dbFile = path.join(dir, 'surya-baru.db')
  fs.writeFileSync(dbFile, 'the shop database')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const backupsDir = () => path.join(dir, 'backups')
/** A local-time moment, so "the shop's day" is unambiguous in any timezone. */
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi)
const fakeFile = (when: Date): BackupFile => ({ name: backupFileName(when), path: `/x/${backupFileName(when)}`, at: when })

describe('backupFileName / listBackups', () => {
  it('names a backup with its instant, safe for Windows', () => {
    const name = backupFileName(new Date('2026-11-12T03:04:05.678Z'))
    expect(name).toBe('surya-baru-2026-11-12T03-04-05-678Z.db')
    expect(name).not.toMatch(/[:]/)
  })

  it('reads the time back from the name, newest first, and ignores anything else in the folder', () => {
    fs.mkdirSync(backupsDir())
    for (const when of [at(2026, 11, 10), at(2026, 11, 12), at(2026, 11, 11)]) {
      fs.writeFileSync(path.join(backupsDir(), backupFileName(when)), 'x')
    }
    fs.writeFileSync(path.join(backupsDir(), 'notes.txt'), 'x')
    fs.writeFileSync(path.join(backupsDir(), 'surya-baru-hand-made.db'), 'x')

    expect(listBackups(backupsDir()).map((f) => f.at.getTime())).toEqual([
      at(2026, 11, 12).getTime(),
      at(2026, 11, 11).getTime(),
      at(2026, 11, 10).getTime(),
    ])
  })

  it('treats a missing folder as no backups', () => {
    expect(listBackups(path.join(dir, 'nope'))).toEqual([])
    expect(latestBackup(path.join(dir, 'nope'))).toBeNull()
  })
})

describe('needsDailyBackup', () => {
  it('is true on a first launch, with no backups at all', () => {
    expect(needsDailyBackup(backupsDir(), at(2026, 11, 12))).toBe(true)
  })

  it('is false once today already has one', () => {
    createBackup(dbFile, backupsDir(), at(2026, 11, 12, 8))
    expect(needsDailyBackup(backupsDir(), at(2026, 11, 12, 17))).toBe(false)
  })

  it('is true again the next day', () => {
    createBackup(dbFile, backupsDir(), at(2026, 11, 12, 23, 30))
    expect(needsDailyBackup(backupsDir(), at(2026, 11, 13, 0, 5))).toBe(true)
  })
})

describe('createBackup', () => {
  it('copies the database into the backups folder', () => {
    const made = createBackup(dbFile, backupsDir(), at(2026, 11, 12))
    expect(made).not.toBeNull()
    expect(fs.readFileSync(made!.path, 'utf8')).toBe('the shop database')
  })

  it('creates the folder on first use', () => {
    expect(fs.existsSync(backupsDir())).toBe(false)
    createBackup(dbFile, backupsDir(), at(2026, 11, 12))
    expect(fs.existsSync(backupsDir())).toBe(true)
  })

  it('returns null, writing nothing, when there is no database file yet', () => {
    fs.rmSync(dbFile)
    expect(createBackup(dbFile, backupsDir(), at(2026, 11, 12))).toBeNull()
    expect(fs.existsSync(backupsDir())).toBe(false)
  })

  it('keeps an earlier backup untouched when a later one is made', () => {
    const first = createBackup(dbFile, backupsDir(), at(2026, 11, 11))!
    fs.writeFileSync(dbFile, 'newer data')
    createBackup(dbFile, backupsDir(), at(2026, 11, 12))
    expect(fs.readFileSync(first.path, 'utf8')).toBe('the shop database')
  })
})

describe('retention', () => {
  it('keeps the newest two of a day, not seven quits in one afternoon', () => {
    const afternoon = [13, 14, 15, 16, 17].map((h) => fakeFile(at(2026, 11, 12, h)))
    const files = [...afternoon].reverse() // newest first
    expect(backupsToDelete(files).map((f) => f.at.getHours()).sort()).toEqual([13, 14, 15])
  })

  it('does not let a busy day push out earlier days', () => {
    const files = [
      ...[17, 16, 15, 14, 13].map((h) => fakeFile(at(2026, 11, 12, h))),
      fakeFile(at(2026, 11, 11, 9)),
      fakeFile(at(2026, 11, 10, 9)),
    ]
    const kept = files.filter((f) => !backupsToDelete(files).includes(f))
    expect(kept.map((f) => f.at.getDate())).toEqual([12, 12, 11, 10])
  })

  it('drops whole days beyond the retention window', () => {
    const files = Array.from({ length: KEEP_DAYS + 3 }, (_, i) => fakeFile(at(2026, 11, 30 - i)))
    const doomed = backupsToDelete(files)
    expect(doomed).toHaveLength(3)
    expect(doomed.map((f) => f.at.getDate())).toEqual([30 - KEEP_DAYS, 30 - KEEP_DAYS - 1, 30 - KEEP_DAYS - 2])
  })

  it('prunes on the way through createBackup', () => {
    fs.mkdirSync(backupsDir())
    for (const h of [8, 9, 10, 11]) fs.writeFileSync(path.join(backupsDir(), backupFileName(at(2026, 11, 12, h))), 'x')

    createBackup(dbFile, backupsDir(), at(2026, 11, 12, 12))

    expect(listBackups(backupsDir()).map((f) => f.at.getHours())).toEqual([12, 11])
  })
})
