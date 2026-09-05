// Full-screen, blocking login — rendered by App.tsx in place of <Routes>
// whenever authStore's mode is null (signed out: a fresh install, a device
// that pressed Switch account, or a follower whose shop data hasn't landed
// yet). Deliberately outside Layout: it must render with no sidebar/topbar,
// and it must block BEFORE any route element mounts (a redirect from inside
// a restricted page would paint that page for a frame first). See App.tsx
// for the ordering that keeps the backfills and startSync() running behind
// this screen.
//
// ToastHost/ConfirmHost live in Layout, which isn't mounted here — errors
// are shown inline with local state instead (see each step's own component).
//
// This used to be LockScreen, and used to open on a three-card chooser
// ("Who is using this device?"). It is now what an ordinary application
// shows: the sign-in form itself, with the one-tap worker entry demoted to a
// secondary link beneath it. The i18n namespace is still `auth.lockScreen.*`
// — renaming it would touch PasswordPromptHost, RestoreRecoveryFlow and both
// Settings account forms purely cosmetically, across call sites where a
// missing key fails silently (t() takes a plain string; nothing type-checks
// it).
import { useState } from 'react'
import { HardHat } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSecurityStore } from '../../store/securityStore'
import { useSecurityHydrated } from '../../hooks/useSecurityHydrated'
import { useTranslation } from '../../lib/i18n'
import { resolveAuthStep, type AuthStep } from '../../lib/auth/elevateStep'
import { SignInForm } from './SignInForm'
import { AdminCreateForm } from './AdminCreateForm'
import { RestoreRecoveryFlow } from './RestoreRecoveryFlow'
import { SignUpForm } from './SignUpForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'

// 'restore', 'signUp' and 'forgot' are this screen's own extra steps,
// layered on top of the signIn/create decision every screen with an account
// gate has to make — see src/lib/auth/elevateStep.ts, shared with
// AdminElevateDialog so the two can't drift on what "there's no account
// yet" means. AuthStep itself stays exactly 'signIn' | 'create': widening it
// would also change AdminElevateDialog, which has neither a sign-up nor a
// forgot-password affordance.
type Step = AuthStep | 'restore' | 'signUp' | 'forgot'

export default function LoginScreen() {
  const { t } = useTranslation()
  const enterWorkerMode = useAuthStore((s) => s.enterWorkerMode)

  // A primitive selector, not the whole `security` object — this screen
  // shouldn't re-render on unrelated lanToken/lanTokenRequired sync traffic.
  const adminPasswordHash = useSecurityStore((s) => s.security.adminPasswordHash)
  const adminRecoveryCodeHash = useSecurityStore((s) => s.security.adminRecoveryCodeHash)

  // False for the first microtask after this screen mounts, even on an
  // ordinary single-device launch — see useSecurityHydrated's header. Until
  // this flips true, adminPasswordHash above is guaranteed to be null
  // regardless of what the shop's real data says, which would otherwise let
  // someone submit a perfectly correct sign-in a moment before that data
  // (and any remembered session about to auto-resume) actually lands, and
  // see it rejected as wrong. Gates the interactive content below; the
  // wordmark still renders immediately so the screen never looks blank.
  const hydrated = useSecurityHydrated()

  // Derived, NOT seeded into useState — even lazily. See resolveAuthStep's
  // header for why a cold follower makes that unsafe. The override exists
  // for steps the user picked explicitly (restore, sign-up, forgot), and for
  // the counter-hazard below.
  const [override, setOverride] = useState<Step | null>(null)
  // 'restore'/'signUp'/'forgot' are this screen's own steps, layered on top
  // of resolveAuthStep's signIn/create decision — only an override of
  // 'signIn' | 'create' | null (or none of these three) ever reaches it.
  const step: Step =
    override === 'restore' || override === 'signUp' || override === 'forgot'
      ? override
      : resolveAuthStep(adminPasswordHash, override)

  // A note shown once, above the sign-in form, after an action taken from a
  // step that no longer exists once this returns to sign-in (SignUpForm's
  // worker branch, which deliberately does not sign the device in — see its
  // own header for why). Cleared on any other navigation so it can't go
  // stale and reappear after an unrelated trip through Restore or Sign up.
  const [notice, setNotice] = useState<string | null>(null)

  // The other half of that trade-off: a purely derived step would yank
  // someone out of a half-typed create form the instant sync lands. The
  // create form reports its first keystroke here, which pins the step. An
  // untouched form still auto-flips to sign-in, which is what we want.
  const pinToCreate = () => setOverride((current) => current ?? 'create')

  const backToSignIn = () => {
    setNotice(null)
    setOverride(null)
  }

  const handleSignUpDone = (message: string) => {
    setOverride(null)
    setNotice(message)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-1 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display font-semibold text-2xl tracking-wide text-fg-1">
            SURYA<span className="text-accent">BARU</span>
          </h1>
          {hydrated && (
            <p className="mt-1.5 text-sm text-fg-3">
              {t(
                step === 'create'
                  ? 'auth.lockScreen.createTitle'
                  : step === 'signUp'
                    ? 'auth.lockScreen.signUpTitle'
                    : step === 'forgot'
                      ? 'auth.lockScreen.forgotTitle'
                      : 'auth.lockScreen.title'
              )}
            </p>
          )}
        </div>

        {!hydrated ? (
          <p className="text-center text-xs text-fg-3">{t('auth.lockScreen.loadingAccounts')}</p>
        ) : (
          <>
            {step === 'signIn' && notice && (
              <p className="mb-3 text-xs text-success text-center leading-relaxed">{notice}</p>
            )}

            {step === 'signIn' && <SignInForm />}
            {step === 'create' && <AdminCreateForm onDirty={pinToCreate} />}
            {step === 'restore' && <RestoreRecoveryFlow onBack={backToSignIn} />}
            {step === 'signUp' && <SignUpForm onBack={backToSignIn} onDone={handleSignUpDone} />}
            {step === 'forgot' && <ForgotPasswordForm onBack={backToSignIn} />}

            {/* The worker entry lives here rather than inside SignInForm because
                it has to appear under the first-run create form too — a shop that
                just installed still needs a technician taking work orders before
                the owner has finished setting an account up. */}
            {step !== 'restore' && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-border-1" />
                  <span className="text-2xs uppercase font-semibold tracking-wide text-fg-3">
                    {t('auth.lockScreen.orDivider')}
                  </span>
                  <div className="flex-1 h-px bg-border-1" />
                </div>

                <button
                  onClick={enterWorkerMode}
                  className="w-full flex items-center gap-2 justify-center p-2.5 bg-surface-card border border-border-2 rounded-radius-md hover:border-border-3 transition-colors text-sm text-fg-2 focus-ring"
                >
                  <HardHat size={16} />
                  {t('auth.lockScreen.continueAsWorker')}
                </button>
              </>
            )}

            {/* Where accounts come from. Only on the sign-in step: on the create
                step the person reading it IS the admin, mid-setup, and on every
                other step it's noise. Sign-up is safe to show unconditionally
                here — reaching step 'signIn' at all already means adminPasswordHash
                is set (resolveAuthStep only returns it in that case), which is
                exactly the condition SignUpForm needs to require authorization
                rather than sit fully open. Forgot-password is gated on its own
                — a shop with no recovery code has nothing to check a code
                against, and a dead-end link is worse than no link. */}
            {step === 'signIn' && (
              <div className="mt-6 space-y-1">
                <button
                  onClick={() => setOverride('signUp')}
                  className="w-full text-center text-2xs text-fg-3 hover:text-fg-2 transition-colors py-1 focus-ring rounded-radius-xs"
                >
                  {t('auth.lockScreen.signUpEntryLabel')}
                </button>
                {!!adminRecoveryCodeHash && (
                  <button
                    onClick={() => setOverride('forgot')}
                    className="w-full text-center text-2xs text-fg-3 hover:text-fg-2 transition-colors py-1 focus-ring rounded-radius-xs"
                  >
                    {t('auth.lockScreen.forgotEntryLabel')}
                  </button>
                )}
              </div>
            )}

            {/* Recovery is offered only while this device has no admin account to
                sign into — a fresh install, or one whose shop data hasn't arrived.
                Once an account exists here, Settings' own restore covers it,
                gated behind an active admin session instead of a backup file. */}
            {!adminPasswordHash && step !== 'restore' && (
              <button
                onClick={() => setOverride('restore')}
                className="mt-4 w-full text-center text-xs text-fg-3 hover:text-fg-2 transition-colors py-1 focus-ring rounded-radius-xs"
              >
                {t('auth.lockScreen.restoreEntryLabel')}
              </button>
            )}
          </>
        )}

        <p className="mt-8 text-center text-2xs text-fg-3 leading-relaxed">{t('auth.lockScreen.scopeNote')}</p>
      </div>
    </div>
  )
}
