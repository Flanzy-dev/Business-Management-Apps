import { useTranslation } from '../../lib/i18n'
import { formatDateTime } from '../../lib/dates'
import { syncStatusLabel, SYNC_TONE_BY_PHASE } from '../../lib/syncStatus'
import type { SyncPhase } from '../../store/syncStatusStore'
import type { VersionRelation } from '../../lib/update/versionCompare'
import { Badge } from '../ui/Badge'

/**
 * The "am I actually synced, and with what" half of a follower's sync card —
 * split out of SyncRoleSection.tsx, which used to fold this in alongside the
 * role toggle and LAN URL sections. Those are a distinct concern (which
 * server this device is configured to talk to); this one is "is that
 * connection actually alive, and are the two sides on the same version" —
 * splitting them keeps each function's own complexity bounded to one
 * concern, rather than one function carrying both (see fallow's own
 * complexity finding on the pre-split SyncRoleSection, and the sibling
 * pattern already documented in .fallowrc.json's thresholdOverrides for
 * other flat-but-branchy presentational components).
 *
 * Rendered only when `hostRole === 'follower' && hostAddress` — see the
 * caller, SyncRoleSection.tsx.
 */
export function ConnectedToStatus({
  hostAddress,
  hostShopName,
  syncPhase,
  pendingCount,
  lastSyncedAt,
  versionRelation,
  hostVersion,
}: {
  hostAddress: string
  hostShopName: string | null
  /** Drives the live status badge — same vocabulary as the sidebar's
   *  SyncStatusIndicator (src/lib/syncStatus.ts), so "configured" (the
   *  address line) and "actually working" (the badge) read as one fact. */
  syncPhase: SyncPhase
  pendingCount: number
  lastSyncedAt: string | null
  /** From src/lib/update/versionCompare.ts. 'unknown' (an old host, or one
   *  that hasn't answered yet) renders nothing. */
  versionRelation: VersionRelation
  hostVersion: string | null
}) {
  const { t } = useTranslation()
  return (
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
  )
}
