// Is this phone number already a customer on file? A returning customer with a
// new car is the common counter case, and a second record for the same person
// splits their history in two — the next visit's lookup finds only one half.
//
// Pure: callers pass the customers in.

/** A number is "the same line" regardless of how it was typed. */
const MIN_DIGITS = 7

/**
 * The national significant digits of a phone number: "0812-3456-789",
 * "+62 812 3456 789" and "62812345678 9" all become "8123456789". Empty when
 * there are too few digits to identify anyone — "1" or "112" must not match
 * every customer who typed a short number.
 */
export function phoneKey(phone: string | null | undefined): string {
  let digits = (phone ?? '').replace(/\D/g, '')
  if (digits.startsWith('62')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.length >= MIN_DIGITS ? digits : ''
}

/**
 * The customer already using this phone number, ignoring `excludeId` (the
 * customer being edited, who may keep their own number). Undefined for a
 * number too short to identify anyone.
 */
export function findCustomerByPhone<T extends { id: string; phone?: string | null }>(
  customers: readonly T[],
  phone: string,
  excludeId?: string
): T | undefined {
  const key = phoneKey(phone)
  if (!key) return undefined
  return customers.find((c) => c.id !== excludeId && phoneKey(c.phone) === key)
}
