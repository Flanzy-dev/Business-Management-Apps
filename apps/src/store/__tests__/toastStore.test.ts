// A confirmation is read at a glance and can go quickly; an error has to be
// read and understood, so it stays longer — and any toast holds while the
// reader's pointer or focus is on it (WCAG 2.2.1). These are the regression
// guards for those timing rules.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useToastStore, TOAST_DURATION_MS } from '../uiStores'

const toast = (tone: 'success' | 'warning' | 'danger' | 'neutral') => ({ tone, title: `${tone} toast` })
const visible = () => useToastStore.getState().toast !== null

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.getState().dismiss()
})

afterEach(() => {
  useToastStore.getState().dismiss()
  vi.useRealTimers()
})

describe('toast duration by tone', () => {
  it('keeps confirmations at 3.5s', () => {
    useToastStore.getState().show(toast('success'))
    vi.advanceTimersByTime(TOAST_DURATION_MS.success - 1)
    expect(visible()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(visible()).toBe(false)
  })

  it('keeps an error up longer than a confirmation', () => {
    useToastStore.getState().show(toast('danger'))
    vi.advanceTimersByTime(TOAST_DURATION_MS.success + 1)
    expect(visible()).toBe(true)
    vi.advanceTimersByTime(TOAST_DURATION_MS.danger)
    expect(visible()).toBe(false)
  })

  it('orders the tones success <= warning <= danger', () => {
    expect(TOAST_DURATION_MS.success).toBeLessThanOrEqual(TOAST_DURATION_MS.warning)
    expect(TOAST_DURATION_MS.warning).toBeLessThanOrEqual(TOAST_DURATION_MS.danger)
  })
})

describe('replace and dismiss', () => {
  it('a second toast replaces the first and restarts the countdown', () => {
    useToastStore.getState().show(toast('success'))
    vi.advanceTimersByTime(3000)
    useToastStore.getState().show({ tone: 'success', title: 'second' })
    vi.advanceTimersByTime(3000) // would have expired the first one
    expect(useToastStore.getState().toast?.title).toBe('second')
    vi.advanceTimersByTime(500)
    expect(visible()).toBe(false)
  })

  it('dismiss() clears it immediately and leaves no timer behind', () => {
    useToastStore.getState().show(toast('danger'))
    useToastStore.getState().dismiss()
    expect(visible()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('pause and resume', () => {
  it('holds the toast past its normal duration while paused', () => {
    useToastStore.getState().show(toast('success'))
    vi.advanceTimersByTime(1000)
    useToastStore.getState().pause()
    vi.advanceTimersByTime(60_000)
    expect(visible()).toBe(true)
  })

  it('resume() dismisses after the time that was left', () => {
    useToastStore.getState().show(toast('danger')) // 8000ms
    vi.advanceTimersByTime(2000)
    useToastStore.getState().pause() // 6000ms left
    useToastStore.getState().resume()
    vi.advanceTimersByTime(5999)
    expect(visible()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(visible()).toBe(false)
  })

  it('never resumes with less than a short grace period', () => {
    useToastStore.getState().show(toast('success')) // 3500ms
    vi.advanceTimersByTime(3400)
    useToastStore.getState().pause() // 100ms left
    useToastStore.getState().resume()
    vi.advanceTimersByTime(1000)
    expect(visible()).toBe(true) // the reader just moved away; not gone in 100ms
    vi.advanceTimersByTime(600)
    expect(visible()).toBe(false)
  })

  it('resume() with no toast, or an already-running countdown, does nothing', () => {
    useToastStore.getState().resume()
    expect(vi.getTimerCount()).toBe(0)

    useToastStore.getState().show(toast('success'))
    useToastStore.getState().resume() // already running: must not stack a second timer
    expect(vi.getTimerCount()).toBe(1)
  })
})
