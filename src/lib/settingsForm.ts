// The Shop Information card's form state, pulled out of the component that
// renders it (src/pages/Settings.tsx / src/components/settings/ShopInfoCard.tsx).
// Same "pure, testable form module" convention as vehicleForm.ts/
// scheduleRuleForm.ts.
//
// Why this exists: this was the same 11-field list hand-mirrored three times
// in the component — once as 11 separate useState initializers, once again in
// a useEffect that reset them whenever `settings` changed underneath (a
// remote sync landing new settings while this page is open), and once more in
// reverse inside the Save handler. Three copies of one field list is exactly
// the shape a save-the-wrong-field typo hides in; collapsing to one draft
// object plus these two pure conversions means there's only one field list to
// get right.
import type { Settings } from '../store/settingsStore'
import {
  DEFAULT_SERVICE_INTERVAL_KM,
  DEFAULT_SERVICE_INTERVAL_MONTHS,
  DEFAULT_PAYMENT_TERM_DAYS,
} from '../store/settingsStore'

export interface SettingsDraft {
  shopName: string
  shopAddress: string
  shopPhone: string
  shopEmail: string
  /** Text, not a number, same convention as every other numeric field
   *  here — an <Input type="number"> still hands onChange a string; parsing
   *  happens once, in settingsDraftToData. */
  taxRate: string
  serviceInterval: string
  serviceIntervalMonths: string
  paymentTermDays: string
  receiptFooter: string
  receiptPaperWidth: Settings['receiptPaperWidth']
  receiptAutoPrint: boolean
}

/**
 * Where the form starts, and where it resets to whenever `settings` changes
 * underneath it. The three `?? DEFAULT_*` fallbacks exist for the same reason
 * their doc comments in settingsStore.ts give: an install whose stored
 * settings object predates that field has it as `undefined`, not the real
 * default value.
 */
export function initialSettingsDraft(settings: Settings): SettingsDraft {
  return {
    shopName: settings.shopName,
    shopAddress: settings.shopAddress,
    shopPhone: settings.shopPhone,
    shopEmail: settings.shopEmail,
    taxRate: settings.taxRate.toString(),
    serviceInterval: (settings.defaultServiceIntervalKm ?? DEFAULT_SERVICE_INTERVAL_KM).toString(),
    serviceIntervalMonths: (settings.defaultServiceIntervalMonths ?? DEFAULT_SERVICE_INTERVAL_MONTHS).toString(),
    paymentTermDays: (settings.defaultPaymentTermDays ?? DEFAULT_PAYMENT_TERM_DAYS).toString(),
    receiptFooter: settings.receiptFooter,
    receiptPaperWidth: settings.receiptPaperWidth ?? '80mm',
    receiptAutoPrint: settings.receiptAutoPrint ?? true,
  }
}

/**
 * The draft's typed-as-text numeric fields parsed back to what
 * updateSettings stores. A blank or unparsable number falls back to the
 * shop-wide default rather than 0/NaN — the same `parseInt(...) || DEFAULT`
 * guard the original inline handler used.
 */
export function settingsDraftToData(draft: SettingsDraft): Partial<Settings> {
  return {
    shopName: draft.shopName,
    shopAddress: draft.shopAddress,
    shopPhone: draft.shopPhone,
    shopEmail: draft.shopEmail,
    taxRate: parseFloat(draft.taxRate) || 0,
    defaultServiceIntervalKm: parseInt(draft.serviceInterval) || DEFAULT_SERVICE_INTERVAL_KM,
    defaultServiceIntervalMonths: parseInt(draft.serviceIntervalMonths) || DEFAULT_SERVICE_INTERVAL_MONTHS,
    defaultPaymentTermDays: parseInt(draft.paymentTermDays) || DEFAULT_PAYMENT_TERM_DAYS,
    receiptFooter: draft.receiptFooter,
    receiptPaperWidth: draft.receiptPaperWidth,
    receiptAutoPrint: draft.receiptAutoPrint,
  }
}
