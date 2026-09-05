import { useEffect, useState } from 'react'
import { useSecurityStore } from '../store/securityStore'

/**
 * True once security-store's persisted data has actually been read back from
 * disk — false for the brief window right after the app starts.
 *
 * The race this closes: zustand's `persist` middleware defers rehydration by
 * at least one microtask, even though the underlying read
 * (src/lib/storageAdapter.ts) is itself synchronous — so immediately after
 * the store's module evaluates, `useSecurityStore.getState()` briefly holds
 * its DEFAULT state (every account field null), before flipping to the
 * shop's real data a tick later. src/store/authStore.ts's `resumeSession()`
 * runs during exactly that window (see its own header) — harmless for what
 * IT decides, since resolving "no admin data visible yet" just keeps a
 * stored session marker to retry rather than wrongly granting or deleting
 * it. But a form that lets someone submit real credentials during that same
 * window can lose to it: `signIn` sees the same empty security-store and
 * rejects a perfectly correct username/password as wrong, a moment before
 * the account data (and any remembered session the resume watcher was about
 * to honour) actually lands — which reads as "my login failed, and then I
 * was suddenly signed in as someone else" once the resume watcher catches
 * up a beat later.
 *
 * src/components/auth/LoginScreen.tsx holds its interactive forms back with
 * this until the race is over. In practice the delay is a single microtask
 * — imperceptible — but that removes the window entirely rather than
 * relying on nobody ever acting fast enough to hit it.
 */
export function useSecurityHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useSecurityStore.persist.hasHydrated())

  useEffect(() => {
    if (hydrated) return
    // onFinishHydration only notifies FUTURE hydrations — it does not fire
    // immediately for one already finished — so re-check here in case
    // hydration completed in the gap between the useState initializer above
    // and this effect running, or this hook would otherwise wait forever.
    if (useSecurityStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    return useSecurityStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  return hydrated
}
