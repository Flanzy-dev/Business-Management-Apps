import { FormEvent, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { restoreBackup } from '../../lib/ops/backupOps'
import { readAdminPasswordHashFromBackup } from '../../lib/auth/adminDeviceBinding'
import { verifyAgainstHash, throttleErrorMessage } from '../../lib/auth/loginThrottle'
import { pickJsonFile } from '../../lib/pickJsonFile'
import { useTranslation } from '../../lib/i18n'

type RestorePhase = 'pickFile' | 'verifyPassword' | 'confirm'

/**
 * LockScreen's recovery path — restore a backup file onto a locked-out
 * device. Not gated by this device's own admin password — there usually
 * isn't one to check on a locked-out device, and the instinct to "just
 * require it first" is circular. Gated instead on the password embedded IN
 * THE BACKUP FILE ITSELF (adminDeviceBinding.ts's
 * readAdminPasswordHashFromBackup): a legitimate recovering admin needs that
 * same password to reach Admin afterward anyway, so this costs them
 * nothing, while closing what would otherwise be an unauthenticated,
 * physically-reachable "replace this device's shop data" button.
 *
 * Owns the whole three-phase flow's state — the largest single block of
 * state LockScreen used to hold — so the parent only ever mounts/unmounts
 * this component, resetting it fresh each time.
 */
export function RestoreRecoveryFlow({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<RestorePhase>('pickFile')
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handlePickFile = () => {
    pickJsonFile(
      (picked) => {
        const pickedHash = readAdminPasswordHashFromBackup(picked)
        if (!pickedHash) {
          setError(t('auth.lockScreen.notAShopBackup'))
          return
        }
        setData(picked)
        setHash(pickedHash)
        setPassword('')
        setError(null)
        setPhase('verifyPassword')
      },
      () => setError(t('auth.lockScreen.invalidBackupFile'))
    )
  }

  const handleVerifyPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || submitting || !hash) return
    setSubmitting(true)
    setError(null)
    const result = await verifyAgainstHash(password, hash)
    setSubmitting(false)
    if (!result.ok) {
      setPassword('')
      setError(throttleErrorMessage(result.retryAfterMs, t, 'auth.lockScreen.wrongPassword'))
      return
    }
    setPhase('confirm')
  }

  const handleConfirm = () => {
    if (!data) return
    // restoreBackup (src/lib/ops/backupOps.ts) takes a safety copy of THIS
    // device's current data before overwriting it, then rebinds this device
    // as admin, then applies — same sequence Settings' own restore uses.
    const { restored } = restoreBackup(data, 'before-recovery-restore')
    if (restored === 0) {
      setError(t('auth.lockScreen.noDataFoundInBackup'))
      setPhase('pickFile')
      setData(null)
      setHash(null)
      return
    }
    setSuccess(true)
    setTimeout(() => window.location.reload(), 800)
  }

  return (
    <div className="space-y-3">
      {phase === 'pickFile' && (
        <>
          <p className="text-xs text-fg-3 mb-1">{t('auth.lockScreen.restoreHint')}</p>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="button" className="w-full" onClick={handlePickFile}>
            {t('auth.lockScreen.restorePickFileButton')}
          </Button>
        </>
      )}

      {phase === 'verifyPassword' && (
        <form onSubmit={handleVerifyPassword} className="space-y-3">
          <p className="text-xs text-fg-3 mb-1">{t('auth.lockScreen.restoreVerifyHint')}</p>
          <Input
            label={t('auth.lockScreen.passwordLabel')}
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" className="w-full" disabled={submitting || !password}>
            {submitting ? t('auth.lockScreen.verifying') : t('auth.lockScreen.restoreVerifyButton')}
          </Button>
        </form>
      )}

      {phase === 'confirm' && !success && (
        <>
          <p className="text-xs text-danger mb-1 leading-relaxed">{t('auth.lockScreen.restoreConfirmWarning')}</p>
          <Button type="button" variant="danger" className="w-full" onClick={handleConfirm}>
            {t('auth.lockScreen.restoreConfirmButton')}
          </Button>
        </>
      )}

      {success && <p className="text-xs text-success text-center leading-relaxed">{t('auth.lockScreen.restoreDoneMessage')}</p>}

      {!success && (
        <button type="button" onClick={onBack} className="w-full text-center text-xs text-fg-3 hover:text-fg-2 transition-colors py-1">
          {t('common.cancel')}
        </button>
      )}
    </div>
  )
}
