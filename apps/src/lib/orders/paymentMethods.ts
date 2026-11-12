// The i18n key (under `workOrders.`) for each way a customer can actually pay.
// Four screens used to keep their own copy of this table — the ticket, the
// breakdown, the payment picker and the receipt — and any new method would have
// had to be added in all four.
//
// 'pending' (not paid yet) is deliberately NOT here: it is a state, not a way of
// paying, and each screen words it differently ("Unpaid — invoice later" in the
// picker, "Pending" on a receipt), so each adds its own.
export const PAID_METHOD_KEYS = {
  cash: 'paymentCash',
  qris: 'paymentQris',
  card: 'paymentCard',
  check: 'paymentCheck',
} as const

export type PaidMethod = keyof typeof PAID_METHOD_KEYS
