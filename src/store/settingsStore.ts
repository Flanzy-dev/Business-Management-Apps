import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getStorageAdapter } from '../lib/storageAdapter'

interface Settings {
  shopName: string
  shopAddress: string
  shopPhone: string
  shopEmail: string
  taxRate: number
  receiptFooter: string
  // Fallback service interval for a vehicle with no ScheduleRule for an item:
  // the checkout suggests that item once this many km have passed since its
  // last recorded change (see src/lib/serviceSuggestions.ts). Read through
  // DEFAULT_SERVICE_INTERVAL_KM below — installs that predate this field have
  // a stored settings object without it.
  defaultServiceIntervalKm: number
}

export const DEFAULT_SERVICE_INTERVAL_KM = 5000

interface SettingsStore {
  settings: Settings
  updateSettings: (data: Partial<Settings>) => void
}

const defaultSettings: Settings = {
  shopName: 'Oil Change Shop',
  shopAddress: '',
  shopPhone: '',
  shopEmail: '',
  taxRate: 8.25,
  receiptFooter: 'Thank you for your business!',
  defaultServiceIntervalKm: DEFAULT_SERVICE_INTERVAL_KM,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateSettings: (data) => {
        set((state) => ({
          settings: { ...state.settings, ...data },
        }))
      },
    }),
    { name: 'settings-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
