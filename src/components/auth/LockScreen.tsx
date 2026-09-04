// Full-screen, blocking mode-select/sign-in screen — rendered by App.tsx in
// place of <Routes> whenever authStore's mode is null (no mode has ever
// been chosen on this device). Deliberately outside Layout: it must render
// with no sidebar/topbar, and it must block BEFORE any route element
// mounts (a redirect from inside a restricted page would paint that page
// for a frame first). See App.tsx for the ordering that keeps the
// backfills and startSync() running behind this screen.
//
// ToastHost/ConfirmHost live in Layout, which isn't mounted here — errors
// are shown inline with local state instead (see each step's own
// component). This file is now just the step switch: what each step does
// lives in src/components/auth/ModeChooser.tsx, AdminSignInForm.tsx,
// AdminCreateForm.tsx, and RestoreRecoveryFlow.tsx.
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSecurityStore } from '../../store/securityStore'
import { useTranslation } from '../../lib/i18n'
import { getDeviceId } from '../../lib/deviceId'
import { ModeChooser } from './ModeChooser'
import { AdminSignInForm } from './AdminSignInForm'
import { AdminCreateForm } from './AdminCreateForm'
import { RestoreRecoveryFlow } from './RestoreRecoveryFlow'

type Step = 'choose' | 'adminSignIn' | 'adminCreate' | 'restore'

export default function LockScreen() {
  const { t } = useTranslation()
  const enterWorkerMode = useAuthStore((s) => s.enterWorkerMode)

  // Primitive selectors, not the whole `security` object — this screen
  // shouldn't re-render on unrelated lanToken/lanTokenRequired sync
  // traffic. getDeviceId() is safe to call in the component body (see
  // src/lib/deviceId.ts) but deliberately not at module scope: it touches
  // localStorage with no try/catch, and this project's Vitest runs with no
  // DOM, so a module-level call would throw on import for any future test
  // that imports this file.
  const adminPasswordHash = useSecurityStore((s) => s.security.adminPasswordHash)
  const adminDeviceId = useSecurityStore((s) => s.security.adminDeviceId)
  const adminUsername = useSecurityStore((s) => s.security.adminUsername)
  const deviceId = getDeviceId()

  // See src/store/securityStore.ts's adminDeviceId doc comment: unbound
  // (null/undefined) means any device may attempt, matching both "no admin
  // account exists yet anywhere" and "an existing shop upgrading from
  // before this field existed."
  const canUseAdminHere = !adminPasswordHash || !adminDeviceId || adminDeviceId === deviceId
  // The recovery entry point: shown when there's shop data to bring in
  // fresh, or when this specific device is the one locked out. Hidden when
  // this device already is (or would become) the admin device — Settings'
  // own restore already covers that case, gated behind an active admin
  // session instead of a backup-file password.
  const canRestoreHere = !adminPasswordHash || (!!adminDeviceId && adminDeviceId !== deviceId)

  const [step, setStep] = useState<Step>('choose')

  const openAdminFlow = () => {
    if (!canUseAdminHere) return
    setStep(adminPasswordHash ? 'adminSignIn' : 'adminCreate')
  }

  const backToChoose = () => setStep('choose')

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-1 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display font-semibold text-2xl tracking-wide text-fg-1">
            SURYA<span className="text-accent">BARU</span>
          </h1>
          <p className="mt-1.5 text-sm text-fg-3">{t('auth.lockScreen.title')}</p>
        </div>

        {step === 'choose' && (
          <ModeChooser
            onEnterWorker={enterWorkerMode}
            canUseAdmin={canUseAdminHere}
            onOpenAdmin={openAdminFlow}
            canRestore={canRestoreHere}
            onOpenRestore={() => setStep('restore')}
          />
        )}

        {step === 'adminSignIn' && <AdminSignInForm adminUsername={adminUsername} onBack={backToChoose} />}

        {step === 'adminCreate' && <AdminCreateForm onBack={backToChoose} />}

        {step === 'restore' && <RestoreRecoveryFlow onBack={backToChoose} />}

        <p className="mt-8 text-center text-2xs text-fg-3 leading-relaxed">{t('auth.lockScreen.scopeNote')}</p>
      </div>
    </div>
  )
}
