import { Download, X } from 'lucide-react'
import { useUpdateStore } from '../store/updateStore'
import { isRestartRequired } from '../lib/update/updateState'
import { installUpdate } from '../lib/update/updateBridge'
import { requireAdminPassword } from '../lib/auth/requireAdminPassword'
import { useTranslation } from '../lib/i18n'

/**
 * A persistent banner for "a downloaded update is waiting to install" — same
 * rationale as StorageErrorBanner.tsx's header comment (a toast disappears
 * in 3.5s; this must not be missed), but accent-toned rather than danger:
 * this is good news, not a failure.
 *
 * Renders in Layout.tsx (not gated to Settings/Admin) because the download
 * itself is not admin-gated — a worker's shift is exactly when an update
 * might finish downloading. What IS gated is actually installing: pressing
 * "Restart & install" re-asks the admin password (requireAdminPassword),
 * the same pattern nine other consequential Settings actions already use,
 * because restarting the app mid-shift is a real interruption a worker
 * shouldn't trigger unilaterally.
 *
 * "Later" hides the banner for the rest of this session only
 * (useUpdateStore's bannerSnoozed, never persisted) — a shop that dismisses
 * today should be asked again on the next launch, not have this suppressed
 * forever. See the plan's decision: a strictly non-dismissable banner would
 * be MORE intrusive than StorageErrorBanner's own dismiss button, for a
 * strictly less urgent message.
 */
export function UpdateReadyBanner() {
  const { t } = useTranslation()
  const update = useUpdateStore((s) => s.update)
  const bannerSnoozed = useUpdateStore((s) => s.bannerSnoozed)
  const snoozeBanner = useUpdateStore((s) => s.snoozeBanner)

  if (!isRestartRequired(update) || bannerSnoozed) return null

  const handleInstall = async () => {
    if (!(await requireAdminPassword(t('auth.reauth.reasonInstallUpdate', { version: update.version })))) return
    await installUpdate()
  }

  return (
    <div className="flex items-start gap-3 border-b border-accent bg-accent-muted px-4 py-3 text-sm">
      <Download size={18} className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg-1">{t('update.bannerTitle', { version: update.version })}</p>
        <p className="text-fg-2">{t('update.bannerMessage')}</p>
      </div>
      <button
        onClick={handleInstall}
        className="shrink-0 rounded-radius-sm border border-accent px-3 py-1.5 font-medium text-accent hover:bg-accent/10 focus-ring"
      >
        {t('update.restartButton')}
      </button>
      <button
        onClick={snoozeBanner}
        aria-label={t('update.laterButton')}
        className="shrink-0 text-fg-3 hover:text-fg-1 focus-ring"
      >
        <X size={16} />
      </button>
    </div>
  )
}
