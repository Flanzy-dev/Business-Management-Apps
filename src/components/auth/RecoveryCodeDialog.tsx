import { useState } from 'react'
import { Copy, KeyRound } from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { useRecoveryCodeStore } from '../../store/recoveryCodeStore'
import { useTranslation } from '../../lib/i18n'

/**
 * The one and only place a plaintext admin recovery code
 * (src/lib/auth/recoveryCode.ts) is ever shown — mounted once in
 * src/components/Layout.tsx, reacting to src/store/recoveryCodeStore.ts's
 * pendingCode regardless of which action minted it (first-run account
 * creation, LoginScreen's sign-up step replacing the admin account, a
 * forgot-password reset, or Settings' Regenerate). See recoveryCodeStore's
 * header for why a shared store is what makes that possible: several of
 * those call sites sign the device in — unmounting LoginScreen — in the
 * same breath as minting the code, so no per-screen dialog could reliably
 * stay mounted long enough to show it.
 *
 * Deliberately not dismissible by Escape or the scrim — `onClose` is a
 * no-op and `title` is omitted so Dialog renders no ✕ button either (see
 * Dialog.tsx: the header, and its close button, only render when `title` is
 * set). The single "I've saved it" button is the only way out, because this
 * is the only moment this code will ever be shown again — securityStore
 * only ever holds its hash.
 */
export function RecoveryCodeDialog() {
  const { t } = useTranslation()
  const pendingCode = useRecoveryCodeStore((s) => s.pendingCode)
  const dismiss = useRecoveryCodeStore((s) => s.dismiss)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!pendingCode) return
    navigator.clipboard?.writeText(pendingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDismiss = () => {
    setCopied(false)
    dismiss()
  }

  return (
    <Dialog open={!!pendingCode} onClose={() => {}} size="sm">
      <div className="flex flex-col items-center text-center gap-3 py-1">
        <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent">
          <KeyRound size={20} />
        </div>
        <h2 className="font-display text-lg font-[540] text-fg-1">{t('auth.recoveryCode.title')}</h2>
        <p className="text-sm text-fg-2 leading-relaxed">{t('auth.recoveryCode.hint')}</p>

        <p className="w-full font-mono text-base tracking-wide bg-surface-input border border-border-2 rounded-radius-md py-2.5 px-3 text-fg-1 select-all">
          {pendingCode}
        </p>

        <Button variant="secondary" size="sm" icon={Copy} onClick={handleCopy} className="w-full">
          {copied ? t('common.done') : t('auth.recoveryCode.copyButton')}
        </Button>

        <p className="text-xs text-danger leading-relaxed">{t('auth.recoveryCode.warning')}</p>

        <Button variant="primary" className="w-full mt-1" onClick={handleDismiss}>
          {t('auth.recoveryCode.savedButton')}
        </Button>
      </div>
    </Dialog>
  )
}
