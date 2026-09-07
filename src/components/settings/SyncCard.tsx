import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSyncStatusStore } from '../../store/syncStatusStore'
import { useToastStore } from '../../store/toastStore'
import { useConfirmStore } from '../../store/confirmStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUpdateStore } from '../../store/updateStore'
import { getDeviceId } from '../../lib/deviceId'
import { forceResync, switchHost } from '../../lib/sync/engine'
import { readHostConfig, resolveBaseUrl } from '../../lib/sync/hostConfig'
import { requireAdminPassword } from '../../lib/auth/requireAdminPassword'
import { compareAppVersions } from '../../lib/update/versionCompare'
import { APP_VERSION } from '../../lib/appVersion'
import { useTranslation } from '../../lib/i18n'
import { formatDate } from '../../lib/dates'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { SyncStatusIndicator } from '../SyncStatusIndicator'
import { SyncRoleSection } from './SyncRoleSection'
import { SyncFollowerSetup } from './SyncFollowerSetup'
import { SyncQuarantineBanner } from './SyncQuarantineBanner'
import { SyncDeviceList } from './SyncDeviceList'

const LAN_PORT = 5174

/**
 * The address another device on this WiFi should type into a browser to
 * reach the same data. Inside Electron (the desktop app's own window —
 * whether loaded via file:// in production or the Vite dev server URL in
 * dev, neither of which is an address another device could use), the
 * main process is asked directly (electron/main.ts's 'get-lan-address'
 * handler). A device that loaded the app over http some other way (a
 * tablet's browser) already knows its own address as window.location.
 */
function useLanUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getLanAddress().then((address) => {
        setUrl(address ? `http://${address}:${LAN_PORT}` : null)
      })
      return
    }
    setUrl(`${window.location.protocol}//${window.location.host}`)
  }, [])

  return url
}

/**
 * Multi-device sync (src/lib/sync/*): follow role, host address, and the
 * pending/quarantine counts that surface a sync problem before it becomes a
 * mystery. See docs/ubuntu-server.md for the standalone-server counterpart to
 * the address this card shows a host as.
 */
export function SyncCard() {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)
  const { phase, lastSyncedAt, pendingCount } = useSyncStatusStore()
  const lanUrl = useLanUrl()
  const shopSettingsName = useSettingsStore((s) => s.settings.shopName)
  const hostVersion = useUpdateStore((s) => s.hostVersion)

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI
  // A browser tab has no embedded server of its own — it can only ever
  // follow something, whatever hostRole happens to say (it defaults to
  // 'main' from hostConfig.ts's DEFAULT_CONFIG, since that field is really
  // only meaningful for the desktop app). The role toggle itself is hidden
  // for the same reason.

  const handleForceResync = () => {
    requestConfirm(
      { title: t('sync.forceResyncConfirmTitle'), message: t('sync.forceResyncConfirmMessage'), confirmLabel: t('sync.forceResyncButton') },
      () => {
        forceResync()
        showToast({ tone: 'success', title: t('sync.forceResyncStarted') })
      }
    )
  }

  // Which server this device follows — see src/lib/sync/hostConfig.ts.
  // `hostRole` stays its own bit of local state, separate from `saved.role`
  // below, because onSelectFollower is a UI-only toggle that reveals the
  // setup form without writing anything — deriving it from persisted state
  // would make "Use another device" a no-op until Save.
  const [hostRole, setHostRole] = useState(() => readHostConfig().role)
  const effectiveRole = isElectron ? hostRole : 'follower'

  // The persisted truth (host address, shopName) for the "Connected to"
  // block. Re-read explicitly after every write rather than trusted once at
  // mount — switchHost() writes storage but nothing else here re-reads it,
  // so without this a fresh pairing would keep showing the PREVIOUS host's
  // name until the page remounted.
  const [saved, setSaved] = useState(readHostConfig)
  const refreshSaved = () => setSaved(readHostConfig())

  // The address this device is ACTUALLY talking to, not just what's saved —
  // resolveBaseUrl() falls back to window.location when saved.host is null
  // (see hostConfig.ts's header), which is exactly the browser-tab case: a
  // tab's own hostConfig is always the DEFAULT_CONFIG, so `saved.host`
  // alone used to leave this card blank on the one device most likely to
  // check it. Meaningful for EVERY device, not just a follower — for a host
  // this resolves to its own embedded server, which is what
  // SyncDeviceList's /api/devices fetch below needs to query even on the
  // device serving that very endpoint.
  const syncBaseUrl = resolveBaseUrl(saved)
  const resolvedHostAddress = effectiveRole === 'follower' ? syncBaseUrl : null
  // Prefers the name frozen at pairing time (an explicit follower's own
  // HostConfig.shopName); falls back to the shop name already synced down
  // as ordinary shop data (settings-store) — which a browser tab always
  // has, having synced it like everything else. Empty/whitespace treated as
  // absent, same normalization hostConfig.ts's own reader applies.
  const resolvedShopName = saved.shopName ?? (shopSettingsName.trim() ? shopSettingsName : null)
  const versionRelation = compareAppVersions(APP_VERSION, hostVersion)

  const handleBecomeMain = async () => {
    // No existing requestConfirm step here (unlike handleSaveHost) — this
    // re-points the device back to its own data and clears its outbox,
    // which is real enough to gate but wasn't confirm-guarded before this
    // feature either, so the password prompt is the only new step added.
    if (!(await requireAdminPassword(t('auth.reauth.reasonBecomeMain')))) return
    switchHost({ role: 'main', host: null, token: null, shopName: null })
    setHostRole('main')
    refreshSaved()
    showToast({ tone: 'success', title: t('sync.roleMainStarted') })
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('sync.settingsTitle')}</CardTitle>
        <p className="text-caption">{t('sync.settingsDescription')}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Role — only offered inside Electron: a browser tab has no
              embedded server of its own to be a host with, so it can only
              ever follow something (see isElectron above). */}
          <SyncRoleSection
            isElectron={isElectron}
            hostRole={effectiveRole}
            lanUrl={lanUrl}
            hostAddress={resolvedHostAddress}
            hostShopName={resolvedShopName}
            syncPhase={phase}
            pendingCount={pendingCount}
            lastSyncedAt={lastSyncedAt}
            versionRelation={versionRelation}
            hostVersion={hostVersion}
            onBecomeMain={handleBecomeMain}
            onSelectFollower={() => setHostRole('follower')}
          />

          {/* Follower setup — an address + optional shop password to type
              into any device (the shop PC included), whether it's pointed
              at another PC or a standalone server (see docs/ubuntu-server.md). */}
          {effectiveRole === 'follower' && (
            <SyncFollowerSetup
              isElectron={isElectron}
              lanUrl={lanUrl}
              onSaved={() => {
                setHostRole('follower')
                refreshSaved()
              }}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('sync.deviceIdLabel')}</p>
              <p className="font-mono text-xs text-text-secondary truncate">{getDeviceId()}</p>
            </div>
            <div>
              <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('sync.lastSyncedLabel')}</p>
              <p className="text-text-primary">{lastSyncedAt ? formatDate(lastSyncedAt) : t('sync.lastSyncedNever')}</p>
            </div>
            <div>
              <SyncStatusIndicator />
            </div>
          </div>

          {pendingCount > 0 && (
            <p className="text-caption text-warning">{t('sync.pendingLabel', { count: pendingCount })}</p>
          )}

          <SyncQuarantineBanner lastSyncedAt={lastSyncedAt} />

          {/* Which devices are syncing with this shop, and when each last
              actually did — see server/db.ts's deviceActivity() for why
              "last did" is derived from the oplog rather than stored. */}
          <SyncDeviceList baseUrl={syncBaseUrl} />

          <Button variant="secondary" icon={RefreshCw} onClick={handleForceResync}>
            {t('sync.forceResyncButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
