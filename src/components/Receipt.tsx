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
import { WorkOrder } from '../store/workOrderStore'
import type { Settings } from '../store/settingsStore'
import { useToastStore } from '../store/toastStore'
import { useVehicleStore } from '../store/vehicleStore'
import { formatCurrency } from '../lib/currency'
import { formatDate, formatTime } from '../lib/dates'
import { formatDistance } from '../lib/units'
import { buildDueLinesText } from '../lib/receiptDueLines'
import { groupOrderItemsByType, type OrderItemGroups } from '../lib/orderItemGroups'
import { vehiclePlate } from '../lib/entities'
import { translate } from '../lib/i18n'

const PAYMENT_METHOD_KEYS: Record<string, string> = {
  cash: 'paymentCash', qris: 'paymentQris', card: 'paymentCard', check: 'paymentCheck', pending: 'paymentPending',
}

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
// (no jsdom — see docs/ARCHITECTURE.md's ".tsx boundary is the test boundary").
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
  dueLines: string[]
  itemGroups: OrderItemGroups
  plate: string
}

/** Everything renderReceiptHtml needs beyond the order/settings themselves —
 *  the store/derived reads, gathered once before any markup is built. */
function collectReceiptData(workOrder: WorkOrder): ReceiptData {
  const orderDate = new Date(workOrder.completedAt || workOrder.createdAt)
  const currentOdometer = workOrder.odometerAtService ?? workOrder.odometerAtArrival
  const dueLines = currentOdometer != null ? buildDueLinesText(workOrder.vehicleId, currentOdometer) : []
  const itemGroups = groupOrderItemsByType(workOrder.items ?? [])
  const vehicle = useVehicleStore.getState().vehicles.find(v => v.id === workOrder.vehicleId)
  const plate = vehiclePlate(vehicle)
  return { orderDate, currentOdometer, dueLines, itemGroups, plate }
}

function receiptStyles(paperWidth: '58mm' | '80mm' | 'a4'): string {
  const bodyWidthCss =
    paperWidth === '58mm' ? 'max-width: 210px; font-size: 11px;'
    : paperWidth === 'a4' ? 'max-width: 340px; font-size: 12px;'
    : 'max-width: 280px; font-size: 12px;'
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
      .divider { border-top: 1px dashed #666; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; margin: 2px 0; }
      .label { font-weight: bold; }
      .items .item { display: flex; justify-content: space-between; margin: 4px 0; }
      .total-row { font-weight: bold; font-size: 14px; margin-top: 5px; }
      .reminder { text-align: center; background: #f0f0f0; padding: 8px; margin: 10px 0; }
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
  return `
    <div class="item">
      <span>${item.quantity > 1 ? item.quantity + 'x ' : ''}${escapeHtml(item.description)}</span>
      <span>${formatCurrency(item.lineTotal)}</span>
    </div>
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

/** The next-due block — empty string when nothing's due, same as before. */
function renderDueReminder(dueLines: string[]): string {
  if (dueLines.length === 0) return ''
  return `
        <div class="divider"></div>
        <div class="reminder">
          <strong>${escapeHtml(translate('receipt.nextDueLabel'))}</strong><br>
          ${dueLines.map(line => escapeHtml(line)).join('<br>')}
        </div>
      `
}

/** Pure: composes the whole printed document from an order, its shop-info
 *  settings, and the data collectReceiptData gathered — no DOM, no store
 *  reads, so escaping and layout are finally unit-testable directly. */
export function renderReceiptHtml(workOrder: WorkOrder, settings: ReceiptShopInfo | undefined, data: ReceiptData): string {
  const { orderDate, currentOdometer, dueLines, itemGroups, plate } = data
  const paperWidth = settings?.paperWidth ?? '80mm'
  const autoPrint = settings?.autoPrint ?? true

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Receipt #${escapeHtml(String(workOrder.orderNumber))}</title>${receiptStyles(paperWidth)}</head>
    <body>
      <div class="header">
        <h1>${escapeHtml(settings?.shopName || translate('receipt.defaultShopName'))}</h1>
        ${settings?.shopAddress ? `<p>${escapeHtml(settings.shopAddress)}</p>` : ''}
        ${settings?.shopPhone ? `<p>${escapeHtml(settings.shopPhone)}</p>` : ''}
      </div>
      <div class="divider"></div>
      <div class="row"><span>${escapeHtml(translate('receipt.orderNumberLabel'))}</span><span><strong>${escapeHtml(String(workOrder.orderNumber))}</strong></span></div>
      <div class="row"><span>${escapeHtml(translate('receipt.dateLabel'))}</span><span>${formatDate(orderDate)}</span></div>
      <div class="row"><span>${escapeHtml(translate('receipt.timeLabel'))}</span><span>${formatTime(orderDate)}</span></div>
      <div class="divider"></div>
      <div class="row"><span>${escapeHtml(translate('receipt.plateLabel'))}</span><span><strong>${escapeHtml(plate)}</strong></span></div>
      <div class="row"><span>${escapeHtml(translate('receipt.mileageLabel'))}</span><span>${currentOdometer != null ? formatDistance(currentOdometer) : '-'}</span></div>
      <div class="divider"></div>
      ${renderItemsSection(translate('receipt.productsLabel'), itemGroups.products)}
      ${renderItemsSection(translate('receipt.servicesLabel'), itemGroups.services)}
      <div class="divider"></div>
      ${renderTotalsSection(workOrder)}
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
  const printWindow = openPrintWindow()
  if (!printWindow) return

  const content = renderReceiptHtml(workOrder, settings, collectReceiptData(workOrder))
  printWindow.document.write(content)
  printWindow.document.close()
}
