// Small pure display-decision logic for LoginScreen.tsx, split out the way
// src/lib/syncStatus.ts's syncStatusLabel is: "which i18n key names this
// step's title" is a testable one-case-per-step lookup instead of a nested
// ternary buried in JSX.
import type { AuthStep } from './elevateStep'

/** LoginScreen's own extra steps, layered on top of the signIn/create
 *  decision every screen with an account gate has to make (AuthStep) — see
 *  elevateStep.ts's header. Kept separate from AuthStep itself: widening
 *  AuthStep would also change AdminElevateDialog, which has neither a
 *  sign-up nor a forgot-password affordance. */
export type LoginScreenStep = AuthStep | 'restore' | 'signUp' | 'forgot'

/** The i18n key for the title shown above the active step's form.
 *  'signIn' and 'restore' share the plain title — restore is reached FROM
 *  the sign-in screen and isn't its own named destination. */
export function loginScreenTitleKey(step: LoginScreenStep): string {
  switch (step) {
    case 'create':
      return 'auth.lockScreen.createTitle'
    case 'signUp':
      return 'auth.lockScreen.signUpTitle'
    case 'forgot':
      return 'auth.lockScreen.forgotTitle'
    default:
      return 'auth.lockScreen.title'
  }
}
