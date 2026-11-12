// renderReceiptHtml (src/components/workOrders/Receipt.tsx) is the pure half of
// printReceipt — a (order, settings, data) => string with no DOM/store
// access, extracted specifically to make escaping and section rendering
// testable for the first time. This is the receipt's only layout (see that
// file's header), and it interpolates shop-configured and customer-typed
// strings straight into the printed document, so the escaping is the one
// thing worth pinning.
import { describe, it, expect } from 'vitest'
import { renderReceiptHtml, type ReceiptData, type ReceiptShopInfo } from '../../components/workOrders/Receipt'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { OrderItemGroups } from '../orders/orderItemGroups'
import { formatCurrency, formatNumber } from '../format/numbers'
import { formatDateCompact } from '../format/dates'

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

  // The fields below are typed number / enum, but they arrive from synced shop
  // data that a worker-tier device may write with any JSON — so the printed
  // document, which is same-origin with the app window, must not trust the types.
  it('escapes an odometer that is really a string', () => {
    const payload = '</span><script>window.opener.x=1</script>' as unknown as number
    const html = renderReceiptHtml(order(), undefined, data({ currentOdometer: payload }))

    expect(html).not.toContain('<script>window.opener.x=1</script>')
    expect(html).toContain('&lt;script&gt;window.opener.x=1')
  })

  it('cannot be broken out of the <style> block through the paper width', () => {
    const evil = '80mm}</style><script>window.opener.x=1</script>' as unknown as ReceiptShopInfo['paperWidth']
    const html = renderReceiptHtml(order(), { paperWidth: evil }, data())

    expect(html).not.toContain('window.opener.x=1')
    expect(html).toContain('@page { size: 80mm auto; margin: 0; }')
  })

  it('keeps the real paper widths working', () => {
    expect(renderReceiptHtml(order(), { paperWidth: '58mm' }, data())).toContain('size: 58mm auto')
    expect(renderReceiptHtml(order(), { paperWidth: 'a4' }, data())).toContain('size: A4')
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

  it('renders the next-service block only when there are due lines', () => {
    const withDue = renderReceiptHtml(order(), undefined, data({ dueLines: [{ what: 'Oli Mesin', dueKm: 55_000, dueDate: null, overdue: false }] }))
    expect(withDue).toContain('class="due"')
    expect(withDue).toContain('Oli Mesin')

    const withoutDue = renderReceiptHtml(order(), undefined, data({ dueLines: [] }))
    expect(withoutDue).not.toContain('class="due"')
  })

  it('prints one row per reminder, with km and date in their own columns', () => {
    const html = renderReceiptHtml(
      order(),
      undefined,
      data({
        dueLines: [
          { what: 'Oli Mesin', dueKm: 55_000, dueDate: '2027-03-12', overdue: false },
          { what: 'Filter Solar', dueKm: null, dueDate: '2027-09-12', overdue: false },
        ],
      })
    )
    // Two reminders plus the column-heading row, which shares the row class.
    expect(html.match(/class="due-row/g)).toHaveLength(3)
    expect(html).toContain(`<span class="due-km">${formatNumber(55_000)}</span>`)
    // A date-only mark leaves its km column empty rather than printing a dash.
    expect(html).toContain('<span class="due-km"></span>')
    expect(html).toContain(`<span class="due-date">${formatDateCompact('2027-03-12')}</span>`)
  })

  it('marks overdue rows with a bold "!" and explains it, but only when one is overdue', () => {
    const overdue = renderReceiptHtml(order(), undefined, data({ dueLines: [{ what: 'Oli Gardan', dueKm: 80_000, dueDate: null, overdue: true }] }))
    expect(overdue).toContain('class="due-row overdue"')
    expect(overdue).toContain('<span class="due-mark">!</span>')
    expect(overdue).toContain('class="due-key"')

    const onTrack = renderReceiptHtml(order(), undefined, data({ dueLines: [{ what: 'Oli Gardan', dueKm: 80_000, dueDate: null, overdue: false }] }))
    expect(onTrack).not.toContain('due-row overdue')
    expect(onTrack).not.toContain('class="due-key"')
  })

  it('escapes the service names in a reminder row', () => {
    const html = renderReceiptHtml(order(), undefined, data({ dueLines: [{ what: '<script>x</script>', dueKm: null, dueDate: null, overdue: false }] }))
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
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
