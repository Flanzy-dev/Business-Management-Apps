import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Settings {
  shopName: string
  shopAddress: string
  shopPhone: string
  shopEmail: string
  taxRate: number
  receiptFooter: string
}

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
    { name: 'settings-store' }
  )
)
