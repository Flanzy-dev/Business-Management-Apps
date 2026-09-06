import { useState } from 'react'
import { Search, Loader2, MonitorSmartphone } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'
import { useConfirmStore } from '../../store/confirmStore'
import { switchHost } from '../../lib/sync/engine'
import { readHostConfig, normalizeHostUrl, isSelfHost } from '../../lib/sync/hostConfig'
import { fetchInfo, login, UnauthorizedError, RateLimitedError } from '../../lib/sync/client'
import { canDiscoverHosts, findHosts, hostAddressFor, type DiscoveredHost } from '../../lib/sync/discovery'
import { requireAdminPassword } from '../../lib/auth/requireAdminPassword'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  // Carries the host's reported shopName (possibly null) so a save that
  // follows a successful login/test can persist it into HostConfig without
  // re-fetching — handleSaveWithToken doesn't require a prior test, so it
  // reads this rather than the network again.
  | { status: 'ok'; shopName: string | null }
  | { status: 'error'; message: string }

/**
 * The "follow another device" half of SyncCard: find the shop's host on this
 * network, prove who you are, and adopt its data.
 *
 * The credential here used to be the shop's generated LAN token, read off
 * the host's screen and typed in by hand. It is now the shop's own username
 * and password: POST /api/login (server/syncServer.ts) verifies them against
 * the shop's accounts and hands back the LAN token, which this device saves
 * exactly where the typed one used to go. Nobody transcribes a token, and a
 * device paired this way already holds the token if "Require token on LAN"
 * is switched on later.
 *
 * The token field survives as a fallback (`useToken` below) for two real
 * cases: a host running a build older than /api/login, and a shop that has
 * no account yet but does have a token.
 *
 * Split out of SyncCard so its own network-call state doesn't inflate the
 * parent's branch count for a block only one `effectiveRole` ever renders.
 */
export function SyncFollowerSetup({
  isElectron,
  lanUrl,
  onSaved,
}: {
  isElectron: boolean
  lanUrl: string | null
  /** Called after switchHost successfully re-points this device — the
   *  parent owns `hostRole` since it also drives the Role toggle above. */
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  const [hostInput, setHostInput] = useState(() => readHostConfig().host ?? '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tokenInput, setTokenInput] = useState(() => readHostConfig().token ?? '')
  const [useToken, setUseToken] = useState(false)
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })

  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState<DiscoveredHost[] | null>(null)

  // A follower pointed at its own address would be catastrophic on the shop
  // PC: local storage and the embedded LAN server's database are the same
  // SQLite file (see storageAdapter.ts), so "adopt the new host's data"
  // would wipe the very file it's trying to read a snapshot from. The
  // comparison itself lives in lib/sync/hostConfig.ts's isSelfHost, which is
  // node-testable; this component just supplies its own known addresses.
  const isOwnAddress = (host: string): boolean =>
    isSelfHost(host, [lanUrl, 'http://localhost:5174', 'http://127.0.0.1:5174'])

  const handleSearch = async () => {
    setSearching(true)
    setFound(null)
    // Drops this device's own host out of the results — it is the one
    // address that must never be picked here, and offering it as a tappable
    // row would be inviting the exact mistake isOwnAddress exists to catch.
    const hosts = (await findHosts()).filter((h) => !isOwnAddress(hostAddressFor(h)))
    setSearching(false)
    setFound(hosts)
    if (hosts.length === 1) {
      setHostInput(hostAddressFor(hosts[0]))
      setTestState({ status: 'idle' })
    }
  }

  /** Applies the switch once credentials (or a token) are settled. `token`
   *  is what this device will send from here on — the one login handed back,
   *  or the manually typed one. `shopName` is what SyncRoleSection's
   *  "Connected to" block will show until this device is re-paired. */
  const confirmAndSwitch = (token: string | null, shopName: string | null) => {
    requestConfirm(
      { title: t('sync.switchConfirmTitle'), message: t('sync.switchConfirmMessage'), confirmLabel: t('sync.saveHostButton') },
      async () => {
        if (!(await requireAdminPassword(t('auth.reauth.reasonChangeHost')))) return
        switchHost({ role: 'follower', host: hostInput.trim(), token, shopName })
        showToast({ tone: 'success', title: t('sync.forceResyncStarted') })
        onSaved()
      }
    )
  }

  const handleLogin = async () => {
    if (!hostInput.trim() || !username.trim() || !password) return
    if (isOwnAddress(hostInput)) {
      setTestState({ status: 'error', message: t('sync.sameHostError') })
      return
    }
    setTestState({ status: 'testing' })
    try {
      const result = await login(normalizeHostUrl(hostInput.trim()), username.trim(), password)
      setTestState({ status: 'ok', shopName: result.shopName })
      setPassword('')
      confirmAndSwitch(result.token, result.shopName)
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setTestState({ status: 'error', message: t('sync.loginFailedAuth') })
      } else if (e instanceof RateLimitedError) {
        setTestState({
          status: 'error',
          message: t('auth.lockScreen.tooManyAttempts', { seconds: Math.ceil(e.retryAfterMs / 1000) }),
        })
      } else {
        // Covers both "wrong address / host down" and a host too old to have
        // /api/login at all (it 404s) — the fallback below is the way out of
        // the second case, so the message points at it.
        setTestState({ status: 'error', message: t('sync.loginFailed') })
      }
    }
  }

  /** The fallback path: verify the address with the shop token instead of an
   *  account, exactly as this card did before /api/login existed. */
  const handleTestConnection = async () => {
    if (!hostInput.trim()) return
    if (isOwnAddress(hostInput)) {
      setTestState({ status: 'error', message: t('sync.sameHostError') })
      return
    }
    setTestState({ status: 'testing' })
    try {
      const info = await fetchInfo(normalizeHostUrl(hostInput.trim()), tokenInput.trim() || null)
      setTestState({ status: 'ok', shopName: info.shopName })
    } catch (e) {
      const message = e instanceof UnauthorizedError ? t('sync.testFailedAuth') : t('sync.testFailed')
      setTestState({ status: 'error', message })
    }
  }

  const handleSaveWithToken = () => {
    if (!hostInput.trim() || isOwnAddress(hostInput)) return
    // Doesn't require a prior successful test, so the name is whatever the
    // last successful test/login found (null if none was ever run) rather
    // than re-fetched here.
    confirmAndSwitch(tokenInput.trim() || null, testState.status === 'ok' ? testState.shopName : null)
  }

  const busy = testState.status === 'testing'

  return (
    <div className="space-y-3 p-4 bg-surface-sunken rounded-radius-sm">
      {!isElectron && <p className="text-2xs text-fg-3">{t('sync.browserRoleNote')}</p>}

      {canDiscoverHosts() && (
        <div className="space-y-2">
          <Button variant="secondary" size="sm" icon={searching ? Loader2 : Search} onClick={handleSearch} disabled={searching}>
            {searching ? t('sync.searching') : t('sync.findHostsButton')}
          </Button>

          {found?.length === 0 && <p className="text-2xs text-fg-3">{t('sync.foundNone')}</p>}

          {!!found?.length && (
            <div className="space-y-1.5">
              <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3">{t('sync.foundHostsLabel')}</p>
              {found.map((host) => {
                const address = hostAddressFor(host)
                const selected = hostInput.trim() === address
                return (
                  <button
                    key={address}
                    type="button"
                    onClick={() => {
                      setHostInput(address)
                      setTestState({ status: 'idle' })
                    }}
                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-radius-sm border text-left transition-colors focus-ring ${
                      selected ? 'border-accent bg-bg-3' : 'border-border-2 hover:border-border-3'
                    }`}
                  >
                    <MonitorSmartphone size={16} className="text-fg-3 flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm text-fg-1 truncate">{host.shopName ?? t('sync.unnamedShop')}</span>
                      <span className="block font-mono text-2xs text-fg-3">{address}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Input
        label={t('sync.hostAddressLabel')}
        placeholder={t('sync.hostAddressPlaceholder')}
        mono
        value={hostInput}
        onChange={(e) => {
          setHostInput(e.target.value)
          setTestState({ status: 'idle' })
        }}
      />

      {useToken ? (
        <>
          <Input
            label={t('sync.tokenLabel')}
            type="password"
            value={tokenInput}
            onChange={(e) => {
              setTokenInput(e.target.value)
              setTestState({ status: 'idle' })
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={handleTestConnection} disabled={busy || !hostInput.trim()}>
              {busy ? t('sync.statusSyncing') : t('sync.testButton')}
            </Button>
            {testState.status === 'ok' && <span className="text-sm text-success">{t('sync.testOk')}</span>}
            {testState.status === 'error' && <span className="text-sm text-danger">{testState.message}</span>}
          </div>
          <Button variant="primary" size="sm" onClick={handleSaveWithToken} disabled={!hostInput.trim()}>
            {t('sync.saveHostButton')}
          </Button>
        </>
      ) : (
        <>
          <p className="text-2xs text-fg-3">{t('sync.loginHint')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('sync.usernameLabel')}
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setTestState({ status: 'idle' })
              }}
            />
            <Input
              label={t('sync.passwordLabel')}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setTestState({ status: 'idle' })
              }}
            />
          </div>
          {testState.status === 'error' && <p className="text-sm text-danger">{testState.message}</p>}
          <Button
            variant="primary"
            size="sm"
            onClick={handleLogin}
            disabled={busy || !hostInput.trim() || !username.trim() || !password}
          >
            {busy ? t('sync.statusSyncing') : t('sync.loginButton')}
          </Button>
        </>
      )}

      <button
        type="button"
        onClick={() => {
          setUseToken((v) => !v)
          setTestState({ status: 'idle' })
        }}
        className="text-2xs text-fg-3 hover:text-fg-2 transition-colors underline"
      >
        {useToken ? t('sync.useAccountInstead') : t('sync.useTokenInstead')}
      </button>
    </div>
  )
}
