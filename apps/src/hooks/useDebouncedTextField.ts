import { useEffect, useState } from 'react'
import { useDebouncedCallback } from './useDebouncedCallback'

/**
 * "Mirror + debounce + reseed" — the pattern CheckoutTicket.tsx's discount
 * field, odometer field, and PercentRow each hand-declared identically: a
 * local text mirror (so a controlled input bound straight to a number
 * doesn't re-render "0" the instant the box is cleared, trapping the user
 * into deleting a lingering zero), a debounced commit (each committed write
 * round-trips through Electron IPC to a full SQLite flush — see
 * server/db.ts — so committing on every keystroke drops keystrokes), and a
 * reseed keyed on identity (e.g. order.id), not on the value itself, so
 * typing isn't fought by the very store write it triggers.
 *
 * Deliberately thin: sanitizing raw input, parsing it to a value, and
 * reconciling the box after a flush all stay the caller's own logic — those
 * three genuinely differ between call sites (digits-only vs decimal;
 * re-reading the store's clamped result vs re-displaying the typed value),
 * so folding them in here would blur real differences instead of removing
 * duplication.
 */
export function useDebouncedTextField<T>(
  initialText: string,
  resetKey: string,
  onCommit: (value: T) => void,
  debounceMs: number
): { text: string; setText: (text: string) => void; commit: { call: (value: T) => void; flush: () => void } } {
  const [text, setText] = useState(initialText)
  useEffect(() => {
    setText(initialText)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey (e.g. order.id) is the reseed trigger; initialText changing mid-type must not reseed
  }, [resetKey])
  const commit = useDebouncedCallback<[T]>(onCommit, debounceMs)
  return { text, setText, commit }
}
