import { useState } from 'react'
import { useToastStore } from '../../store/toastStore'
import { useConfirmStore } from '../../store/confirmStore'
import { switchHost } from '../../lib/sync/engine'
import { readHostConfig, normalizeHostUrl, isSelfHost } from '../../lib/sync/hostConfig'
import { fetchInfo, UnauthorizedError } from '../../lib/sync/client'
import { requireAdminPassword } from '../../lib/auth/requireAdminPassword'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

type TestState = { status: 'idle' } | { status: 'testing' } | { status: 'ok' } | { status: 'error'; message: string }

/**
 * The "follow another device" half of SyncCard: an address + optional shop
 * password to type into any device (the shop PC included), whether it's
 * pointed at another PC or a standalone server (see docs/ubuntu-server.md).
 * Split out of SyncCard so its own network-call state (host/token/testState)
 * doesn't inflate the parent's branch count for a block only one `effectiveRole`
 * ever renders.
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
  const [tokenInput, setTokenInput] = useState(() => readHostConfig().token ?? '')
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })

  // A follower pointed at its own address would be catastrophic on the shop
  // PC: local storage and the embedded LAN server's database are the same
  // SQLite file (see storageAdapter.ts), so "adopt the new host's data"
  // would wipe the very file it's trying to read a snapshot from. The
  // comparison itself lives in lib/sync/hostConfig.ts's isSelfHost, which is
  // node-testable; this component just supplies its own known addresses.
  const isOwnAddress = (host: string): boolean =>
    isSelfHost(host, [lanUrl, 'http://localhost:5174', 'http://127.0.0.1:5174'])

  const handleTestConnection = async () => {
    if (!hostInput.trim()) return
    if (isOwnAddress(hostInput)) {
      setTestState({ status: 'error', message: t('sync.sameHostError') })
      return
    }
    setTestState({ status: 'testing' })
    try {
      // Reaching /api/info at all is the whole answer: it throws if the
      // address is unreachable, and UnauthorizedError if the shop password is
      // wrong. The response body isn't shown — the address the user just
      // typed already tells them which server they hit.
      await fetchInfo(normalizeHostUrl(hostInput.trim()), tokenInput.trim() || null)
      setTestState({ status: 'ok' })
    } catch (e) {
      const message = e instanceof UnauthorizedError ? t('sync.testFailedAuth') : t('sync.testFailed')
      setTestState({ status: 'error', message })
    }
  }

  const handleSaveHost = () => {
    if (!hostInput.trim() || isOwnAddress(hostInput)) return
    requestConfirm(
      { title: t('sync.switchConfirmTitle'), message: t('sync.switchConfirmMessage'), confirmLabel: t('sync.saveHostButton') },
      async () => {
        if (!(await requireAdminPassword(t('auth.reauth.reasonChangeHost')))) return
        switchHost({ role: 'follower', host: hostInput.trim(), token: tokenInput.trim() || null })
        showToast({ tone: 'success', title: t('sync.forceResyncStarted') })
        onSaved()
      }
    )
  }

  return (
    <div className="space-y-3 p-4 bg-surface-sunken rounded-radius-sm">
      {!isElectron && <p className="text-2xs text-fg-3">{t('sync.browserRoleNote')}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <Input
          label={t('sync.tokenLabel')}
          type="password"
          value={tokenInput}
          onChange={(e) => {
            setTokenInput(e.target.value)
            setTestState({ status: 'idle' })
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleTestConnection} disabled={testState.status === 'testing' || !hostInput.trim()}>
          {testState.status === 'testing' ? t('sync.statusSyncing') : t('sync.testButton')}
        </Button>
        {testState.status === 'ok' && <span className="text-sm text-success">{t('sync.testOk')}</span>}
        {testState.status === 'error' && <span className="text-sm text-danger">{testState.message}</span>}
      </div>

      <Button variant="primary" size="sm" onClick={handleSaveHost} disabled={!hostInput.trim()}>
        {t('sync.saveHostButton')}
      </Button>
    </div>
  )
}
