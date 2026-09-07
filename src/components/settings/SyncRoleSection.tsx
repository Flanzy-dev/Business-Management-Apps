import { Wifi } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import type { SyncPhase } from '../../store/syncStatusStore'
import type { VersionRelation } from '../../lib/update/versionCompare'
import { Button } from '../ui/Button'
import { ConnectedToStatus } from './ConnectedToStatus'

/**
 * Which role this device plays (main/follower) and, when it's the main, the
 * LAN address other devices reach it at — or, when it's a follower, which
 * host it's actually pointed at right now. Role is only offered inside
 * Electron — a browser tab has no embedded server of its own to be a host
 * with, so it can only ever follow something.
 *
 * `hostAddress`/`hostShopName` used to be null for a browser tab even while
 * it was actively synced with a host — a tab's own hostConfig is always the
 * DEFAULT_CONFIG (role 'main', no host) because it reaches its host through
 * window.location rather than a saved address (see hostConfig.ts's
 * resolveBaseUrl). That made the "Connected to" block never render on the
 * single device most likely to need it — a shop tablet. SyncCard.tsx now
 * resolves both through resolveBaseUrl()/settings-store instead of reading
 * hostConfig's raw fields directly, so this component always receives a
 * real address and shop name whenever `hostRole === 'follower'`, tab or not.
 *
 * Whether that connection is actually live, and whether the two sides run
 * the same app version, is a separate concern rendered by ConnectedToStatus
 * below — split out so this function's own complexity stays bounded to
 * "which role, which address" rather than also carrying live-status and
 * version-skew branching.
 */
export function SyncRoleSection({
  isElectron,
  hostRole,
  lanUrl,
  hostAddress,
  hostShopName,
  syncPhase,
  pendingCount,
  lastSyncedAt,
  versionRelation,
  hostVersion,
  onBecomeMain,
  onSelectFollower,
}: {
  isElectron: boolean
  hostRole: 'main' | 'follower'
  lanUrl: string | null
  /** The address this device is actually talking to, resolved via
   *  resolveBaseUrl() — see the component doc above. Only meaningful (and
   *  only ever non-null) when hostRole is 'follower'. */
  hostAddress: string | null
  hostShopName: string | null
  /** Forwarded to ConnectedToStatus — see that component for what each
   *  drives. */
  syncPhase: SyncPhase
  pendingCount: number
  lastSyncedAt: string | null
  versionRelation: VersionRelation
  hostVersion: string | null
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
        <ConnectedToStatus
          hostAddress={hostAddress}
          hostShopName={hostShopName}
          syncPhase={syncPhase}
          pendingCount={pendingCount}
          lastSyncedAt={lastSyncedAt}
          versionRelation={versionRelation}
          hostVersion={hostVersion}
        />
      )}
    </>
  )
}
