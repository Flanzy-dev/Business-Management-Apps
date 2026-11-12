import { describe, it, expect } from 'vitest'
import { buildStockPurchaseExpense } from '../ops/inventoryOps'

describe('buildStockPurchaseExpense', () => {
  it('always uses the Inventory Purchase category', () => {
    const expense = buildStockPurchaseExpense('p-1', 4, { amount: 100, vendor: 'Acme', description: 'Restock: Oil × 4' })
    expect(expense.category).toBe('Inventory Purchase')
  })

  it('formats the date as YYYY-MM-DD, matching the manual expense form', () => {
    const now = new Date(2026, 6, 24, 15, 30) // 2026-07-24
    const expense = buildStockPurchaseExpense('p-1', 4, { amount: 100, vendor: 'Acme', description: 'x' }, now)
    expect(expense.date).toBe('2026-07-24')
  })

  it('dates a restock by the local day, so an early-morning one stays in its own month', () => {
    // 00:30 local on the 1st: in Jakarta (UTC+7) the UTC date is still the 30th,
    // which used to push the purchase into last month's P&L.
    const now = new Date(2026, 9, 1, 0, 30)
    const expense = buildStockPurchaseExpense('p-1', 4, { amount: 100, vendor: 'Acme', description: 'x' }, now)
    expect(expense.date).toBe('2026-10-01')
  })

  it('rounds a fractional amount', () => {
    const expense = buildStockPurchaseExpense('p-1', 4, { amount: 449999.6, vendor: 'Acme', description: 'x' })
    expect(expense.amount).toBe(450000)
  })

  it('clamps a negative amount to 0 rather than recording a negative expense', () => {
    const expense = buildStockPurchaseExpense('p-1', 4, { amount: -50, vendor: 'Acme', description: 'x' })
    expect(expense.amount).toBe(0)
  })

  it('passes vendor and description straight through, and leaves notes empty', () => {
    const expense = buildStockPurchaseExpense('p-1', 10, { amount: 1000, vendor: 'PT Sumber Oli', description: 'Restock: Oli 5W-30 × 10' })
    expect(expense.vendor).toBe('PT Sumber Oli')
    expect(expense.description).toBe('Restock: Oli 5W-30 × 10')
    expect(expense.notes).toBe('')
  })

  it('links the expense to the product and quantity it represents', () => {
    const expense = buildStockPurchaseExpense('oil-5w30', 10, { amount: 1000, vendor: 'Acme', description: 'x' })
    expect(expense.productId).toBe('oil-5w30')
    expect(expense.quantityAffected).toBe(10)
  })
})
