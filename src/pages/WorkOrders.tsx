import { useState } from 'react'
import { useWorkOrderStore, WorkOrder } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkerStore } from '../store/workerStore'
import { useSettingsStore } from '../store/settingsStore'
import { useInspectionStore } from '../store/inspectionStore'
import { printReceipt } from '../components/Receipt'
import { formatCurrency } from '../lib/currency'
import { InspectionChecklist } from '../components/InspectionChecklist'
import { ClipboardCheck, Pencil, Printer, Trash2 } from 'lucide-react'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Tabs } from '../components/ui/Tabs'
import { Badge } from '../components/ui/Badge'

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type ViewMode = 'list' | 'create' | 'edit'

export default function WorkOrders() {
  const { workOrders, addWorkOrder, deleteWorkOrder, completeWorkOrder, addItem, removeItem } = useWorkOrderStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { vehicles } = useVehicleStore()
  const { workers, getActiveWorkers } = useWorkerStore()
  const { settings } = useSettingsStore()
  const { getInspectionByWorkOrder, addInspection } = useInspectionStore()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('all')
  const [showInspection, setShowInspection] = useState(false)

  // Form state
  const [ownerType, setOwnerType] = useState<'customer' | 'company'>('customer')
  const [ownerId, setOwnerId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [mileageIn, setMileageIn] = useState('')
  const [notes, setNotes] = useState('')
  const [discountPercent, setDiscountPercent] = useState('0')
  const [taxPercent, setTaxPercent] = useState('8.25')

  // Line item form
  const [itemDesc, setItemDesc] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [itemPrice, setItemPrice] = useState('')

  // Payment modal
  const [showPayment, setShowPayment] = useState(false)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)

  const activeWorkers = getActiveWorkers()

  const filteredOrders = workOrders.filter(wo => {
    if (filter === 'open') return wo.status === 'open'
    if (filter === 'completed') return wo.status === 'completed'
    return true
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const ownerVehicles = vehicles.filter(v =>
    ownerType === 'customer'
      ? v.customerId === ownerId
      : v.companyId === ownerId
  )

  const selectedCompany = companies.find(c => c.id === ownerId)

  const resetForm = () => {
    setOwnerType('customer')
    setOwnerId('')
    setVehicleId('')
    setWorkerId('')
    setDriverId('')
    setMileageIn('')
    setNotes('')
    setDiscountPercent('0')
    setTaxPercent('8.25')
    setItemDesc('')
    setItemQty('1')
    setItemPrice('')
  }

  const handleCreate = () => {
    if (!vehicleId) return alert('Please select a vehicle')

    const wo = addWorkOrder({
      vehicleId,
      workerId: workerId || null,
      driverId: driverId || null,
      mileageIn: mileageIn ? parseInt(mileageIn) : null,
      date: new Date().toISOString(),
      items: [],
      subtotal: 0,
      discountPercent: parseFloat(discountPercent) || 0,
      discountAmount: 0,
      taxPercent: parseFloat(taxPercent) || 0,
      taxAmount: 0,
      total: 0,
      paymentMethod: 'pending',
      status: 'open',
      notes,
    })
    setEditingId(wo.id)
    setViewMode('edit')
  }

  const handleAddItem = () => {
    if (!editingId || !itemDesc || !itemPrice) return
    addItem(editingId, {
      description: itemDesc,
      quantity: parseFloat(itemQty) || 1,
      unitPrice: Math.round(parseFloat(itemPrice) || 0),
    })
    setItemDesc('')
    setItemQty('1')
    setItemPrice('')
  }

  const handleComplete = (paymentMethod: WorkOrder['paymentMethod']) => {
    if (payingOrderId) {
      completeWorkOrder(payingOrderId, paymentMethod)
      const completedOrder = workOrders.find(wo => wo.id === payingOrderId)
      if (completedOrder) {
        printReceipt({ ...completedOrder, status: 'completed', paymentMethod }, {
          shopName: settings.shopName,
          shopAddress: settings.shopAddress,
          shopPhone: settings.shopPhone,
          footerText: settings.receiptFooter,
        })
      }
      setShowPayment(false)
      setPayingOrderId(null)
      setViewMode('list')
      setEditingId(null)
    }
  }

  const handlePrintReceipt = (wo: WorkOrder) => {
    printReceipt(wo, {
      shopName: settings.shopName,
      shopAddress: settings.shopAddress,
      shopPhone: settings.shopPhone,
      footerText: settings.receiptFooter,
    })
  }

  const getVehicleDisplay = (vehicleId: string) => {
    const v = vehicles.find(x => x.id === vehicleId)
    if (!v) return 'Unknown'
    return `${v.year || ''} ${v.make} ${v.model} - ${v.licensePlate}`.trim()
  }

  const getOwnerName = (vehicleId: string) => {
    const v = vehicles.find(x => x.id === vehicleId)
    if (!v) return 'Unknown'
    if (v.customerId) {
      const c = customers.find(x => x.id === v.customerId)
      return c?.name || 'Unknown Customer'
    }
    if (v.companyId) {
      const c = companies.find(x => x.id === v.companyId)
      return c?.companyName || 'Unknown Company'
    }
    return 'No Owner'
  }

  const getWorkerName = (workerId: string | null) => {
    if (!workerId) return '-'
    const w = workers.find(x => x.id === workerId)
    return w?.name || 'Unknown'
  }

  const getVehiclePlate = (vehicleId: string) => {
    const v = vehicles.find(x => x.id === vehicleId)
    return v?.licensePlate || '-'
  }

  const editingOrder = editingId ? workOrders.find(wo => wo.id === editingId) : null
  const currentInspection = editingOrder ? getInspectionByWorkOrder(editingOrder.id) : undefined

  const handleStartInspection = () => {
    if (!editingOrder) return
    const vehicle = vehicles.find(v => v.id === editingOrder.vehicleId)
    if (!vehicle) return

    // Create new inspection if none exists
    if (!currentInspection) {
      addInspection(editingOrder.id, vehicle.id, editingOrder.workerId)
    }
    setShowInspection(true)
  }

  // List View
  if (viewMode === 'list') {
    return (
      <div className="p-6 max-w-[1200px]">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-page-title text-text-primary">Service orders</h1>
          <button
            onClick={() => { resetForm(); setViewMode('create') }}
            className="bg-accent text-fg-inverse px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
          >
            + New order
          </button>
        </div>
        <p className="text-sm text-fg-3 mb-4">Track every oil service order across bays and technicians.</p>

        <Tabs
          className="mb-4"
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          tabs={[
            { value: 'all', label: 'All', count: workOrders.length },
            { value: 'open', label: 'Open', count: workOrders.filter(wo => wo.status === 'open').length },
            { value: 'completed', label: 'Completed', count: workOrders.filter(wo => wo.status === 'completed').length },
          ]}
        />

        {filteredOrders.length === 0 ? (
          <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
            No work orders found.
          </div>
        ) : (
          <div className="bg-surface-card rounded-radius-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-1">
                  <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide text-fg-3">Order</th>
                  <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide text-fg-3">Owner</th>
                  <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide text-fg-3">Vehicle</th>
                  <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide text-fg-3">Plate</th>
                  <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide text-fg-3">Tech</th>
                  <th className="text-right p-4 text-xs font-semibold uppercase tracking-wide text-fg-3">Total</th>
                  <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide text-fg-3">Status</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(wo => (
                  <tr key={wo.id} className="border-b border-border-1 hover:bg-bg-3 transition-colors">
                    <td className="p-4 font-mono text-sm text-accent">SB-{wo.orderNumber}</td>
                    <td className="p-4 text-text-primary">{getOwnerName(wo.vehicleId)}</td>
                    <td className="p-4 text-sm text-text-secondary">{getVehicleDisplay(wo.vehicleId)}</td>
                    <td className="p-4 font-mono text-sm text-text-secondary">{getVehiclePlate(wo.vehicleId)}</td>
                    <td className="p-4 text-text-primary">{getWorkerName(wo.workerId)}</td>
                    <td className="p-4 text-right font-mono text-text-primary tabular-nums">{formatCurrency(wo.total)}</td>
                    <td className="p-4">
                      <Badge tone={wo.status === 'completed' ? 'success' : wo.status === 'cancelled' ? 'danger' : 'warning'} dot>
                        {wo.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <DropdownMenu
                        items={[
                          ...(wo.status === 'open' ? [{ label: 'Edit', icon: Pencil, onClick: () => { setEditingId(wo.id); setViewMode('edit') } }] : []),
                          ...(wo.status === 'completed' ? [{ label: 'Print', icon: Printer, onClick: () => handlePrintReceipt(wo) }] : []),
                          { label: 'Delete', icon: Trash2, onClick: () => { if(confirm('Delete this order?')) deleteWorkOrder(wo.id) }, variant: 'danger' as const },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // Create View - Step 1: Select Customer/Vehicle
  if (viewMode === 'create') {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setViewMode('list')} className="text-text-secondary hover:text-text-primary">
            &larr; Back
          </button>
          <h1 className="text-page-title text-text-primary">New Work Order</h1>
        </div>

        <div className="bg-surface-card rounded-radius-md p-6 max-w-2xl">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Owner Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-text-primary">
                  <input
                    type="radio"
                    checked={ownerType === 'customer'}
                    onChange={() => { setOwnerType('customer'); setOwnerId(''); setVehicleId('') }}
                    className="accent-accent"
                  />
                  Individual Customer
                </label>
                <label className="flex items-center gap-2 text-text-primary">
                  <input
                    type="radio"
                    checked={ownerType === 'company'}
                    onChange={() => { setOwnerType('company'); setOwnerId(''); setVehicleId('') }}
                    className="accent-accent"
                  />
                  Company / Fleet
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {ownerType === 'customer' ? 'Customer' : 'Company'}
              </label>
              <select
                value={ownerId}
                onChange={e => { setOwnerId(e.target.value); setVehicleId('') }}
                className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select {ownerType === 'customer' ? 'customer' : 'company'}...</option>
                {ownerType === 'customer'
                  ? customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)
                  : companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)
                }
              </select>
            </div>

            {ownerId && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Vehicle</label>
                {ownerVehicles.length === 0 ? (
                  <p className="text-text-secondary text-sm">No vehicles found for this {ownerType}.</p>
                ) : (
                  <select
                    value={vehicleId}
                    onChange={e => setVehicleId(e.target.value)}
                    className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="">Select vehicle...</option>
                    {ownerVehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model} - {v.licensePlate}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {ownerType === 'company' && selectedCompany && selectedCompany.drivers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Driver (Optional)</label>
                <select
                  value={driverId}
                  onChange={e => setDriverId(e.target.value)}
                  className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Select driver...</option>
                  {selectedCompany.drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Assigned Worker</label>
              <select
                value={workerId}
                onChange={e => setWorkerId(e.target.value)}
                className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select worker...</option>
                {activeWorkers.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Mileage In</label>
              <input
                type="number"
                value={mileageIn}
                onChange={e => setMileageIn(e.target.value)}
                placeholder="Current odometer reading"
                className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Discount %</label>
                <input
                  type="number"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(e.target.value)}
                  className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Tax %</label>
                <input
                  type="number"
                  value={taxPercent}
                  onChange={e => setTaxPercent(e.target.value)}
                  className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!vehicleId}
              className="w-full bg-accent text-fg-inverse py-2 rounded-radius-sm hover:opacity-90 transition-opacity disabled:bg-surface-sunken disabled:text-text-secondary font-medium"
            >
              Create Work Order &rarr;
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Edit View - Add line items and complete
  if (viewMode === 'edit' && editingOrder) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => { setViewMode('list'); setEditingId(null) }} className="text-text-secondary hover:text-text-primary">
            &larr; Back
          </button>
          <h1 className="text-page-title text-text-primary">
            Order SB-{editingOrder.orderNumber}
          </h1>
          <Badge tone={editingOrder.status === 'completed' ? 'success' : 'warning'} dot>
            {editingOrder.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Info */}
          <div className="bg-surface-card rounded-radius-md p-4">
            <h2 className="font-semibold text-text-primary mb-3">Order Info</h2>
            <div className="text-sm space-y-2">
              <p><span className="text-text-secondary">Customer:</span> <span className="text-text-primary">{getOwnerName(editingOrder.vehicleId)}</span></p>
              <p><span className="text-text-secondary">Vehicle:</span> <span className="text-text-primary">{getVehicleDisplay(editingOrder.vehicleId)}</span></p>
              <p><span className="text-text-secondary">Worker:</span> <span className="text-text-primary">{getWorkerName(editingOrder.workerId)}</span></p>
              <p><span className="text-text-secondary">Mileage:</span> <span className="text-text-primary tabular-nums">{editingOrder.mileageIn?.toLocaleString() || '-'}</span></p>
              <p><span className="text-text-secondary">Date:</span> <span className="text-text-primary tabular-nums">{formatDate(editingOrder.createdAt)}</span></p>
              {editingOrder.notes && <p><span className="text-text-secondary">Notes:</span> <span className="text-text-primary">{editingOrder.notes}</span></p>}
            </div>
          </div>

          {/* Line Items */}
          <div className="lg:col-span-2 bg-surface-card rounded-radius-md p-4">
            <h2 className="font-semibold text-text-primary mb-3">Services & Products</h2>

            {editingOrder.status === 'open' && (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={itemDesc}
                  onChange={e => setItemDesc(e.target.value)}
                  placeholder="Description (e.g., Oil Change - 5W30)"
                  className="flex-1 bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                />
                <input
                  type="number"
                  value={itemQty}
                  onChange={e => setItemQty(e.target.value)}
                  placeholder="Qty"
                  className="w-16 bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <input
                  type="number"
                  value={itemPrice}
                  onChange={e => setItemPrice(e.target.value)}
                  placeholder="Price"
                  className="w-24 bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleAddItem}
                  className="bg-accent text-fg-inverse px-3 rounded-radius-sm hover:opacity-90 transition-opacity"
                >
                  Add
                </button>
              </div>
            )}

            {editingOrder.items.length === 0 ? (
              <p className="text-text-secondary text-sm">No items added yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="text-left py-2 text-text-secondary font-medium">Description</th>
                    <th className="text-right py-2 text-text-secondary font-medium">Qty</th>
                    <th className="text-right py-2 text-text-secondary font-medium">Price</th>
                    <th className="text-right py-2 text-text-secondary font-medium">Total</th>
                    {editingOrder.status === 'open' && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {editingOrder.items.map(item => (
                    <tr key={item.id} className="border-b border-border-subtle">
                      <td className="py-2 text-text-primary">{item.description}</td>
                      <td className="py-2 text-right text-text-primary tabular-nums">{item.quantity}</td>
                      <td className="py-2 text-right text-text-primary tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 text-right text-text-primary tabular-nums">{formatCurrency(item.lineTotal)}</td>
                      {editingOrder.status === 'open' && (
                        <td className="py-2 text-right">
                          <button
                            onClick={() => removeItem(editingOrder.id, item.id)}
                            className="text-danger hover:opacity-80"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-border-subtle text-sm">
              <div className="flex justify-between text-text-secondary"><span>Subtotal:</span><span className="tabular-nums">{formatCurrency(editingOrder.subtotal)}</span></div>
              {editingOrder.discountAmount > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Discount ({editingOrder.discountPercent}%):</span>
                  <span className="tabular-nums">-{formatCurrency(editingOrder.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-text-secondary"><span>Tax ({editingOrder.taxPercent}%):</span><span className="tabular-nums">{formatCurrency(editingOrder.taxAmount)}</span></div>
              <div className="flex justify-between font-bold text-lg mt-2 text-text-primary">
                <span>Total:</span>
                <span className="tabular-nums">{formatCurrency(editingOrder.total)}</span>
              </div>
            </div>

            {editingOrder.status === 'open' && (
              <button
                onClick={() => { setPayingOrderId(editingOrder.id); setShowPayment(true) }}
                disabled={editingOrder.items.length === 0}
                className="mt-4 w-full bg-accent text-fg-inverse py-3 rounded-radius-sm hover:opacity-90 transition-opacity disabled:bg-surface-sunken disabled:text-text-secondary font-medium"
              >
                Complete & Pay
              </button>
            )}

            {/* Inspection Button */}
            <button
              onClick={handleStartInspection}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-surface-sunken border border-border-subtle text-text-primary py-3 rounded-radius-sm hover:border-accent/50 transition-colors font-medium"
            >
              <ClipboardCheck size={18} />
              {currentInspection ? (currentInspection.completed ? 'View Inspection' : 'Continue Inspection') : 'Start Inspection'}
            </button>
          </div>
        </div>

        {/* Inspection Modal */}
        {showInspection && currentInspection && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
            <div className="bg-surface-card rounded-radius-md w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-surface-card border-b border-border-subtle p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">
                  Vehicle Inspection - WO #{editingOrder.orderNumber}
                </h2>
                <button
                  onClick={() => setShowInspection(false)}
                  className="text-text-secondary hover:text-text-primary"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">
                <InspectionChecklist
                  inspection={currentInspection}
                  readOnly={editingOrder.status === 'completed'}
                  onComplete={() => setShowInspection(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPayment && (
          <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
            <div className="bg-surface-card rounded-radius-md p-6 w-80">
              <h3 className="text-lg font-bold text-text-primary mb-4">Select Payment Method</h3>
              <div className="space-y-2">
                {(['cash', 'card', 'check'] as const).map(method => (
                  <button
                    key={method}
                    onClick={() => handleComplete(method)}
                    className="w-full p-3 bg-surface-sunken border border-border-subtle rounded-radius-sm hover:border-accent text-left text-text-primary capitalize transition-colors"
                  >
                    {method}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPayment(false)}
                className="mt-4 w-full text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
