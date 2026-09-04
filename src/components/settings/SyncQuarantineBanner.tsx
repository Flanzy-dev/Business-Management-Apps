import { useState, useEffect } from 'react'
import { readQuarantine, clearQuarantine } from '../../lib/sync/quarantine'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'

/**
 * Ops a remote device sent that this device refused to apply (see
 * src/lib/sync/quarantine.ts's header for why this is tracked outside a
 * zustand store). Split out of SyncCard so its own re-read effect and count
 * state don't add to the parent's branch count for a banner that's usually
 * not even rendered.
 */
export function SyncQuarantineBanner({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const { t } = useTranslation()
  // Re-read whenever lastSyncedAt moves, since that's this page's existing
  // proxy for "a sync just happened, this may have changed" — quarantine.ts
  // has no change-notification of its own.
  const [quarantineCount, setQuarantineCount] = useState(0)
  useEffect(() => {
    setQuarantineCount(readQuarantine().length)
  }, [lastSyncedAt])

  if (quarantineCount === 0) return null

  return (
    <div className="p-3 bg-danger-muted rounded-radius-sm space-y-1">
      <p className="text-caption text-danger">{t('sync.quarantineLabel', { count: quarantineCount })}</p>
      <p className="text-2xs text-fg-3">{t('sync.quarantineHint')}</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          clearQuarantine()
          setQuarantineCount(0)
        }}
      >
        {t('sync.quarantineClearButton')}
      </Button>
    </div>
  )
}
