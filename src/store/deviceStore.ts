import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getStorageAdapter } from '../lib/storageAdapter'
import { getDeviceId } from '../lib/deviceId'
import { defaultDeviceLabel } from '../lib/deviceLabel'

/**
 * One row per device that has ever synced with this shop — the registry
 * behind the "who's synced with me" device list in
 * src/components/settings/SyncDeviceList.tsx and the "synced with X" line
 * on a follower's own card (SyncRoleSection.tsx). NAMES live here, synced
 * like any other shop data; LIVENESS (when a device last actually pushed
 * something) is deliberately NOT stored here — see GET /api/devices
 * (server/syncServer.ts) and server/db.ts's deviceActivity(), which derive
 * it from the oplog instead, because the oplog is never pruned and a synced
 * heartbeat field would grow it forever just to render a timestamp.
 *
 * Each device only ever writes its OWN row (registerSelf, renameDevice
 * called on this device's own id) — never another device's — which is what
 * makes the 'list' sync merge conflict-free by construction: two devices
 * can never disagree about the same row because no device ever touches any
 * row but its own. `removeDevice` is the one exception (removing a device
 * that's gone for good), and it's safe for the same reason every other
 * delete in a 'list' store is: whichever write reaches the oplog last wins,
 * and a removed device that comes back just re-registers on its next
 * launch (registerSelf is idempotent).
 */
export interface Device {
  id: string
  name: string
  /** Coarse, editable-after-the-fact guess — see src/lib/deviceLabel.ts. */
  platform: string
  firstSeenAt: string
}

interface DeviceStore {
  devices: Device[]
  /** Adds this device's own row if it doesn't have one yet. Idempotent and
   *  safe to call on every launch (see src/App.tsx) — a device that already
   *  has a row is left untouched, including its name if someone renamed it. */
  registerSelf: () => void
  renameDevice: (id: string, name: string) => void
  removeDevice: (id: string) => void
  getDevice: (id: string) => Device | undefined
}

export const useDeviceStore = create<DeviceStore>()(
  persist(
    (set, get) => ({
      devices: [],

      registerSelf: () => {
        const id = getDeviceId()
        if (get().devices.some((d) => d.id === id)) return
        const device: Device = {
          id,
          name: defaultDeviceLabel(),
          platform: defaultDeviceLabel(),
          firstSeenAt: new Date().toISOString(),
        }
        set((state) => ({ devices: [...state.devices, device] }))
      },

      renameDevice: (id, name) => {
        set((state) => ({ devices: state.devices.map((d) => (d.id === id ? { ...d, name } : d)) }))
      },

      removeDevice: (id) => {
        set((state) => ({ devices: state.devices.filter((d) => d.id !== id) }))
      },

      getDevice: (id) => get().devices.find((d) => d.id === id),
    }),
    { name: 'device-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
