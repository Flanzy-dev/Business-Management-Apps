import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkOrderStore } from '../workOrderStore'

// setDiscount/setTaxPercent exist so CheckoutTicket's discount/tax fields can
// commit a field change and recompute totals in one store write instead of
// two (updateWorkOrder + recalculateTotals) — each write persists through a
// round trip that's expensive enough (see server/db.ts) that halving it
// mattered for a field edited by rapid individual keystrokes. These tests
// cover the actual behavior that matters: one write lands both the field and
// correct totals together, and the subtotal clamp from calculateTotals still
// applies exactly as it does via recalculateTotals.
describe('workOrderStore', () => {
  beforeEach(() => {
    useWorkOrderStore.setState({ workOrders: [], nextOrderNumber: 1001 })
  })

  function baseOrder() {
    return {
      vehicleId: 'v-1', workerId: null, driverId: null,
      odometerAtArrival: null, odometerAtService: null, date: '2026-08-21',
      items: [], subtotal: 0, discountAmount: 0, taxPercent: 0, taxAmount: 0,
      total: 0, paymentMethod: 'pending' as const, status: 'open' as const, notes: '',
    }
  }

  function openOrderWithSubtotal(subtotal: number) {
    const wo = useWorkOrderStore.getState().addWorkOrder({
      vehicleId: 'v-1',
      workerId: null,
      driverId: null,
      odometerAtArrival: null,
      odometerAtService: null,
      date: '2026-08-21',
      items: [],
      subtotal: 0,
      discountAmount: 0,
      taxPercent: 0,
      taxAmount: 0,
      total: 0,
      paymentMethod: 'pending',
      status: 'open',
      notes: '',
    })
    useWorkOrderStore.getState().addItem(wo.id, {
      description: 'Oil filter',
      quantity: 1,
      unitPrice: subtotal,
      productId: null,
    })
    return wo.id
  }

  describe('setDiscount', () => {
    it('updates discountAmount and recomputes total in one call', () => {
      const id = openOrderWithSubtotal(100_000)
      useWorkOrderStore.getState().setDiscount(id, 20_000)
      const wo = useWorkOrderStore.getState().getWorkOrder(id)!
      expect(wo.discountAmount).toBe(20_000)
      expect(wo.total).toBe(80_000)
    })

    it('clamps a discount larger than the subtotal, never storing more than subtotal', () => {
      const id = openOrderWithSubtotal(100_000)
      useWorkOrderStore.getState().setDiscount(id, 999_999)
      const wo = useWorkOrderStore.getState().getWorkOrder(id)!
      expect(wo.discountAmount).toBe(100_000)
      expect(wo.total).toBe(0)
    })

    it('never stores a negative discount', () => {
      const id = openOrderWithSubtotal(100_000)
      useWorkOrderStore.getState().setDiscount(id, -5_000)
      const wo = useWorkOrderStore.getState().getWorkOrder(id)!
      expect(wo.discountAmount).toBe(0)
      expect(wo.total).toBe(100_000)
    })

    it('clamps to 0 on an order with no subtotal — the exact case CheckoutTicket now disables the field for', () => {
      const id = openOrderWithSubtotal(0)
      useWorkOrderStore.getState().setDiscount(id, 50_000)
      const wo = useWorkOrderStore.getState().getWorkOrder(id)!
      expect(wo.discountAmount).toBe(0)
      expect(wo.total).toBe(0)
    })

    it('does nothing for an order id that does not exist', () => {
      const id = openOrderWithSubtotal(100_000)
      expect(() => useWorkOrderStore.getState().setDiscount('missing-id', 10_000)).not.toThrow()
      const wo = useWorkOrderStore.getState().getWorkOrder(id)!
      expect(wo.discountAmount).toBe(0)
    })
  })

  describe('setTaxPercent', () => {
    it('updates taxPercent and recomputes taxAmount/total in one call', () => {
      const id = openOrderWithSubtotal(100_000)
      useWorkOrderStore.getState().setTaxPercent(id, 10)
      const wo = useWorkOrderStore.getState().getWorkOrder(id)!
      expect(wo.taxPercent).toBe(10)
      expect(wo.taxAmount).toBe(10_000)
      expect(wo.total).toBe(110_000)
    })

    it('applies tax on the post-discount amount', () => {
      const id = openOrderWithSubtotal(100_000)
      useWorkOrderStore.getState().setDiscount(id, 20_000)
      useWorkOrderStore.getState().setTaxPercent(id, 10)
      const wo = useWorkOrderStore.getState().getWorkOrder(id)!
      expect(wo.taxAmount).toBe(8_000) // 10% of (100,000 - 20,000)
      expect(wo.total).toBe(88_000)
    })

    it('clamps a tax percent above 100 down to 100, and a negative one up to 0', () => {
      const id = openOrderWithSubtotal(100_000)
      useWorkOrderStore.getState().setTaxPercent(id, 250)
      expect(useWorkOrderStore.getState().getWorkOrder(id)!.taxPercent).toBe(100)
      useWorkOrderStore.getState().setTaxPercent(id, -5)
      expect(useWorkOrderStore.getState().getWorkOrder(id)!.taxPercent).toBe(0)
    })
  })

  describe('addWorkOrder — order numbering', () => {
    it('issues sequential numbers from the local counter', () => {
      const a = useWorkOrderStore.getState().addWorkOrder(baseOrder())
      const b = useWorkOrderStore.getState().addWorkOrder(baseOrder())
      expect(a.orderNumber).toBe(1001)
      expect(b.orderNumber).toBe(1002)
    })

    it('jumps past a higher number synced in from another device, never reusing it', () => {
      useWorkOrderStore.setState({
        workOrders: [{ ...baseOrder(), id: 'remote-1', orderNumber: 1050, completedAt: null } as any],
        nextOrderNumber: 1002,
      })
      const next = useWorkOrderStore.getState().addWorkOrder(baseOrder())
      expect(next.orderNumber).toBe(1051)
      expect(useWorkOrderStore.getState().nextOrderNumber).toBe(1052)
    })

    it('does not reuse the newest number after it is deleted', () => {
      const a = useWorkOrderStore.getState().addWorkOrder(baseOrder())
      useWorkOrderStore.getState().deleteWorkOrder(a.id)
      const b = useWorkOrderStore.getState().addWorkOrder(baseOrder())
      expect(b.orderNumber).toBe(1002)
    })
  })
})
