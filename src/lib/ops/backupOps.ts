// Backup/restore/clear-all sequencing — the most destructive policy in the
// app, extracted out of Settings.tsx (947 lines, and the only place any of
// this lived). The page keeps everything actually browser-coupled
// (FileReader, the <input type="file"> element, requestConfirm,
// requireAdminPassword, toasts, window.location.reload) and calls in here
// for the sequencing and the rules — same split as every other ops file.
//
// Stores/persistence arrive through `deps`, the same createXOps(deps) +
// bound-default shape src/lib/ops/inventoryOps.ts uses, for the same reason
// src/lib/persistence.ts's own header gives: this is the one module that can
// destroy a shop's data, so it has to be reachable from a test rather than
// only exercisable by clicking through the real page.
import { collectBackup, applyBackup, clearAllData } from '../persistence'
import { rebindAdminDevice } from '../auth/adminDeviceBinding'
import { getDeviceId } from '../deviceId'
import { downloadFile } from '../downloadFile'

export type SafetyBackupReason = 'before-restore' | 'before-clear' | 'before-recovery-restore' | 'crash'

/**
 * `oil-shop-backup-2026-09-02[-<reason>].json` — written out in one place
 * because four call sites (Settings' manual button, its two safety-backup
 * call sites, ErrorBoundary's crash recovery) used to build this string by
 * hand. StorageErrorBanner.tsx built a *different* prefix
 * (`surya-baru-backup-`) — a plain copy-paste drift from the other three, not
 * a deliberate distinction — fixed here to match rather than preserved.
 */
export function backupFilename(reason?: SafetyBackupReason, now: Date = new Date()): string {
  const date = now.toISOString().split('T')[0]
  return reason ? `oil-shop-backup-${date}-${reason}.json` : `oil-shop-backup-${date}.json`
}

export interface BackupPersistence {
  collectBackup(): Record<string, string | null>
  applyBackup(data: Record<string, unknown>): number
  clearAllData(): void
}

export interface BackupOpsDeps {
  persistence: BackupPersistence
  deviceId: () => string
  now: () => Date
  /** Same signature as src/lib/downloadFile.ts's downloadFile — injected so a
   *  test never touches `document`/`URL.createObjectURL`. */
  download: (contents: string, filename: string, mimeType: string) => void
}

export function createBackupOps(deps: BackupOpsDeps) {
  function backupJson(): string {
    return JSON.stringify(deps.persistence.collectBackup(), null, 2)
  }

  /** The manual "Download backup" button, and ErrorBoundary/StorageErrorBanner's
   *  crash-recovery escape hatch — same collectBackup()/download(), different
   *  filename reason. */
  function exportBackup(reason?: SafetyBackupReason): void {
    deps.download(backupJson(), backupFilename(reason, deps.now()), 'application/json')
  }

  /**
   * A safety copy of the CURRENT data, downloaded right before an
   * irreversible action (restore, clear-all) actually replaces it — an undo
   * that exists even when nobody remembered to click "Download backup" first.
   */
  function downloadSafetyBackup(reason: 'before-restore' | 'before-clear' | 'before-recovery-restore'): void {
    exportBackup(reason)
  }

  /**
   * Restore a parsed backup file: safety-backup the CURRENT data first (so
   * "restore" is itself undoable), then rebind this device as the shop's
   * admin device (src/lib/auth/adminDeviceBinding.ts — harmless when this
   * device is already the bound one; it's what makes a restore double as the
   * recovery path for a locked-out device, see LockScreen.tsx), then apply.
   * That order is load-bearing: applying before the safety backup would mean
   * a bad restore has nothing to undo it with, and rebinding after applying
   * would restore the backup file's own (possibly different) device binding
   * for one write before immediately overwriting it — an avoidable extra op
   * every other device would have to reconcile.
   *
   * `reason` only changes the safety backup's filename — Settings' own
   * restore uses 'before-restore', LockScreen's locked-out recovery path
   * uses 'before-recovery-restore' so the two are distinguishable in a
   * folder full of them; the sequence itself is identical either way.
   */
  function restoreBackup(
    data: Record<string, unknown>,
    reason: 'before-restore' | 'before-recovery-restore' = 'before-restore'
  ): { restored: number } {
    downloadSafetyBackup(reason)
    const rebound = rebindAdminDevice(data, deps.deviceId())
    return { restored: deps.persistence.applyBackup(rebound) }
  }

  /** Full factory reset: safety-backup first, same reasoning as restoreBackup. */
  function clearAllShopData(): void {
    downloadSafetyBackup('before-clear')
    deps.persistence.clearAllData()
  }

  return { exportBackup, downloadSafetyBackup, restoreBackup, clearAllShopData }
}

// The one real instance the running app uses.
const defaultOps = createBackupOps({
  persistence: { collectBackup, applyBackup, clearAllData },
  deviceId: getDeviceId,
  now: () => new Date(),
  download: downloadFile,
})

export const exportBackup = defaultOps.exportBackup
export const restoreBackup = defaultOps.restoreBackup
export const clearAllShopData = defaultOps.clearAllShopData
