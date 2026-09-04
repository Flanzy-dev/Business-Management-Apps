import { useSyncStatusStore } from '../store/syncStatusStore'
import { syncStatusLabel, syncStatusDotClass, SYNC_TONE_BY_PHASE } from '../lib/syncStatus'
import { useTranslation } from '../lib/i18n'
import { Badge } from './ui/Badge'

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

  const label = syncStatusLabel(phase, pendingCount, t)

  if (compact) {
    return (
      <span title={label} className="flex items-center justify-center">
        <span className={`w-2 h-2 rounded-full ${syncStatusDotClass(phase)}`} />
      </span>
    )
  }

  return (
    <Badge tone={SYNC_TONE_BY_PHASE[phase]} dot className="w-full justify-center normal-case font-normal tracking-normal">
      {label}
    </Badge>
  )
}
