// Re-renders once a second while a login lockout is running, so the "try
// again in Ns" message actually counts down.
//
// Without this the number is rendered once and then frozen (see
// throttleErrorMessage in ./loginThrottle.ts), which during a 5-minute
// lockout reads as a stuck screen — the user has no way to tell whether the
// app is still waiting or has simply given up. All the arithmetic lives in
// secondsRemaining, which is pure and tested; this hook is only the timer.
import { useEffect, useState } from 'react'
import { secondsRemaining } from './loginThrottle'

/**
 * Seconds left until `retryAt` (an epoch-ms deadline, or null when nothing is
 * throttled). Returns 0 once elapsed and stops its interval there, so an idle
 * login screen isn't waking up every second forever.
 */
export function useThrottleCountdown(retryAt: number | null): number {
  const [seconds, setSeconds] = useState(() => secondsRemaining(retryAt))

  useEffect(() => {
    // Recompute immediately rather than waiting a tick: retryAt has just
    // changed, so the value from the previous deadline is on screen right now.
    const initial = secondsRemaining(retryAt)
    setSeconds(initial)
    if (initial <= 0) return

    const id = setInterval(() => {
      const left = secondsRemaining(retryAt)
      setSeconds(left)
      if (left <= 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [retryAt])

  return seconds
}
