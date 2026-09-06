import { Wifi } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'

/**
 * Which role this device plays (main/follower) and, when it's the main, the
 * LAN address other devices reach it at — or, when it's a follower, which
 * host it's actually pointed at right now. Role is only offered inside
 * Electron — a browser tab has no embedded server of its own to be a host
 * with, so it can only ever follow something.
 *
 * `hostAddress`/`hostShopName` are null for a browser tab even while
 * following something: a tab's own hostConfig is always the DEFAULT_CONFIG
 * (role 'main', no host) because it reaches its host through window.location
 * rather than a saved address — see hostConfig.ts's resolveBaseUrl. So the
 * block below only ever appears on Electron, which is also why it's gated on
 * `hostAddress` truthiness rather than `hostRole` alone.
 */
export function SyncRoleSection({
  isElectron,
  hostRole,
  lanUrl,
  hostAddress,
  hostShopName,
  onBecomeMain,
  onSelectFollower,
}: {
  isElectron: boolean
  hostRole: 'main' | 'follower'
  lanUrl: string | null
  /** The address this device is actually saved as following, or null (see
   *  the component doc above). Distinct from `hostRole` — which flips the
   *  instant "Use another device" is clicked, before anything is saved. */
  hostAddress: string | null
  hostShopName: string | null
  onBecomeMain: () => void
  onSelectFollower: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {isElectron && (
        <div>
          <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('sync.roleLabel')}</p>
          <div className="flex items-center gap-2 text-text-secondary">
            <Wifi size={18} />
            <Button variant={hostRole === 'main' ? 'primary' : 'secondary'} size="sm" onClick={onBecomeMain}>
              {t('sync.roleMain')}
            </Button>
            <Button variant={hostRole === 'follower' ? 'primary' : 'secondary'} size="sm" onClick={onSelectFollower}>
              {t('sync.roleFollower')}
            </Button>
          </div>
          <p className="mt-1 text-2xs text-fg-3">{hostRole === 'main' ? t('sync.roleMainHint') : t('sync.roleFollowerHint')}</p>
        </div>
      )}

      {hostRole === 'main' && (
        <div>
          <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('sync.lanUrlLabel')}</p>
          <p className="font-mono text-sm text-text-primary">{lanUrl ?? '—'}</p>
          <p className="mt-1 text-2xs text-fg-3">{t('sync.lanUrlHint')}</p>
        </div>
      )}

      {hostRole === 'follower' && hostAddress && (
        <div>
          <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('sync.connectedToLabel')}</p>
          <p className="text-sm text-text-primary">
            {hostShopName && <span>{hostShopName} — </span>}
            <span className="font-mono">{hostAddress}</span>
          </p>
        </div>
      )}
    </>
  )
}
