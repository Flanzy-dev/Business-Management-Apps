import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'
import { getDeviceId } from '../lib/deviceId'

/**
 * Append-only accountability log — "who created/edited/deleted what" for
 * customers/companies/vehicles (src/pages/Customers.tsx, Companies.tsx,
 * Vehicles.tsx' handleSave/handleDelete), since there are no per-worker
 * accounts to attribute a change to (Worker is one shared mode, not
 * individual logins — see src/pages/Technicians.tsx, a staff roster, not a
 * login system).
 *
 * Entries are written once and never edited or deleted — same reasoning as
 * src/store/stockMovementStore.ts's ledger: two offline deletions on two
 * devices are two entries, and both survive being merged back together,
 * where an editable/removable log could have one silently clobber the
 * other. `label` snapshots a human-readable identifier at the moment of
 * deletion, since the record itself is gone afterward and its bare id means
 * nothing to an admin reading the log later. For create/update, `label` is
 * just the entity's current display name at save time — cheaper than a
 * lookup and, for update, avoids depending on a possibly-stale store read.
 */
export type ActivityEntityType = 'customer' | 'company' | 'vehicle'
export type ActivityLogAction = 'create' | 'update' | 'delete'

export interface ActivityLogEntry {
  id: string
  createdAt: string
  action: ActivityLogAction
  entityType: ActivityEntityType
  /** The record's own id. For a delete, kept for reference even though
   *  nothing can look it up anymore. */
  entityId: string
  label: string
  mode: 'admin' | 'worker'
  deviceId: string
}

interface ActivityLogStore {
  entries: ActivityLogEntry[]
  record: (data: Omit<ActivityLogEntry, 'id' | 'createdAt' | 'deviceId'>) => void
}

export const useActivityLogStore = create<ActivityLogStore>()(
  persist(
    (set) => ({
      entries: [],
      record: (data) => {
        const entry = newEntity({ ...data, deviceId: getDeviceId() })
        set((state) => ({ entries: [...state.entries, entry] }))
      },
    }),
    { name: 'activity-log-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
