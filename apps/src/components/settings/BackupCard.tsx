import { useEffect, useState } from 'react'
import { useToastStore } from '../../store/uiStores'
import { useConfirmStore } from '../../store/uiStores'
import { backupStatus, type BackupInfo } from '../../lib/app/backupStatus'
import { formatDateTime } from '../../lib/format/dates'
import { pickJsonFile } from '../../lib/app/files'
import { exportBackup, restoreBackup } from '../../lib/ops/backupOps'
import { requireAdminPassword } from '../../lib/auth/requireAdminPassword'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'

/** Full-data JSON backup: download-everything, and restore-from-a-file. */
export function BackupCard() {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  // Asked of the desktop app's main process; a browser tab has no automatic
  // backups, and the line is simply absent there.
  const [info, setInfo] = useState<BackupInfo | null>(null)
  useEffect(() => {
    let cancelled = false
    window.electronAPI?.getBackupInfo?.().then(
      (result) => !cancelled && setInfo(result),
      () => undefined
    )
    return () => {
      cancelled = true
    }
  }, [])
  const status = backupStatus(info, new Date())

  const handleBackup = async () => {
    // The file this writes contains security-store verbatim — the admin
    // PBKDF2 hash, lanToken, workerLanToken and adminRecoveryCodeHash (see
    // src/lib/storage/persistence.ts's collectBackup and storageKeys.ts's
    // PERSISTED_STORES). Gating on the password closes that off; restore
    // already gated the other direction. No requestConfirm wrapper — unlike
    // restore/clear-all this destroys nothing, so a confirm dialog would be
    // pure friction.
    if (!(await requireAdminPassword(t('auth.reauth.reasonExportBackup')))) return
    exportBackup()
  }

  const handleRestore = () => {
    pickJsonFile(
      (data) => {
        requestConfirm(
          {
            title: t('settings.restoreConfirmTitle'),
            message: t('settings.restoreConfirmMessage'),
            confirmLabel: t('settings.restoreConfirmLabel'),
          },
          async () => {
            // Re-asks the admin password even though only an admin could
            // have reached this page — the confirm dialog above explains
            // the consequence, this is the final gate (src/lib/auth/
            // requireAdminPassword.ts). Resolves true immediately on a
            // device with no admin password set yet, so first-run restore
            // isn't blocked on a password that doesn't exist.
            if (!(await requireAdminPassword(t('auth.reauth.reasonRestoreBackup')))) return
            // restoreBackup (src/lib/ops/backupOps.ts) takes the safety
            // backup and rebinds this device as admin — in that order — then
            // applies. Restoring always re-binds admin to whichever device
            // performs it (src/lib/auth/adminDeviceBinding.ts) — harmless
            // here since this device is already the bound one (Settings is
            // admin-only, reachable only from it), and it's what makes the
            // same restore flow double as the recovery path when a
            // locked-out device does this instead (see LoginScreen.tsx's
            // restore step).
            const result = restoreBackup(data)
            if (result.blocked) {
              showToast({
                tone: 'danger',
                title: t(`settings.restoreBlocked.${result.blocked}`),
                description: t('settings.restoreBlocked.description'),
              })
              return
            }
            const { restored } = result
            if (restored === 0) {
              showToast({ tone: 'danger', title: t('settings.noDataFoundInBackup') })
              return
            }
            showToast({ tone: 'success', title: t('settings.dataRestoredTitle'), description: t('settings.reloading') })
            setTimeout(() => window.location.reload(), 800)
          }
        )
      },
      () => showToast({ tone: 'danger', title: t('settings.invalidBackupFile') })
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.backupTitle')}</CardTitle>
        <p className="text-caption">{t('settings.backupDescription')}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <Button variant="primary" onClick={handleBackup}>
            {t('settings.downloadBackupButton')}
          </Button>
          <Button variant="secondary" onClick={handleRestore}>
            {t('settings.restoreBackupButton')}
          </Button>
        </div>
        <p className="text-caption mt-4">{t('settings.backupHint')}</p>
        {status.kind === 'ok' && <p className="text-caption mt-1 tabular-nums">{t('settings.lastBackup', { date: formatDateTime(status.at) })}</p>}
        {status.kind === 'none' && <p className="text-caption mt-1">{t('settings.noBackupYet')}</p>}
        {status.kind === 'stale' && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {t('settings.backupStale', { date: formatDateTime(status.at), days: status.days })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
