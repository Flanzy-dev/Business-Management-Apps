// The scheduling core of useDebouncedCallback, kept out of the hook so its rules
// can be tested (Vitest has no DOM, and a hook can't run without one).
//
// The rule that matters: a pending call runs the callback that was current WHEN
// IT WAS MADE, not whichever is current when the timer fires. A callback is a
// closure over the target of the edit — "set the discount of order X". If the
// timer used the latest one, typing in order X and then moving to order Y within
// the delay would write X's number onto Y; and a component that unmounts could
// not safely flush at all, so an edit typed in the last quarter-second before
// leaving was thrown away.

export interface Debouncer<Args extends unknown[]> {
  /** Schedule `run(...args)` after the delay, replacing any call still waiting. */
  call(run: (...args: Args) => void, ...args: Args): void
  /** Run the waiting call now, if there is one. */
  flush(): void
  /** Forget the waiting call without running it. */
  cancel(): void
  readonly pending: boolean
}

export function createDebouncer<Args extends unknown[]>(delayMs: number): Debouncer<Args> {
  let waiting: { timer: ReturnType<typeof setTimeout>; run: (...args: Args) => void; args: Args } | null = null

  return {
    call(run, ...args) {
      if (waiting) clearTimeout(waiting.timer)
      const timer = setTimeout(() => {
        waiting = null
        run(...args)
      }, delayMs)
      waiting = { timer, run, args }
    },
    flush() {
      if (!waiting) return
      const { timer, run, args } = waiting
      clearTimeout(timer)
      waiting = null
      run(...args)
    },
    cancel() {
      if (!waiting) return
      clearTimeout(waiting.timer)
      waiting = null
    },
    get pending() {
      return waiting !== null
    },
  }
}
