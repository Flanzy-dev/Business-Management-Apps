import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface Settings {
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
  // The months-axis sibling of defaultServiceIntervalKm — used only where
  // there's no catalog service to say otherwise for an item type at all
  // (ScheduleRulesEditor's manual setup, and scheduleOps.ts's automatic
  // schedule creation on order completion): both axes get a sensible
  // starting point together, same "whichever comes first" pairing the
  // oil-change starter service itself ships with (5,000 km / 4 months).
  // A tagged catalog service's own interval always wins over this — it never
  // adds a months axis to a service the shop deliberately tracks by km alone
  // (Tune Up, Purging). Read through DEFAULT_SERVICE_INTERVAL_MONTHS below,
  // same predates-this-field convention as defaultServiceIntervalKm above.
  defaultServiceIntervalMonths: number
  // Receipt paper size — drives Receipt.tsx's max-width, base font size and
  // @page rule. '80mm' reproduces the pre-setting hardcoded 280px width, so
  // installs whose stored settings object predates this field keep today's
  // output (read through `?? '80mm'` at the call sites).
  receiptPaperWidth: '58mm' | '80mm' | 'a4'
  // When false, the receipt window shows a Print button instead of firing the
  // OS print dialog on load — a chance to check it first. Default true.
  receiptAutoPrint: boolean
  // How many days out an "Unpaid — invoice later" order's due date defaults
  // to at checkout (src/lib/receivables.ts's defaultPaymentDueDate) — editable
  // per order from there, this is only the starting point. Same
  // predates-this-field convention as defaultServiceIntervalKm below.
  defaultPaymentTermDays: number
}

export const DEFAULT_SERVICE_INTERVAL_KM = 5000
export const DEFAULT_SERVICE_INTERVAL_MONTHS = 4
export const DEFAULT_PAYMENT_TERM_DAYS = 14

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
  defaultServiceIntervalMonths: DEFAULT_SERVICE_INTERVAL_MONTHS,
  receiptPaperWidth: '80mm',
  receiptAutoPrint: true,
  defaultPaymentTermDays: DEFAULT_PAYMENT_TERM_DAYS,
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
