import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncer } from '../app/debouncer'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createDebouncer', () => {
  it('runs the call once the delay has passed, not before', () => {
    const run = vi.fn()
    const d = createDebouncer<[number]>(250)
    d.call(run, 5)
    vi.advanceTimersByTime(249)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledExactlyOnceWith(5)
    expect(d.pending).toBe(false)
  })

  it('collapses a burst of calls into one trailing call with the last arguments', () => {
    const run = vi.fn()
    const d = createDebouncer<[string]>(250)
    for (const v of ['5', '55', '553', '5530', '55300']) {
      d.call(run, v)
      vi.advanceTimersByTime(100)
    }
    vi.advanceTimersByTime(250)
    expect(run).toHaveBeenCalledExactlyOnceWith('55300')
  })

  describe('flush', () => {
    it('runs the waiting call immediately and cancels its timer', () => {
      const run = vi.fn()
      const d = createDebouncer<[number]>(250)
      d.call(run, 7)
      d.flush()
      expect(run).toHaveBeenCalledExactlyOnceWith(7)
      vi.advanceTimersByTime(1_000)
      expect(run).toHaveBeenCalledTimes(1) // the timer did not fire it a second time
    })

    it('does nothing when nothing is waiting', () => {
      const d = createDebouncer<[number]>(250)
      expect(() => d.flush()).not.toThrow()
    })
  })

  describe('cancel', () => {
    it('forgets the waiting call without running it', () => {
      const run = vi.fn()
      const d = createDebouncer<[number]>(250)
      d.call(run, 1)
      d.cancel()
      vi.advanceTimersByTime(1_000)
      expect(run).not.toHaveBeenCalled()
      expect(d.pending).toBe(false)
    })
  })

  // The reason this module exists: an edit belongs to the thing it was typed into.
  describe('the target of an edit', () => {
    it('commits to the order it was typed in, even if the caller has moved on by the time the timer fires', () => {
      const writes: string[] = []
      const setDiscount = (orderId: string) => (amount: number) => writes.push(`${orderId}:${amount}`)
      const d = createDebouncer<[number]>(250)

      d.call(setDiscount('order-A'), 20_000) // typed into order A…
      vi.advanceTimersByTime(100)
      // …then the cashier switches to order B (a re-render hands the hook order B's callback)
      vi.advanceTimersByTime(300)

      expect(writes).toEqual(['order-A:20000']) // never "order-B:20000"
    })

    it('a later call replaces the earlier one even when its target differs', () => {
      const writes: string[] = []
      const d = createDebouncer<[number]>(250)
      d.call((n) => writes.push(`A:${n}`), 1)
      d.call((n) => writes.push(`B:${n}`), 2)
      vi.advanceTimersByTime(250)
      expect(writes).toEqual(['B:2'])
    })

    it('flushing on leave commits an edit typed in the last quarter-second', () => {
      const writes: number[] = []
      const d = createDebouncer<[number]>(250)
      d.call((n) => writes.push(n), 55_300)
      // the component unmounts here: its cleanup flushes
      d.flush()
      expect(writes).toEqual([55_300])
    })
  })
})
