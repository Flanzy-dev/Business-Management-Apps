import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a stable [call, flush] pair wrapping `callback` so repeated calls
 * within `delayMs` of each other collapse into one trailing invocation —
 * the piece CheckoutTicket's discount/tax fields need to stay responsive to
 * type into: local UI state can update on every keystroke, while the actual
 * store write (which round-trips through Electron IPC to a full SQLite
 * flush, see server/db.ts) only fires once typing pauses.
 *
 * `flush()` runs any pending call immediately and cancels the timer — for
 * onBlur/Enter, where the value must be committed before the field reseeds
 * from the store, not up to PERSIST_DEBOUNCE_MS later.
 *
 * Always calls the *latest* `callback` passed in, not the one captured when
 * the timer was scheduled, so callers don't need to worry about stale
 * closures the way a raw `useRef` + `setTimeout` would.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number
): { call: (...args: Args) => void; flush: () => void } {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const pendingRef = useRef<{ timer: ReturnType<typeof setTimeout>; args: Args } | null>(null)

  const flush = useCallback(() => {
    const pending = pendingRef.current
    if (!pending) return
    clearTimeout(pending.timer)
    pendingRef.current = null
    callbackRef.current(...pending.args)
  }, [])

  const call = useCallback(
    (...args: Args) => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timer)
      const timer = setTimeout(() => {
        pendingRef.current = null
        callbackRef.current(...args)
      }, delayMs)
      pendingRef.current = { timer, args }
    },
    [delayMs]
  )

  // Unmounting mid-debounce (e.g. switching tickets) must not fire a commit
  // into whatever order is current by then — drop it, don't flush it.
  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timer)
    }
  }, [])

  return { call, flush }
}
