import { useSyncStatusStore, SyncPhase } from '../store/syncStatusStore'
import { useTranslation } from '../lib/i18n'
import { Badge } from './ui/Badge'

const TONE_BY_PHASE: Record<SyncPhase, 'success' | 'accent' | 'warning' | 'danger' | 'neutral'> = {
  idle: 'neutral',
  syncing: 'accent',
  synced: 'success',
  offline: 'warning',
  error: 'danger',
  unauthorized: 'danger',
}

/**
 * Sidebar readout for the multi-device sync engine (src/lib/sync/engine.ts).
 * Deliberately visible rather than a silent background process — a shop
 * relying on this for consistent inventory across devices needs to see at a
 * glance whether it's actually working, especially "offline, N pending".
 */
export function SyncStatusIndicator({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { phase, pendingCount } = useSyncStatusStore()

  if (phase === 'idle') return null

  const label =
    phase === 'synced'
      ? t('sync.statusSynced')
      : phase === 'syncing'
        ? t('sync.statusSyncing')
        : phase === 'error'
          ? t('sync.statusError')
          : phase === 'unauthorized'
            ? t('sync.statusUnauthorized')
            : pendingCount > 0
              ? t('sync.statusOfflinePending', { count: pendingCount })
              : t('sync.statusOffline')

  if (compact) {
    return (
      <span title={label} className="flex items-center justify-center">
        <span className={`w-2 h-2 rounded-full ${phase === 'synced' ? 'bg-success' : phase === 'syncing' ? 'bg-accent' : phase === 'error' || phase === 'unauthorized' ? 'bg-danger' : 'bg-warning'}`} />
      </span>
    )
  }

  return (
    <Badge tone={TONE_BY_PHASE[phase]} dot className="w-full justify-center normal-case font-normal tracking-normal">
      {label}
    </Badge>
  )
}
