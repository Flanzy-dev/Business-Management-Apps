import { RefreshCw } from 'lucide-react'
import { useSecurityStore } from '../../store/securityStore'
import { useRecoveryCodeStore } from '../../store/recoveryCodeStore'
import { useToastStore } from '../../store/toastStore'
import { useConfirmStore } from '../../store/confirmStore'
import { requireAdminPassword } from '../../lib/auth/requireAdminPassword'
import { hashPassword } from '../../lib/auth/password'
import { generateRecoveryCode, normalizeRecoveryCode } from '../../lib/auth/recoveryCode'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'

/**
 * SecurityCard's recovery-code section, mirroring WorkerAccountSection's
 * shape: a status line plus one button behind requireAdminPassword.
 *
 * The code itself is never re-displayable — securityStore only ever holds
 * its PBKDF2 hash (src/lib/auth/recoveryCode.ts), same threat model as the
 * admin password itself — so "lost it" always means "regenerate", never
 * "show it again". Regenerating goes through the same
 * src/store/recoveryCodeStore.ts + RecoveryCodeDialog every other minting
 * path uses, so the one-time-display behaviour can't drift between them.
 */
export function RecoveryCodeSection() {
  const { t } = useTranslation()
  const { security, setAdminRecoveryCodeHash } = useSecurityStore()
  const showRecoveryCode = useRecoveryCodeStore((s) => s.show)
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  const isSet = !!security.adminRecoveryCodeHash

  const handleRegenerate = () => {
    requestConfirm(
      {
        title: t('auth.security.regenerateRecoveryCodeConfirmTitle'),
        message: t('auth.security.regenerateRecoveryCodeConfirmMessage'),
        confirmLabel: t('auth.security.regenerateRecoveryCodeConfirmButton'),
        tone: 'danger',
      },
      async () => {
        if (!(await requireAdminPassword(t('auth.reauth.reasonRegenerateRecoveryCode')))) return
        const code = generateRecoveryCode()
        setAdminRecoveryCodeHash(await hashPassword(normalizeRecoveryCode(code)))
        showRecoveryCode(code)
        showToast({ tone: 'success', title: t('auth.security.recoveryCodeRegeneratedToast') })
      }
    )
  }

  return (
    <div>
      <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
        {t('auth.security.recoveryCodeLabel')}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-text-secondary">
          {isSet ? t('auth.security.recoveryCodeSetStatus') : t('auth.security.recoveryCodeNotSetStatus')}
        </span>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRegenerate}>
          {t('auth.security.regenerateRecoveryCodeButton')}
        </Button>
      </div>
      <p className="mt-1 text-2xs text-fg-3">{t('auth.security.recoveryCodeHint')}</p>
    </div>
  )
}
