// What the Profile page can truthfully show. The app has two shop accounts
// (admin, and an optional worker) and no per-person identity beyond that — so
// "who am I" is the signed-in account and its role, and the shop's contact
// details are the ones saved in Settings. Nothing here is editable: there is no
// store behind a personal email or phone number.
import type { Mode } from '../auth/permissions'

export interface AccountSummary {
  /** The account's login name, or null when none was ever set (older installs). */
  name: string | null
  role: 'admin' | 'worker'
}

/** The signed-in account. */
export function accountSummary(
  mode: Mode,
  security: { adminUsername: string | null; workerUsername: string | null }
): AccountSummary {
  const role = mode === 'admin' ? 'admin' : 'worker'
  const name = (role === 'admin' ? security.adminUsername : security.workerUsername)?.trim()
  return { name: name ? name : null, role }
}

export interface ShopContact {
  name: string | null
  address: string | null
  phone: string | null
  email: string | null
}

/** The shop's saved details, with blanks as null so the page can say "not set". */
export function shopContact(settings: { shopName: string; shopAddress: string; shopPhone: string; shopEmail: string }): ShopContact {
  const clean = (value: string | undefined) => (value && value.trim() ? value.trim() : null)
  return {
    name: clean(settings.shopName),
    address: clean(settings.shopAddress),
    phone: clean(settings.shopPhone),
    email: clean(settings.shopEmail),
  }
}
