import { Wifi } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'

/**
 * Which role this device plays (main/follower) and, when it's the main, the
 * LAN address other devices reach it at. Role is only offered inside
 * Electron — a browser tab has no embedded server of its own to be a host
 * with, so it can only ever follow something.
 */
export function SyncRoleSection({
  isElectron,
  hostRole,
  lanUrl,
  onBecomeMain,
  onSelectFollower,
}: {
  isElectron: boolean
  hostRole: 'main' | 'follower'
  lanUrl: string | null
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
    </>
  )
}
