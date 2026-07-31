import { WorkOrder } from '../store/workOrderStore'
import { useToastStore } from '../store/toastStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useWorkerStore } from '../store/workerStore'
import { formatCurrency } from '../lib/currency'
import { formatDistance } from '../lib/units'
import { buildDueLinesText } from '../lib/receiptDueLines'
import { groupOrderItemsByType } from '../lib/orderItemGroups'
import { translate, useTranslation } from '../lib/i18n'

const PAYMENT_METHOD_KEYS: Record<string, string> = {
  cash: 'paymentCash', qris: 'paymentQris', card: 'paymentCard', check: 'paymentCheck', pending: 'paymentPending',
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatDate(date: Date): string {
  return date.toLocaleDateString()
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface ReceiptProps {
  workOrder: WorkOrder
  shopName?: string
  shopAddress?: string
  shopPhone?: string
  footerText?: string
}

export default function Receipt({ workOrder, shopName, shopAddress, shopPhone, footerText }: ReceiptProps) {
  const { t } = useTranslation()
  const { vehicles } = useVehicleStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { workers } = useWorkerStore()

  const vehicle = vehicles.find(v => v.id === workOrder.vehicleId)
  const worker = workOrder.workerId ? workers.find(w => w.id === workOrder.workerId) : null

  let ownerName = t('receipt.unknownOwner')
  let ownerPhone = ''
  if (vehicle?.customerId) {
    const customer = customers.find(c => c.id === vehicle.customerId)
    ownerName = customer?.name || t('receipt.unknownOwner')
    ownerPhone = customer?.phone || ''
  } else if (vehicle?.companyId) {
    const company = companies.find(c => c.id === vehicle.companyId)
    ownerName = company?.companyName || t('receipt.unknownOwner')
    ownerPhone = company?.phone || ''
  }

  const vehicleDisplay = vehicle
    ? `${vehicle.year || ''} ${vehicle.make} ${vehicle.model}`.trim()
    : t('receipt.unknownVehicle')

  const currentOdometer = workOrder.odometerAtService ?? workOrder.odometerAtArrival
  const dueLines = currentOdometer != null ? buildDueLinesText(workOrder.vehicleId) : []
  const itemGroups = groupOrderItemsByType(workOrder.items ?? [])

  const orderDate = new Date(workOrder.completedAt || workOrder.createdAt)

  return (
    <div className="receipt-content bg-white p-6 max-w-[300px] mx-auto font-mono text-sm">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold">{shopName || t('receipt.defaultShopName')}</h1>
        {shopAddress && <p className="text-xs">{shopAddress}</p>}
        {shopPhone && <p className="text-xs">{shopPhone}</p>}
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Order Info */}
      <div className="mb-3">
        <div className="flex justify-between">
          <span>{t('receipt.orderNumberLabel')}</span>
          <span className="font-bold">{workOrder.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('receipt.dateLabel')}</span>
          <span>{formatDate(orderDate)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('receipt.timeLabel')}</span>
          <span>{formatTime(orderDate)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Customer & Vehicle */}
      <div className="mb-3">
        <p><strong>{t('receipt.customerLabel')}</strong> {ownerName}</p>
        {ownerPhone && <p><strong>{t('receipt.phoneLabel')}</strong> {ownerPhone}</p>}
        <p><strong>{t('receipt.vehicleLabel')}</strong> {vehicleDisplay}</p>
        {vehicle?.licensePlate && <p><strong>{t('receipt.plateLabel')}</strong> {vehicle.licensePlate}</p>}
        {currentOdometer != null && <p><strong>{t('receipt.mileageLabel')}</strong> {formatDistance(currentOdometer)}</p>}
        {worker && <p><strong>{t('receipt.techLabel')}</strong> {worker.name}</p>}
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Line Items — Products and Services shown as separate sections */}
      <div className="mb-3">
        {itemGroups.products.length > 0 && (
          <div className="mb-2">
            <p className="font-bold mb-1">{t('receipt.productsLabel')}</p>
            {itemGroups.products.map(item => (
              <div key={item.id} className="flex justify-between mb-1">
                <span className="flex-1">
                  {item.quantity > 1 && `${item.quantity}x `}{item.description}
                </span>
                <span className="ml-2">{formatCurrency(item.lineTotal)}</span>
              </div>
            ))}
          </div>
        )}
        {itemGroups.services.length > 0 && (
          <div>
            <p className="font-bold mb-1">{t('receipt.servicesLabel')}</p>
            {itemGroups.services.map(item => (
              <div key={item.id} className="flex justify-between mb-1">
                <span className="flex-1">
                  {item.quantity > 1 && `${item.quantity}x `}{item.description}
                </span>
                <span className="ml-2">{formatCurrency(item.lineTotal)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Totals */}
      <div className="mb-3">
        <div className="flex justify-between">
          <span>{t('receipt.subtotalLabel')}</span>
          <span>{formatCurrency(workOrder.subtotal)}</span>
        </div>
        {workOrder.discountAmount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>{t('receipt.discountLabel')}</span>
            <span>-{formatCurrency(workOrder.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>{t('receipt.taxLabel', { percent: workOrder.taxPercent })}</span>
          <span>{formatCurrency(workOrder.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-bold text-base mt-1">
          <span>{t('receipt.totalLabel')}</span>
          <span>{formatCurrency(workOrder.total)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>{t('receipt.paymentLabel')}</span>
          <span>{t(`receipt.${PAYMENT_METHOD_KEYS[workOrder.paymentMethod] ?? 'paymentPending'}`)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Next Service Reminder */}
      {dueLines.length > 0 && (
        <div className="text-center mb-3 p-2 bg-slate-100 rounded">
          <p className="font-bold mb-1">{t('receipt.nextDueLabel')}</p>
          {dueLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs">
        <p>{footerText || t('receipt.defaultFooterText')}</p>
        <p className="mt-2 text-slate-500">
          {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export function printReceipt(workOrder: WorkOrder, settings?: { shopName?: string; shopAddress?: string; shopPhone?: string; footerText?: string }) {
  const printWindow = window.open('', '_blank', 'width=350,height=600')
  if (!printWindow) {
    // Outside React, so use the store's imperative API rather than a hook.
    useToastStore.getState().show({ tone: 'danger', title: translate('receipt.popupsBlocked') })
    return
  }

  const orderDate = new Date(workOrder.completedAt || workOrder.createdAt)
  const currentOdometer = workOrder.odometerAtService ?? workOrder.odometerAtArrival
  const dueLines = currentOdometer != null ? buildDueLinesText(workOrder.vehicleId) : []
  const itemGroups = groupOrderItemsByType(workOrder.items ?? [])

  const styles = `
    <style>
      body {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        padding: 10px;
        max-width: 280px;
        margin: 0 auto;
      }
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
      @media print {
        body { padding: 0; }
      }
    </style>
  `

  const renderItemHtml = (item: WorkOrder['items'][number]) => `
    <div class="item">
      <span>${item.quantity > 1 ? item.quantity + 'x ' : ''}${escapeHtml(item.description)}</span>
      <span>${formatCurrency(item.lineTotal)}</span>
    </div>
  `
  const productsHtml = itemGroups.products.map(renderItemHtml).join('')
  const servicesHtml = itemGroups.services.map(renderItemHtml).join('')

  const content = `
    <!DOCTYPE html>
    <html>
    <head><title>Receipt #${escapeHtml(String(workOrder.orderNumber))}</title>${styles}</head>
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
      <div class="row"><span>${escapeHtml(translate('receipt.mileageLabel'))}</span><span>${currentOdometer != null ? formatDistance(currentOdometer) : '-'}</span></div>
      <div class="divider"></div>
      ${productsHtml ? `
      <div class="items">
        <p class="label">${escapeHtml(translate('receipt.productsLabel'))}</p>
        ${productsHtml}
      </div>
      ` : ''}
      ${servicesHtml ? `
      <div class="items">
        <p class="label">${escapeHtml(translate('receipt.servicesLabel'))}</p>
        ${servicesHtml}
      </div>
      ` : ''}
      <div class="divider"></div>
      <div class="row"><span>${escapeHtml(translate('receipt.subtotalLabel'))}</span><span>${formatCurrency(workOrder.subtotal)}</span></div>
      ${workOrder.discountAmount > 0 ? `<div class="row"><span>${escapeHtml(translate('receipt.discountLabel'))}</span><span>-${formatCurrency(workOrder.discountAmount)}</span></div>` : ''}
      <div class="row"><span>${escapeHtml(translate('receipt.taxLabel', { percent: workOrder.taxPercent }))}</span><span>${formatCurrency(workOrder.taxAmount)}</span></div>
      <div class="row total-row"><span>${escapeHtml(translate('receipt.totalLabel'))}</span><span>${formatCurrency(workOrder.total)}</span></div>
      <div class="row"><span>${escapeHtml(translate('receipt.paymentLabel'))}</span><span>${escapeHtml(translate(`receipt.${PAYMENT_METHOD_KEYS[workOrder.paymentMethod] ?? 'paymentPending'}`))}</span></div>
      ${dueLines.length > 0 ? `
        <div class="divider"></div>
        <div class="reminder">
          <strong>${escapeHtml(translate('receipt.nextDueLabel'))}</strong><br>
          ${dueLines.map(line => escapeHtml(line)).join('<br>')}
        </div>
      ` : ''}
      <div class="footer">
        <p>${escapeHtml(settings?.footerText || translate('receipt.defaultFooterText'))}</p>
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `

  printWindow.document.write(content)
  printWindow.document.close()
}
