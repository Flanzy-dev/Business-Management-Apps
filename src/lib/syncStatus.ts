// Display logic for SyncStatusIndicator, pulled out as pure functions so the
// per-phase decisions (which label, which dot color) are testable without a
// component render — same reasoning as every other lib/ display-decision
// module in this codebase (deleteOutcome.ts, receivables.ts's tone helpers).
import type { SyncPhase } from '../store/syncStatusStore'

export const SYNC_TONE_BY_PHASE: Record<SyncPhase, 'success' | 'accent' | 'warning' | 'danger' | 'neutral'> = {
  idle: 'neutral',
  syncing: 'accent',
  synced: 'success',
  offline: 'warning',
  error: 'danger',
  unauthorized: 'danger',
}

/** The status text for every phase but 'idle' — the component never calls
 *  this for 'idle', since it renders nothing at all in that phase. */
export function syncStatusLabel(
  phase: Exclude<SyncPhase, 'idle'>,
  pendingCount: number,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  switch (phase) {
    case 'synced':
      return t('sync.statusSynced')
    case 'syncing':
      return t('sync.statusSyncing')
    case 'error':
      return t('sync.statusError')
    case 'unauthorized':
      return t('sync.statusUnauthorized')
    case 'offline':
      return pendingCount > 0 ? t('sync.statusOfflinePending', { count: pendingCount }) : t('sync.statusOffline')
  }
}

/** Background color for the compact dot variant. */
export function syncStatusDotClass(phase: SyncPhase): string {
  if (phase === 'synced') return 'bg-success'
  if (phase === 'syncing') return 'bg-accent'
  if (phase === 'error' || phase === 'unauthorized') return 'bg-danger'
  return 'bg-warning'
}
