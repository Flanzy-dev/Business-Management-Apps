import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { onStorageError } from '../lib/storageAdapter'
import { exportBackup } from '../lib/ops/backupOps'
import { useTranslation } from '../lib/i18n'

/**
 * A persistent (never auto-dismissing) banner shown when a storage write
 * fails — a synchronous IPC failure, or a deferred SQLite flush the Electron
 * main process reports after the fact (src/lib/storageAdapter.ts's
 * onStorageError). A toast is wrong here: it disappears in 3.5s and the user
 * must not miss "your last change may not be on disk". Offers the same
 * exportBackup() escape hatch ErrorBoundary does.
 */
export function StorageErrorBanner() {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  useEffect(() => onStorageError(() => setFailed(true)), [])

  if (!failed) return null

  const handleDownload = () => {
    exportBackup()
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-start gap-3 border-b border-danger bg-danger-muted px-4 py-3 text-sm">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg-1">{t('storageError.title')}</p>
        <p className="text-fg-2">{t('storageError.message')}</p>
      </div>
      <button
        onClick={handleDownload}
        className="shrink-0 rounded-radius-sm border border-danger px-3 py-1.5 font-medium text-danger hover:bg-danger/10 focus-ring"
      >
        {t('storageError.downloadBackup')}
      </button>
      <button
        onClick={() => setFailed(false)}
        aria-label={t('storageError.dismiss')}
        className="shrink-0 text-fg-3 hover:text-fg-1 focus-ring"
      >
        <X size={16} />
      </button>
    </div>
  )
}
