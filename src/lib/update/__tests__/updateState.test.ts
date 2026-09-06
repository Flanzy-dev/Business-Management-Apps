import { describe, it, expect } from 'vitest'
import {
  reduceUpdate,
  isRestartRequired,
  downloadPercent,
  INITIAL_UPDATE_STATE,
  type UpdateState,
  type UpdateEvent,
} from '../updateState'

describe('reduceUpdate', () => {
  it('starts idle', () => {
    expect(INITIAL_UPDATE_STATE).toEqual({ status: 'idle' })
  })

  it('check-started records the trigger', () => {
    expect(reduceUpdate({ status: 'idle' }, { type: 'check-started', trigger: 'manual' })).toEqual({
      status: 'checking',
      trigger: 'manual',
    })
  })

  it('walks the manual happy path from idle to ready', () => {
    let state: UpdateState = { status: 'idle' }
    state = reduceUpdate(state, { type: 'check-started', trigger: 'manual' })
    state = reduceUpdate(state, { type: 'update-available', version: '1.1.5' })
    state = reduceUpdate(state, { type: 'download-progress', percent: 42 })
    state = reduceUpdate(state, { type: 'update-downloaded', version: '1.1.5' })
    expect(state).toEqual({ status: 'ready', version: '1.1.5' })
    expect(isRestartRequired(state)).toBe(true)
  })

  it('isRestartRequired is false at every earlier step of that path', () => {
    let state: UpdateState = { status: 'idle' }
    expect(isRestartRequired(state)).toBe(false)
    state = reduceUpdate(state, { type: 'check-started', trigger: 'manual' })
    expect(isRestartRequired(state)).toBe(false)
    state = reduceUpdate(state, { type: 'update-available', version: '1.1.5' })
    expect(isRestartRequired(state)).toBe(false)
    state = reduceUpdate(state, { type: 'download-progress', percent: 10 })
    expect(isRestartRequired(state)).toBe(false)
  })

  it('an auto-triggered offline error is invisible', () => {
    let state: UpdateState = { status: 'idle' }
    state = reduceUpdate(state, { type: 'check-started', trigger: 'auto' })
    state = reduceUpdate(state, { type: 'error', message: 'getaddrinfo ENOTFOUND github.com' })
    expect(state).toEqual({ status: 'idle' })
    expect(isRestartRequired(state)).toBe(false)
    expect(downloadPercent(state)).toBeNull()
  })

  it('a manual offline error is shown', () => {
    let state: UpdateState = { status: 'idle' }
    state = reduceUpdate(state, { type: 'check-started', trigger: 'manual' })
    state = reduceUpdate(state, { type: 'error', message: 'getaddrinfo ENOTFOUND github.com' })
    expect(state).toEqual({ status: 'error', message: 'getaddrinfo ENOTFOUND github.com' })
  })

  it('update-not-available is silent when auto, shown when manual', () => {
    let auto: UpdateState = { status: 'idle' }
    auto = reduceUpdate(auto, { type: 'check-started', trigger: 'auto' })
    auto = reduceUpdate(auto, { type: 'update-not-available', currentVersion: '1.1.3' })
    expect(auto).toEqual({ status: 'idle' })

    let manual: UpdateState = { status: 'idle' }
    manual = reduceUpdate(manual, { type: 'check-started', trigger: 'manual' })
    manual = reduceUpdate(manual, { type: 'update-not-available', currentVersion: '1.1.3' })
    expect(manual).toEqual({ status: 'up-to-date', currentVersion: '1.1.3' })
  })

  it('ready is absorbing: every event leaves it unchanged', () => {
    const ready: UpdateState = { status: 'ready', version: '1.1.5' }
    const events: UpdateEvent[] = [
      { type: 'check-started', trigger: 'auto' },
      { type: 'check-started', trigger: 'manual' },
      { type: 'error', message: 'boom' },
      { type: 'update-not-available', currentVersion: '1.1.5' },
      { type: 'download-progress', percent: 10 },
      { type: 'update-available', version: '1.1.6' },
    ]
    for (const event of events) {
      expect(reduceUpdate(ready, event)).toEqual({ status: 'ready', version: '1.1.5' })
    }
  })

  it('trigger survives through to a later error', () => {
    let state: UpdateState = { status: 'idle' }
    state = reduceUpdate(state, { type: 'check-started', trigger: 'manual' })
    state = reduceUpdate(state, { type: 'update-available', version: '1.1.5' })
    state = reduceUpdate(state, { type: 'error', message: 'download failed' })
    expect(state).toEqual({ status: 'error', message: 'download failed' })
  })

  it('download-progress from idle is ignored', () => {
    const state = reduceUpdate({ status: 'idle' }, { type: 'download-progress', percent: 50 })
    expect(state).toEqual({ status: 'idle' })
  })

  it('clamps percent to [0, 100]', () => {
    const base: UpdateState = { status: 'available', trigger: 'manual', version: '1.1.5' }
    expect(reduceUpdate(base, { type: 'download-progress', percent: -5 })).toEqual({
      status: 'downloading',
      trigger: 'manual',
      version: '1.1.5',
      percent: 0,
    })
    expect(reduceUpdate(base, { type: 'download-progress', percent: 140 })).toEqual({
      status: 'downloading',
      trigger: 'manual',
      version: '1.1.5',
      percent: 100,
    })
  })

  it('percent never decreases while downloading', () => {
    let state: UpdateState = { status: 'available', trigger: 'manual', version: '1.1.5' }
    state = reduceUpdate(state, { type: 'download-progress', percent: 80 })
    state = reduceUpdate(state, { type: 'download-progress', percent: 60 })
    expect(downloadPercent(state)).toBe(80)
  })

  it('update-downloaded wins from any state, including idle', () => {
    expect(reduceUpdate({ status: 'idle' }, { type: 'update-downloaded', version: '1.1.5' })).toEqual({
      status: 'ready',
      version: '1.1.5',
    })
  })

  it('is a pure function: does not mutate its input', () => {
    const input: UpdateState = { status: 'available', trigger: 'manual', version: '1.1.5' }
    const frozen = Object.freeze({ ...input })
    expect(() => reduceUpdate(frozen, { type: 'download-progress', percent: 10 })).not.toThrow()
    const result = reduceUpdate(input, { type: 'download-progress', percent: 10 })
    expect(result).not.toBe(input)
  })
})
