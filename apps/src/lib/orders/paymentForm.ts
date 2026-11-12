// The checkout payment form's rules, kept out of PaymentDialog.tsx so they can
// be tested in Node (see ARCHITECTURE.md's "the .tsx boundary is the test
// boundary").
//
// The form is one screen: pick a method (cash is preselected), and for cash
// optionally type what the customer handed over. An empty cash amount means
// they paid the exact total, which is the common case at the counter, so it
// needs no typing at all.
import type { WorkOrder } from '../../store/workOrderStore'

export type PaymentMethod = WorkOrder['paymentMethod']

export interface PaymentFormState {
  method: PaymentMethod
  /** Digits only, as typed. '' = paid exactly. */
  receivedText: string
  /** 'YYYY-MM-DD', only read for 'pending'. */
  dueDate: string
}

/** Strips everything but digits — the field takes whole Rupiah only. */
export function sanitizeReceivedText(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

/** What the customer handed over, or null when the field was left empty
 *  (paid exactly) or the method isn't cash. */
export function amountReceived(state: PaymentFormState): number | null {
  if (state.method !== 'cash' || state.receivedText === '') return null
  return parseInt(state.receivedText, 10)
}

/** Change to hand back; 0 when paid exactly. Negative means short. */
export function changeDue(state: PaymentFormState, total: number): number {
  const received = amountReceived(state)
  return received === null ? 0 : received - total
}

/** Whether Confirm may run: a typed cash amount must cover the total. */
export function canConfirmPayment(state: PaymentFormState, total: number): boolean {
  return changeDue(state, total) >= 0
}

/** The values PaymentDialog's onConfirm hands to the order ops. */
export function paymentResult(state: PaymentFormState): {
  method: PaymentMethod
  amountReceived: number | null
  paymentDueDate: string | null
} {
  return {
    method: state.method,
    amountReceived: amountReceived(state),
    paymentDueDate: state.method === 'pending' ? state.dueDate || null : null,
  }
}
