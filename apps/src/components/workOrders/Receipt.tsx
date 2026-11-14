// The printed receipt. Deliberately NOT a React component: printReceipt below
// builds an HTML document string and hands it to a popup window, because the
// receipt is rendered by the browser's print pipeline rather than into the app's
// own tree. A React <Receipt> component used to live here too, rendered by
// nobody — two layouts for one receipt, where editing the more React-looking one
// changed nothing on paper. Removed; this is the only receipt layout.
//
// Split into named steps (below printReceipt) so the HTML-building half —
// escaping, per-section markup — is a pure function of already-collected data
// and testable for the first time; only openPrintWindow/collectReceiptData
// still touch the DOM/stores.
import { isTouchPrimary } from '../../lib/app/environment'
import { WorkOrder } from '../../store/workOrderStore'
import type { Settings } from '../../store/settingsStore'
import { useToastStore } from '../../store/uiStores'
import { useVehicleStore } from '../../store/vehicleStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { isCounterSale, orderOwnerRef } from '../../lib/orders/orderOwner'
import { isUnpaidCompleted } from '../../lib/orders/receivables'
import { findOwner } from '../../lib/vehicles/vehicleOwner'
import { formatCurrency, formatDistance, formatNumber } from '../../lib/format/numbers'
import { formatDate, formatDateCompact, formatTime } from '../../lib/format/dates'
import { buildReceiptDueLines, type ReceiptDueLine } from '../../lib/orders/receiptDueLines'
import { groupOrderItemsByType, type OrderItemGroups } from '../../lib/orders/orderItemGroups'
import { lineBreakdown } from '../../lib/orders/lineBreakdown'
import { orderLabel, vehiclePlate } from '../../lib/format/entities'
import { translate } from '../../lib/i18n'
import { PAID_METHOD_KEYS } from '../../lib/orders/paymentMethods'
import { visitOdometer } from '../../lib/vehicles/visitOdometer'

const PAYMENT_METHOD_KEYS: Record<string, string> = { ...PAID_METHOD_KEYS, pending: 'paymentPending' }

export interface ReceiptShopInfo {
  shopName?: string
  shopAddress?: string
  shopPhone?: string
  footerText?: string
  paperWidth?: '58mm' | '80mm' | 'a4'
  autoPrint?: boolean
}

/** printReceipt's settings param, read off the live settingsStore — same
 *  five fields, four call sites (WorkOrderList, WorkOrderEditor,
 *  ServiceHistory, VehicleServiceHistoryDialog) until this existed. */
export function receiptShopInfoFromSettings(settings: Settings): ReceiptShopInfo {
  return {
    shopName: settings.shopName,
    shopAddress: settings.shopAddress,
    shopPhone: settings.shopPhone,
    footerText: settings.receiptFooter,
    paperWidth: settings.receiptPaperWidth ?? '80mm',
    autoPrint: settings.receiptAutoPrint ?? true,
  }
}

// Equivalent to the old `div.textContent = text; return div.innerHTML` (which
// needed a live DOM) — escaping only &, <, > matches what that round-trip
// actually did for element text content: quotes are never escaped by
// textContent/innerHTML outside an attribute value, and nothing here is
// interpolated into one. Rewritten DOM-free specifically so renderReceiptHtml
// is importable and testable under this repo's Node-only Vitest environment
// (no jsdom — see ARCHITECTURE.md's ".tsx boundary is the test boundary").
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The popup + the blocked-popup toast. Outside React, so the toast fires via
 *  the store's imperative API rather than a hook. */
function openPrintWindow(): Window | null {
  const printWindow = window.open('', '_blank', 'width=350,height=600')
  if (!printWindow) {
    useToastStore.getState().show({ tone: 'danger', title: translate('receipt.popupsBlocked') })
    return null
  }
  return printWindow
}

export interface ReceiptData {
  orderDate: Date
  currentOdometer: number | null
  dueLines: ReceiptDueLine[]
  itemGroups: OrderItemGroups
  plate: string
  /** The customer's name where the receipt needs one: a counter sale's buyer
   *  (printed in place of the plate/mileage rows) and an invoice's recipient (printed
   *  under the signature line). Null when there is nobody on file to name. */
  customerName?: string | null
}

/** Everything renderReceiptHtml needs beyond the order/settings themselves —
 *  the store/derived reads, gathered once before any markup is built. */
function collectReceiptData(workOrder: WorkOrder): ReceiptData {
  const orderDate = new Date(workOrder.completedAt || workOrder.createdAt)
  const currentOdometer = visitOdometer(workOrder)
  const dueLines = currentOdometer != null ? buildReceiptDueLines(workOrder.vehicleId, currentOdometer) : []
  const itemGroups = groupOrderItemsByType(workOrder.items ?? [])
  const vehicle = useVehicleStore.getState().vehicles.find(v => v.id === workOrder.vehicleId)
  const plate = vehiclePlate(vehicle)
  // A counter sale names its buyer in place of the plate; an invoice names its
  // recipient under the signature line. Looked up through findOwner so an owner
  // that no longer resolves is simply absent — never printed as "Unknown".
  const customerName = isCounterSale(workOrder) || isUnpaidCompleted(workOrder)
    ? findOwner(orderOwnerRef(workOrder, new Map(vehicle ? [[vehicle.id, vehicle]] : [])), {
        customers: useCustomerStore.getState().customers,
        companies: useCompanyStore.getState().companies,
      })?.name ?? null
    : null
  return { orderDate, currentOdometer, dueLines, itemGroups, plate, customerName }
}

/**
 * `paperWidth` lands inside a <style> block, and the settings row it comes from
 * is synced shop data a worker-tier device can write — so a value the settings
 * card would never offer must not be able to close the block and open a
 * <script>. Anything outside the three real widths falls back to the default.
 */
function normalizePaperWidth(value: unknown): '58mm' | '80mm' | 'a4' {
  return value === '58mm' || value === 'a4' ? value : '80mm'
}

function receiptStyles(paperWidth: '58mm' | '80mm' | 'a4'): string {
  const bodyWidthCss =
    paperWidth === '58mm' ? 'max-width: 210px; font-size: 11px;'
    : paperWidth === 'a4' ? 'max-width: 340px; font-size: 12px;'
    : 'max-width: 280px; font-size: 12px;'
  // One step smaller on the narrow roll so name, km and date still share a line.
  const dueRowFont = paperWidth === '58mm' ? 'font-size: 10px;' : ''
  const pageRule =
    paperWidth === 'a4' ? '@page { size: A4; margin: 12mm; }'
    : `@page { size: ${paperWidth} auto; margin: 0; }`

  return `
    <style>
      body {
        font-family: 'Courier New', monospace;
        padding: 10px;
        margin: 0 auto;
        ${bodyWidthCss}
      }
      ${pageRule}
      .header { text-align: center; margin-bottom: 10px; }
      .header h1 { font-size: 16px; margin: 0; }
      .header p { margin: 2px 0; font-size: 11px; }
      .doc-title { text-align: center; font-weight: bold; font-size: 14px; letter-spacing: 2px; margin: 6px 0 0; }
      /* Invoice signatures: two equal columns, a blank space to sign in, then a
         solid rule (thermal paper prints grey as nothing) with the name under it. */
      .sign { display: flex; gap: 12px; margin-top: 14px; }
      .sign-col { flex: 1; min-width: 0; text-align: center; }
      .sign-label { margin: 0; font-size: 10px; text-transform: uppercase; }
      .sign-space { height: 44px; }
      .sign-line { border-top: 1px solid #000; padding-top: 2px; font-size: 10px; overflow-wrap: anywhere; }
      .divider { border-top: 1px dashed #666; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; margin: 2px 0; }
      .label { font-weight: bold; }
      .items .item { display: flex; justify-content: space-between; margin: 4px 0; }
      .items .item-sub { font-size: 10px; margin: -2px 0 4px 8px; }
      .total-row { font-weight: bold; font-size: 14px; margin-top: 5px; }
      /* Next service: a solid rule above and below instead of a grey fill (thermal
         paper prints light grey as nothing). One row per reminder: mark, name,
         then km and date in fixed columns, so the numbers line up row to row. */
      .due { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; margin: 10px 0; }
      .due-title { margin: 0 0 4px; font-weight: bold; text-transform: uppercase; }
      .due-row { display: flex; align-items: baseline; gap: 4px; margin: 2px 0; ${dueRowFont} }
      .due-head { margin-bottom: 4px; font-size: 10px; text-transform: uppercase; }
      .due-row.overdue { font-weight: bold; }
      .due-mark { width: 1ch; flex: none; }
      .due-name { flex: 1; min-width: 0; }
      .due-km { flex: none; min-width: 7ch; text-align: right; white-space: nowrap; }
      .due-date { flex: none; min-width: 9ch; margin-left: 6px; text-align: right; white-space: nowrap; }
      .due-key { margin: 4px 0 0; font-size: 10px; }
      .footer { text-align: center; font-size: 10px; margin-top: 10px; }
      .print-actions { text-align: center; margin-top: 12px; }
      .print-actions button { font: inherit; padding: 6px 16px; cursor: pointer; }
      @media print { .print-actions { display: none; } }
      @media print {
        body { padding: 0; }
      }
    </style>
  `
}

function renderItemHtml(item: WorkOrder['items'][number]): string {
  const breakdown = lineBreakdown(item)
  return `
    <div class="item">
      <span>${escapeHtml(item.description)}</span>
      <span>${formatCurrency(item.lineTotal)}</span>
    </div>
    ${breakdown ? `<div class="item-sub">${escapeHtml(breakdown)}</div>` : ''}
  `
}

/** One labelled item group (Products or Services) — empty string when the
 *  group has nothing in it, same as the order had before this was named. */
function renderItemsSection(label: string, items: WorkOrder['items']): string {
  if (items.length === 0) return ''
  return `
      <div class="items">
        <p class="label">${escapeHtml(label)}</p>
        ${items.map(renderItemHtml).join('')}
      </div>
      `
}

/** Subtotal through payment method, plus the cash/change pair and the
 *  payment-due row — everything that's a fact about money on the order. */
function renderTotalsSection(workOrder: WorkOrder): string {
  const cashChangeHtml =
    workOrder.paymentMethod === 'cash' && workOrder.amountReceived != null
      ? `<div class="row"><span>${escapeHtml(translate('receipt.cashReceivedLabel'))}</span><span>${formatCurrency(workOrder.amountReceived)}</span></div>` +
        `<div class="row"><span>${escapeHtml(translate('receipt.changeLabel'))}</span><span>${formatCurrency(Math.max(0, workOrder.amountReceived - workOrder.total))}</span></div>`
      : ''

  return `
      <div class="row"><span>${escapeHtml(translate('receipt.subtotalLabel'))}</span><span>${formatCurrency(workOrder.subtotal)}</span></div>
      ${workOrder.discountAmount > 0 ? `<div class="row"><span>${escapeHtml(translate('receipt.discountLabel'))}</span><span>-${formatCurrency(workOrder.discountAmount)}</span></div>` : ''}
      <div class="row"><span>${escapeHtml(translate('receipt.taxLabel', { percent: workOrder.taxPercent }))}</span><span>${formatCurrency(workOrder.taxAmount)}</span></div>
      <div class="row total-row"><span>${escapeHtml(translate('receipt.totalLabel'))}</span><span>${formatCurrency(workOrder.total)}</span></div>
      <div class="row"><span>${escapeHtml(translate('receipt.paymentLabel'))}</span><span>${escapeHtml(translate(`receipt.${PAYMENT_METHOD_KEYS[workOrder.paymentMethod] ?? 'paymentPending'}`))}</span></div>
      ${cashChangeHtml}
      ${workOrder.paymentMethod === 'pending' && workOrder.paymentDueDate ? `<div class="row"><span>${escapeHtml(translate('receipt.paymentDueLabel'))}</span><span>${escapeHtml(formatDate(workOrder.paymentDueDate))}</span></div>` : ''}
  `
}

/**
 * An invoice's two signature columns: the customer receiving the goods (name
 * printed under the line when we have one, otherwise just the line) and the
 * shop. Both names are escaped like every other interpolated string.
 */
function renderSignatures(customerName: string | null, shopName: string): string {
  const column = (label: string, name: string | null) => `
        <div class="sign-col">
          <p class="sign-label">${escapeHtml(label)}</p>
          <div class="sign-space"></div>
          <div class="sign-line">${name ? escapeHtml(name) : '&nbsp;'}</div>
        </div>`
  return `
      <div class="sign">${column(translate('receipt.signReceivedBy'), customerName)}${column(translate('receipt.signIssuedBy'), shopName)}
      </div>
  `
}

/** The next-service block — empty string when nothing's due. One row per
 *  reminder (name left; km and date in columns on the right); an overdue row is
 *  bold with a leading "!", explained by a one-line key under the block. */
function renderDueReminder(dueLines: ReceiptDueLine[]): string {
  if (dueLines.length === 0) return ''
  const rows = dueLines
    .map(
      (line) => `
          <div class="due-row${line.overdue ? ' overdue' : ''}">
            <span class="due-mark">${line.overdue ? '!' : ''}</span>
            <span class="due-name">${escapeHtml(line.what)}</span>
            <span class="due-km">${line.dueKm != null ? escapeHtml(formatNumber(line.dueKm)) : ''}</span>
            <span class="due-date">${line.dueDate != null ? escapeHtml(formatDateCompact(line.dueDate)) : ''}</span>
          </div>`
    )
    .join('')
  const key = dueLines.some((line) => line.overdue) ? `<p class="due-key">${escapeHtml(translate('receipt.overdueKey'))}</p>` : ''
  return `
        <div class="due">
          <p class="due-title">${escapeHtml(translate('receipt.nextDueLabel'))}</p>
          <div class="due-row due-head">
            <span class="due-mark"></span>
            <span class="due-name"></span>
            <span class="due-km">${escapeHtml(translate('receipt.dueKmHead'))}</span>
            <span class="due-date">${escapeHtml(translate('receipt.dueDateHead'))}</span>
          </div>${rows}
          ${key}
        </div>
      `
}

/** Pure: composes the whole printed document from an order, its shop-info
 *  settings, and the data collectReceiptData gathered — no DOM, no store
 *  reads, so escaping and layout are finally unit-testable directly. */
export function renderReceiptHtml(workOrder: WorkOrder, settings: ReceiptShopInfo | undefined, data: ReceiptData): string {
  const { orderDate, currentOdometer, dueLines, itemGroups, plate, customerName } = data
  // No car on a counter sale, so no plate or mileage to print — a "Plate: -" row would just be noise.
  const subjectRows = isCounterSale(workOrder)
    ? customerName
      ? `<div class="row"><span>${escapeHtml(translate('receipt.customerLabel'))}</span><span><strong>${escapeHtml(customerName)}</strong></span></div>
      <div class="divider"></div>`
      : ''
    : `<div class="row"><span>${escapeHtml(translate('receipt.plateLabel'))}</span><span><strong>${escapeHtml(plate)}</strong></span></div>
      <div class="row"><span>${escapeHtml(translate('receipt.mileageLabel'))}</span><span>${currentOdometer != null ? escapeHtml(formatDistance(currentOdometer)) : '-'}</span></div>
      <div class="divider"></div>`
  const paperWidth = normalizePaperWidth(settings?.paperWidth)
  const autoPrint = settings?.autoPrint ?? true
  const shopName = settings?.shopName || translate('receipt.defaultShopName')
  // A completed order still awaiting payment prints as an invoice: titled, and
  // with room for the customer to sign for it. A voided one is no longer owed.
  const invoice = isUnpaidCompleted(workOrder)

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Receipt ${escapeHtml(orderLabel(workOrder.orderNumber, workOrder.orderNumberSuffix))}</title>${receiptStyles(paperWidth)}</head>
    <body>
      <div class="header">
        <h1>${escapeHtml(shopName)}</h1>
        ${settings?.shopAddress ? `<p>${escapeHtml(settings.shopAddress)}</p>` : ''}
        ${settings?.shopPhone ? `<p>${escapeHtml(settings.shopPhone)}</p>` : ''}
      </div>
      ${invoice ? `<p class="doc-title">${escapeHtml(translate('receipt.invoiceTitle'))}</p>` : ''}
      <div class="divider"></div>
      <div class="row"><span>${escapeHtml(translate('receipt.orderNumberLabel'))}</span><span><strong>${escapeHtml(orderLabel(workOrder.orderNumber, workOrder.orderNumberSuffix))}</strong></span></div>
      <div class="row"><span>${escapeHtml(translate('receipt.dateLabel'))}</span><span>${formatDate(orderDate)}</span></div>
      <div class="row"><span>${escapeHtml(translate('receipt.timeLabel'))}</span><span>${formatTime(orderDate)}</span></div>
      <div class="divider"></div>
      ${subjectRows}
      ${renderItemsSection(translate('receipt.productsLabel'), itemGroups.products)}
      ${renderItemsSection(translate('receipt.servicesLabel'), itemGroups.services)}
      <div class="divider"></div>
      ${renderTotalsSection(workOrder)}
      ${invoice ? renderSignatures(customerName ?? null, shopName) : ''}
      ${renderDueReminder(dueLines)}
      <div class="footer">
        <p>${escapeHtml(settings?.footerText || translate('receipt.defaultFooterText'))}</p>
      </div>
      ${autoPrint
        ? '<script>window.onload = function() { window.print(); }</script>'
        : `<div class="print-actions"><button type="button" onclick="window.print()">${escapeHtml(translate('receipt.printButton'))}</button></div>`}
    </body>
    </html>
  `
}

export function printReceipt(
  workOrder: WorkOrder,
  settings?: ReceiptShopInfo,
) {
  // Printing is a shop-PC job (src/lib/app/environment.ts). The print buttons
  // are already disabled on a tablet; this also covers auto-print on complete.
  if (isTouchPrimary()) return
  const printWindow = openPrintWindow()
  if (!printWindow) return

  const content = renderReceiptHtml(workOrder, settings, collectReceiptData(workOrder))
  printWindow.document.write(content)
  printWindow.document.close()
}
