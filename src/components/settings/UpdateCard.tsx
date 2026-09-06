import { useState } from 'react'
import { Loader2, RefreshCw, RotateCw } from 'lucide-react'
import { useUpdateStore } from '../../store/updateStore'
import { canAutoUpdate, checkForUpdates, installUpdate } from '../../lib/update/updateBridge'
import { isRestartRequired, downloadPercent } from '../../lib/update/updateState'
import { isAutoCheckEnabled, setAutoCheckEnabled } from '../../lib/update/autoCheckPreference'
import { requireAdminPassword } from '../../lib/auth/requireAdminPassword'
import { APP_VERSION } from '../../lib/appVersion'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'

/**
 * Settings > Updates: current version, a manual check, and the live
 * download/ready status driven by src/lib/update/updateState.ts's
 * UpdateState union — mirrors the Loader2-icon-swap spinner idiom
 * SyncFollowerSetup.tsx's "Search this WiFi" button uses.
 *
 * Renders null when !canAutoUpdate() — a LAN browser tab has no binary of
 * its own to update (see updateBridge.ts's canAutoUpdate doc). Admin-only
 * for free: /settings is already <RequireAdmin>-wrapped in App.tsx, same as
 * every other Settings section.
 */
export function UpdateCard() {
  const { t } = useTranslation()
  const update = useUpdateStore((s) => s.update)
  const [checking, setChecking] = useState(false)
  const [autoCheck, setAutoCheck] = useState(isAutoCheckEnabled)

  if (!canAutoUpdate()) return null

  const handleCheck = async () => {
    setChecking(true)
    try {
      await checkForUpdates()
    } finally {
      setChecking(false)
    }
  }

  const handleInstall = async () => {
    if (!isRestartRequired(update)) return // guards the version access below; button only renders in this state anyway
    if (!(await requireAdminPassword(t('auth.reauth.reasonInstallUpdate', { version: update.version })))) return
    await installUpdate()
  }

  const handleToggleAutoCheck = (checked: boolean) => {
    setAutoCheckEnabled(checked)
    setAutoCheck(checked)
  }

  const statusLine = (() => {
    switch (update.status) {
      case 'checking':
        return t('update.checkingLabel')
      case 'up-to-date':
        return t('update.upToDate')
      case 'available':
        return t('update.available', { version: update.version })
      case 'downloading':
        return t('update.downloading', { version: update.version, percent: downloadPercent(update) ?? 0 })
      case 'ready':
        return t('update.ready', { version: update.version })
      case 'error':
        return t('update.error')
      default:
        return null
    }
  })()

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('update.cardTitle')}</CardTitle>
        <p className="text-caption">{t('update.cardDescription')}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">{t('update.currentVersion', { version: APP_VERSION })}</p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={checking || update.status === 'checking' ? Loader2 : RefreshCw}
              onClick={handleCheck}
              disabled={checking || update.status === 'checking'}
            >
              {checking || update.status === 'checking' ? t('update.checkingLabel') : t('update.checkButton')}
            </Button>

            {isRestartRequired(update) && (
              <Button variant="primary" size="sm" icon={RotateCw} onClick={handleInstall}>
                {t('update.restartButton')}
              </Button>
            )}
          </div>

          {statusLine && (
            <p className={`text-caption ${update.status === 'error' ? 'text-danger' : ''}`}>{statusLine}</p>
          )}

          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer w-fit pt-2 border-t border-border-1">
            <input
              type="checkbox"
              className="accent-accent"
              checked={autoCheck}
              onChange={(e) => handleToggleAutoCheck(e.target.checked)}
            />
            {t('update.autoCheckLabel')}
          </label>
          <p className="text-2xs text-fg-3">{t('update.autoCheckHint')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
