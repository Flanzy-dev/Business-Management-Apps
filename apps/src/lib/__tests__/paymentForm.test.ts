import { describe, it, expect } from 'vitest'
import { amountReceived, canConfirmPayment, changeDue, paymentResult, sanitizeReceivedText, type PaymentFormState } from '../orders/paymentForm'

const cash = (receivedText: string): PaymentFormState => ({ method: 'cash', receivedText, dueDate: '' })

describe('paymentForm', () => {
  it('treats an empty cash amount as paid exactly — confirmable, no change', () => {
    expect(amountReceived(cash(''))).toBeNull()
    expect(changeDue(cash(''), 150_000)).toBe(0)
    expect(canConfirmPayment(cash(''), 150_000)).toBe(true)
  })

  it('computes change when more was handed over', () => {
    expect(changeDue(cash('200000'), 150_000)).toBe(50_000)
    expect(canConfirmPayment(cash('200000'), 150_000)).toBe(true)
  })

  it('blocks a typed cash amount that does not cover the total', () => {
    expect(changeDue(cash('100000'), 150_000)).toBe(-50_000)
    expect(canConfirmPayment(cash('100000'), 150_000)).toBe(false)
  })

  it('ignores the cash field for other methods', () => {
    const qris: PaymentFormState = { method: 'qris', receivedText: '5', dueDate: '' }
    expect(amountReceived(qris)).toBeNull()
    expect(canConfirmPayment(qris, 150_000)).toBe(true)
  })

  it('passes the due date through only for an unpaid order', () => {
    expect(paymentResult({ method: 'pending', receivedText: '', dueDate: '2026-11-01' }).paymentDueDate).toBe('2026-11-01')
    expect(paymentResult({ method: 'pending', receivedText: '', dueDate: '' }).paymentDueDate).toBeNull()
    expect(paymentResult({ method: 'card', receivedText: '', dueDate: '2026-11-01' }).paymentDueDate).toBeNull()
  })

  it('keeps only digits in the amount field', () => {
    expect(sanitizeReceivedText('Rp 150.000')).toBe('150000')
  })
})
