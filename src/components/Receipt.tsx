import { WorkOrder } from '../store/workOrderStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useWorkerStore } from '../store/workerStore'
import { formatCurrency } from '../lib/currency'

const NEXT_SERVICE_MILES = 3000

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
  const { vehicles } = useVehicleStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { workers } = useWorkerStore()

  const vehicle = vehicles.find(v => v.id === workOrder.vehicleId)
  const worker = workOrder.workerId ? workers.find(w => w.id === workOrder.workerId) : null

  let ownerName = 'Unknown'
  let ownerPhone = ''
  if (vehicle?.customerId) {
    const customer = customers.find(c => c.id === vehicle.customerId)
    ownerName = customer?.name || 'Unknown'
    ownerPhone = customer?.phone || ''
  } else if (vehicle?.companyId) {
    const company = companies.find(c => c.id === vehicle.companyId)
    ownerName = company?.companyName || 'Unknown'
    ownerPhone = company?.phone || ''
  }

  const vehicleDisplay = vehicle
    ? `${vehicle.year || ''} ${vehicle.make} ${vehicle.model}`.trim()
    : 'Unknown Vehicle'

  const nextServiceMiles = workOrder.mileageIn ? workOrder.mileageIn + NEXT_SERVICE_MILES : null

  const orderDate = new Date(workOrder.completedAt || workOrder.createdAt)

  return (
    <div className="receipt-content bg-white p-6 max-w-[300px] mx-auto font-mono text-sm">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold">{shopName || 'Oil Change Shop'}</h1>
        {shopAddress && <p className="text-xs">{shopAddress}</p>}
        {shopPhone && <p className="text-xs">{shopPhone}</p>}
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Order Info */}
      <div className="mb-3">
        <div className="flex justify-between">
          <span>Order #:</span>
          <span className="font-bold">{workOrder.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDate(orderDate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Time:</span>
          <span>{formatTime(orderDate)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Customer & Vehicle */}
      <div className="mb-3">
        <p><strong>Customer:</strong> {ownerName}</p>
        {ownerPhone && <p><strong>Phone:</strong> {ownerPhone}</p>}
        <p><strong>Vehicle:</strong> {vehicleDisplay}</p>
        {vehicle?.licensePlate && <p><strong>Plate:</strong> {vehicle.licensePlate}</p>}
        {workOrder.mileageIn && <p><strong>Mileage:</strong> {workOrder.mileageIn.toLocaleString()}</p>}
        {worker && <p><strong>Tech:</strong> {worker.name}</p>}
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Line Items */}
      <div className="mb-3">
        <p className="font-bold mb-2">Services:</p>
        {workOrder.items?.map(item => (
          <div key={item.id} className="flex justify-between mb-1">
            <span className="flex-1">
              {item.quantity > 1 && `${item.quantity}x `}{item.description}
            </span>
            <span className="ml-2">{formatCurrency(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Totals */}
      <div className="mb-3">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(workOrder.subtotal)}</span>
        </div>
        {workOrder.discountAmount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Discount ({workOrder.discountPercent}%):</span>
            <span>-{formatCurrency(workOrder.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tax ({workOrder.taxPercent}%):</span>
          <span>{formatCurrency(workOrder.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-bold text-base mt-1">
          <span>TOTAL:</span>
          <span>{formatCurrency(workOrder.total)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Payment:</span>
          <span className="capitalize">{workOrder.paymentMethod}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* Next Service Reminder */}
      {nextServiceMiles && (
        <div className="text-center mb-3 p-2 bg-slate-100 rounded">
          <p className="font-bold">Next Service Due:</p>
          <p>{nextServiceMiles.toLocaleString()} miles</p>
          <p className="text-xs">or 3 months</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs">
        <p>{footerText || 'Thank you for your business!'}</p>
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
    alert('Please allow pop-ups to print receipts')
    return
  }

  const orderDate = new Date(workOrder.completedAt || workOrder.createdAt)
  const nextServiceMiles = workOrder.mileageIn ? workOrder.mileageIn + NEXT_SERVICE_MILES : null

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

  const itemsHtml = (workOrder.items || []).map(item => `
    <div class="item">
      <span>${item.quantity > 1 ? item.quantity + 'x ' : ''}${escapeHtml(item.description)}</span>
      <span>${formatCurrency(item.lineTotal)}</span>
    </div>
  `).join('')

  const content = `
    <!DOCTYPE html>
    <html>
    <head><title>Receipt #${escapeHtml(String(workOrder.orderNumber))}</title>${styles}</head>
    <body>
      <div class="header">
        <h1>${escapeHtml(settings?.shopName || 'Oil Change Shop')}</h1>
        ${settings?.shopAddress ? `<p>${escapeHtml(settings.shopAddress)}</p>` : ''}
        ${settings?.shopPhone ? `<p>${escapeHtml(settings.shopPhone)}</p>` : ''}
      </div>
      <div class="divider"></div>
      <div class="row"><span>Order #:</span><span><strong>${escapeHtml(String(workOrder.orderNumber))}</strong></span></div>
      <div class="row"><span>Date:</span><span>${formatDate(orderDate)}</span></div>
      <div class="row"><span>Time:</span><span>${formatTime(orderDate)}</span></div>
      <div class="divider"></div>
      <div class="row"><span>Mileage:</span><span>${workOrder.mileageIn?.toLocaleString() || '-'}</span></div>
      <div class="divider"></div>
      <div class="items">
        <p class="label">Services:</p>
        ${itemsHtml}
      </div>
      <div class="divider"></div>
      <div class="row"><span>Subtotal:</span><span>${formatCurrency(workOrder.subtotal)}</span></div>
      ${workOrder.discountAmount > 0 ? `<div class="row"><span>Discount (${workOrder.discountPercent}%):</span><span>-${formatCurrency(workOrder.discountAmount)}</span></div>` : ''}
      <div class="row"><span>Tax (${workOrder.taxPercent}%):</span><span>${formatCurrency(workOrder.taxAmount)}</span></div>
      <div class="row total-row"><span>TOTAL:</span><span>${formatCurrency(workOrder.total)}</span></div>
      <div class="row"><span>Payment:</span><span style="text-transform:capitalize">${escapeHtml(workOrder.paymentMethod)}</span></div>
      ${nextServiceMiles ? `
        <div class="divider"></div>
        <div class="reminder">
          <strong>Next Service Due:</strong><br>
          ${nextServiceMiles.toLocaleString()} miles<br>
          <small>or 3 months</small>
        </div>
      ` : ''}
      <div class="footer">
        <p>${escapeHtml(settings?.footerText || 'Thank you for your business!')}</p>
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `

  printWindow.document.write(content)
  printWindow.document.close()
}
