import { Wifi } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { formatDateTime } from '../../lib/dates'
import { syncStatusLabel, SYNC_TONE_BY_PHASE } from '../../lib/syncStatus'
import type { SyncPhase } from '../../store/syncStatusStore'
import type { VersionRelation } from '../../lib/update/versionCompare'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

/**
 * Which role this device plays (main/follower) and, when it's the main, the
 * LAN address other devices reach it at — or, when it's a follower, which
 * host it's actually pointed at right now, whether that connection is
 * actually live, and whether the two sides are running the same app
 * version. Role is only offered inside Electron — a browser tab has no
 * embedded server of its own to be a host with, so it can only ever follow
 * something.
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
  /** Drives the live status badge next to the address — same vocabulary as
   *  the sidebar's SyncStatusIndicator (src/lib/syncStatus.ts), so
   *  "configured" (this section) and "actually working" (the badge) read
   *  as one fact instead of two separately-arrived-at ones. */
  syncPhase: SyncPhase
  pendingCount: number
  lastSyncedAt: string | null
  /** From src/lib/update/versionCompare.ts, comparing this device's
   *  APP_VERSION against the host's /api/info version. 'unknown' (an old
   *  host, or one that hasn't answered yet) renders nothing. */
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
        <div>
          <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('sync.connectedToLabel')}</p>
          <p className="text-sm text-text-primary">
            {hostShopName && <span>{hostShopName} — </span>}
            <span className="font-mono">{hostAddress}</span>
          </p>
          {syncPhase !== 'idle' && (
            <div className="mt-1.5 flex items-center gap-2">
              <Badge tone={SYNC_TONE_BY_PHASE[syncPhase]} dot>
                {syncStatusLabel(syncPhase, pendingCount, t)}
              </Badge>
              {lastSyncedAt && (
                <span className="text-2xs text-fg-3">
                  {t('sync.lastSyncedLabel')}: {formatDateTime(lastSyncedAt)}
                </span>
              )}
            </div>
          )}
          {versionRelation === 'client-older' && (
            <p className="mt-1.5 text-caption text-warning">
              {t('sync.versionBehindHost', { hostVersion: hostVersion ?? '' })}
            </p>
          )}
          {versionRelation === 'client-newer' && (
            <p className="mt-1.5 text-caption text-warning">
              {t('sync.versionAheadOfHost', { hostVersion: hostVersion ?? '' })}
            </p>
          )}
        </div>
      )}
    </>
  )
}
