import { useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { useSecurityStore } from '../../store/securityStore'
import { useToastStore } from '../../store/toastStore'
import { useConfirmStore } from '../../store/confirmStore'
import { requireAdminPassword } from '../../lib/auth/requireAdminPassword'
import { generateShopToken } from '../../lib/auth/shopToken'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { AdminPasswordSection } from './AdminPasswordSection'
import { WorkerAccountSection } from './WorkerAccountSection'
import { RecoveryCodeSection } from './RecoveryCodeSection'

/**
 * Admin/Worker mode's password and the LAN sync token (src/store/authStore.ts,
 * src/store/securityStore.ts). Modeled on the Multi-device sync card's shape:
 * a generated secret, Copy/Regenerate, and an opt-in switch with a confirm
 * step before it's turned on. The password form itself lives in
 * AdminPasswordSection — a separate concern with its own five fields of
 * local state that never needs any of the LAN token state below it.
 */
export function SecurityCard() {
  const { t } = useTranslation()
  const { security, setLanToken, setLanTokenRequired } = useSecurityStore()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  const [tokenCopied, setTokenCopied] = useState(false)

  const handleGenerateToken = async () => {
    const reason = security.lanToken ? t('auth.reauth.reasonRegenerateToken') : t('auth.reauth.reasonGenerateToken')
    if (!(await requireAdminPassword(reason))) return
    setLanToken(generateShopToken())
    showToast({ tone: 'success', title: t('auth.security.tokenGeneratedToast') })
  }

  const handleCopyToken = () => {
    if (!security.lanToken) return
    navigator.clipboard?.writeText(security.lanToken)
    setTokenCopied(true)
    setTimeout(() => setTokenCopied(false), 1500)
  }

  const handleToggleRequireToken = (checked: boolean) => {
    if (!checked) {
      setLanTokenRequired(false)
      showToast({ tone: 'neutral', title: t('auth.security.tokenRequiredDisabledToast') })
      return
    }
    if (!security.lanToken) {
      showToast({ tone: 'warning', title: t('auth.security.noTokenYetWarning') })
      return
    }
    requestConfirm(
      {
        title: t('auth.security.enableConfirmTitle'),
        message: t('auth.security.enableConfirmMessage'),
        confirmLabel: t('auth.security.enableConfirmButton'),
      },
      async () => {
        if (!(await requireAdminPassword(t('auth.reauth.reasonEnableToken')))) return
        setLanTokenRequired(true)
        showToast({ tone: 'success', title: t('auth.security.tokenRequiredEnabledToast') })
      }
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('auth.security.title')}</CardTitle>
        <p className="text-caption">{t('auth.security.description')}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <AdminPasswordSection />

          <div className="pt-4 border-t border-border-1">
            <WorkerAccountSection />
          </div>

          <div className="pt-4 border-t border-border-1">
            <RecoveryCodeSection />
          </div>

          {/* LAN sync token */}
          <div className="pt-4 border-t border-border-1">
            <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
              {t('auth.security.lanTokenLabel')}
            </label>
            <p className="text-xs text-fg-3 mb-2">{t('auth.security.lanTokenHint')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input mono readOnly value={security.lanToken ?? ''} placeholder={t('auth.security.noTokenPlaceholder')} className="max-w-[220px]" />
              <Button variant="secondary" size="sm" icon={Copy} onClick={handleCopyToken} disabled={!security.lanToken}>
                {tokenCopied ? t('common.done') : t('auth.security.copyButton')}
              </Button>
              <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleGenerateToken}>
                {security.lanToken ? t('auth.security.regenerateButton') : t('auth.security.generateButton')}
              </Button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-text-secondary cursor-pointer w-fit">
              <input
                type="checkbox"
                className="accent-accent"
                checked={security.lanTokenRequired}
                onChange={(e) => handleToggleRequireToken(e.target.checked)}
              />
              {t('auth.security.requireTokenLabel')}
            </label>
          </div>

          <p className="pt-2 text-2xs text-fg-3 leading-relaxed">{t('auth.security.scopeNote')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
