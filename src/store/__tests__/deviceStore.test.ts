// registerSelf's idempotency is the property that makes the 'list' sync
// kind safe for this store (see deviceStore.ts's header): each device only
// ever writes its own row, so two devices' concurrent registrations can
// never target the same row. These tests are the regression guard for that
// invariant, plus the ordinary rename/remove CRUD.
import { describe, it, expect, beforeEach } from 'vitest'
import { useDeviceStore } from '../deviceStore'
import { getDeviceId } from '../../lib/deviceId'

// Same in-memory localStorage polyfill as src/store/__tests__/authStore.test.ts
// — this project's Vitest runs environment: 'node', and both getDeviceId and
// useDeviceStore's persist() touch storage.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

beforeEach(() => {
  ;(globalThis as any).localStorage = new MemoryStorage()
  useDeviceStore.setState({ devices: [] })
})

describe('registerSelf', () => {
  it('adds exactly one row for this device', () => {
    useDeviceStore.getState().registerSelf()
    const { devices } = useDeviceStore.getState()
    expect(devices).toHaveLength(1)
    expect(devices[0].id).toBe(getDeviceId())
  })

  it('is idempotent — calling it again does not duplicate or reset a renamed row', () => {
    useDeviceStore.getState().registerSelf()
    useDeviceStore.getState().renameDevice(getDeviceId(), 'Front counter PC')

    useDeviceStore.getState().registerSelf()

    const { devices } = useDeviceStore.getState()
    expect(devices).toHaveLength(1)
    expect(devices[0].name).toBe('Front counter PC')
  })
})

describe('renameDevice', () => {
  it('renames only the targeted device', () => {
    useDeviceStore.setState({
      devices: [
        { id: 'dev-a', name: 'Old name', platform: 'Windows PC', firstSeenAt: '2026-01-01T00:00:00.000Z' },
        { id: 'dev-b', name: 'Untouched', platform: 'Tablet', firstSeenAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    useDeviceStore.getState().renameDevice('dev-a', 'New name')
    const { devices } = useDeviceStore.getState()
    expect(devices.find((d) => d.id === 'dev-a')?.name).toBe('New name')
    expect(devices.find((d) => d.id === 'dev-b')?.name).toBe('Untouched')
  })
})

describe('removeDevice', () => {
  it('removes only the targeted device', () => {
    useDeviceStore.setState({
      devices: [
        { id: 'dev-a', name: 'A', platform: 'Windows PC', firstSeenAt: '2026-01-01T00:00:00.000Z' },
        { id: 'dev-b', name: 'B', platform: 'Tablet', firstSeenAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    useDeviceStore.getState().removeDevice('dev-a')
    const { devices } = useDeviceStore.getState()
    expect(devices).toHaveLength(1)
    expect(devices[0].id).toBe('dev-b')
  })

  it('is safe to call on an id that has already been removed', () => {
    useDeviceStore.setState({ devices: [] })
    expect(() => useDeviceStore.getState().removeDevice('does-not-exist')).not.toThrow()
    expect(useDeviceStore.getState().devices).toHaveLength(0)
  })
})

describe('getDevice', () => {
  it('finds a device by id, or returns undefined', () => {
    useDeviceStore.setState({
      devices: [{ id: 'dev-a', name: 'A', platform: 'Windows PC', firstSeenAt: '2026-01-01T00:00:00.000Z' }],
    })
    expect(useDeviceStore.getState().getDevice('dev-a')?.name).toBe('A')
    expect(useDeviceStore.getState().getDevice('missing')).toBeUndefined()
  })
})
