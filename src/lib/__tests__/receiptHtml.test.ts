// renderReceiptHtml (src/components/Receipt.tsx) is the pure half of
// printReceipt — a (order, settings, data) => string with no DOM/store
// access, extracted specifically to make escaping and section rendering
// testable for the first time. This is the receipt's only layout (see that
// file's header), and it interpolates shop-configured and customer-typed
// strings straight into the printed document, so the escaping is the one
// thing worth pinning.
import { describe, it, expect } from 'vitest'
import { renderReceiptHtml, type ReceiptData, type ReceiptShopInfo } from '../../components/Receipt'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { OrderItemGroups } from '../orderItemGroups'
import { formatCurrency } from '../currency'

function itemGroups(products: WorkOrderItem[] = [], services: WorkOrderItem[] = []): OrderItemGroups {
  return {
    products,
    services,
    productsSubtotal: products.reduce((sum, i) => sum + i.lineTotal, 0),
    servicesSubtotal: services.reduce((sum, i) => sum + i.lineTotal, 0),
  }
}

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return {
    id: 'i-1',
    description: 'Helix HX3 20/50 1 L',
    quantity: 2,
    unitPrice: 80_000,
    lineTotal: 160_000,
    productId: 'p-1',
    ...overrides,
  }
}

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-1',
    orderNumber: 1042,
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    odometerAtArrival: 50_000,
    odometerAtService: null,
    date: '2026-08-10',
    items: [item()],
    subtotal: 160_000,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 160_000,
    paymentMethod: 'cash',
    status: 'completed',
    notes: '',
    createdAt: '2026-08-10T08:00:00.000Z',
    completedAt: '2026-08-10T08:30:00.000Z',
    ...overrides,
  }
}

function data(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    orderDate: new Date('2026-08-10T08:30:00.000Z'),
    currentOdometer: 50_000,
    dueLines: [],
    itemGroups: itemGroups(),
    plate: 'B 1234 XYZ',
    ...overrides,
  }
}

describe('renderReceiptHtml', () => {
  it('escapes a shop-configured name and a customer-typed line description', () => {
    const shop: ReceiptShopInfo = { shopName: '<script>alert(1)</script>' }
    const withEvilLine = order({ items: [item({ description: '<img src=x onerror=alert(1)>' })], subtotal: 80_000, total: 80_000 })
    const html = renderReceiptHtml(withEvilLine, shop, data({ itemGroups: itemGroups(withEvilLine.items) }))

    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img')
  })

  it('renders only the item groups that have lines in them', () => {
    const productsOnly = renderReceiptHtml(order(), undefined, data({ itemGroups: itemGroups([item()]) }))
    expect(productsOnly).toContain('Helix HX3 20/50 1 L')
    expect(productsOnly).not.toContain('receipt.servicesLabel')

    const neither = renderReceiptHtml(order(), undefined, data({ itemGroups: itemGroups() }))
    expect(neither).not.toContain('class="items"')
  })

  it('shows the cash/change pair only for a cash payment with an amount received', () => {
    const cash = order({ paymentMethod: 'cash', amountReceived: 200_000, total: 160_000 })
    const html = renderReceiptHtml(cash, undefined, data())
    expect(html).toContain(formatted(200_000))
    expect(html).toContain(formatted(40_000)) // change

    const pending = order({ paymentMethod: 'pending', amountReceived: null })
    expect(renderReceiptHtml(pending, undefined, data())).not.toContain('receipt.cashReceivedLabel')
  })

  it('clamps change at zero rather than showing a negative number', () => {
    const underpaid = order({ paymentMethod: 'cash', amountReceived: 100_000, total: 160_000 })
    const html = renderReceiptHtml(underpaid, undefined, data())
    expect(html).toContain(formatted(0))
    expect(html).not.toContain('-Rp')
  })

  it('renders the next-due reminder only when there are due lines', () => {
    const withDue = renderReceiptHtml(order(), undefined, data({ dueLines: ['5.000 km lagi — Oli Mesin'] }))
    expect(withDue).toContain('5.000 km lagi — Oli Mesin')

    const withoutDue = renderReceiptHtml(order(), undefined, data({ dueLines: [] }))
    expect(withoutDue).not.toContain('receipt.nextDueLabel')
  })

  it('picks the print-button markup over the auto-print script when autoPrint is false', () => {
    const manual = renderReceiptHtml(order(), { autoPrint: false }, data())
    expect(manual).not.toContain('<script>window.onload')
    expect(manual).toContain('<button type="button" onclick="window.print()">')

    const auto = renderReceiptHtml(order(), { autoPrint: true }, data())
    expect(auto).toContain('window.onload = function() { window.print(); }')
  })
})

// formatCurrency's real output depends on the active i18n language; this test
// only needs "the same number formatCurrency would produce" appears verbatim,
// not to hardcode its exact separators.
function formatted(n: number): string {
  return formatCurrency(n)
}
