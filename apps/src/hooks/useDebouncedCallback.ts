import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createDebouncer } from '../lib/app/debouncer'

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
 * A pending call runs the `callback` that was current when `call` was made
 * (see lib/app/debouncer.ts for why), so it always lands on the thing that was
 * being edited — and so it can be flushed when the component unmounts, instead
 * of an edit typed just before leaving being lost.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number
): { call: (...args: Args) => void; flush: () => void } {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const debouncer = useMemo(() => createDebouncer<Args>(delayMs), [delayMs])

  const call = useCallback((...args: Args) => debouncer.call(callbackRef.current, ...args), [debouncer])
  const flush = useCallback(() => debouncer.flush(), [debouncer])

  // Leaving mid-debounce commits what was typed rather than dropping it.
  useEffect(() => () => debouncer.flush(), [debouncer])

  return { call, flush }
}
