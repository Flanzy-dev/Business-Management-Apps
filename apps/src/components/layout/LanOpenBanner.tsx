import { ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSecurityStore } from '../../store/securityStore'
import { readHostConfig } from '../../lib/sync/hostConfig'
import { isLanOpen } from '../../lib/auth/lanExposure'
import { useTranslation } from '../../lib/i18n'

/**
 * Persistent warning while the shop PC serves the shop's data to the WiFi with
 * no password in front of it. Not dismissable: it stays true until an admin
 * password exists, and the one action it offers (Settings) is how that gets
 * fixed. See lanExposure.ts for why the server itself can't just be locked.
 */
export function LanOpenBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const adminPasswordHash = useSecurityStore((s) => s.security.adminPasswordHash)
  const lanTokenRequired = useSecurityStore((s) => s.security.lanTokenRequired)

  const open = isLanOpen({
    hostsLanServer: typeof window !== 'undefined' && !!window.electronAPI,
    syncRole: readHostConfig().role,
    adminPasswordHash,
    lanTokenRequired,
  })
  if (!open) return null

  return (
    <div role="alert" className="flex items-start gap-3 border-b border-danger bg-danger-muted px-4 py-3 text-sm">
      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg-1">{t('security.lanOpenTitle')}</p>
        <p className="text-fg-2">{t('security.lanOpenMessage')}</p>
      </div>
      <button
        onClick={() => navigate('/settings')}
        className="shrink-0 rounded-radius-sm border border-danger px-3 py-1.5 font-medium text-danger hover:bg-danger/10 focus-ring"
      >
        {t('security.lanOpenAction')}
      </button>
    </div>
  )
}
