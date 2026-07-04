import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useWorkOrderStore, WorkOrder } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkerStore } from '../store/workerStore'
import { useSettingsStore } from '../store/settingsStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useToastStore } from '../store/toastStore'
import { printReceipt } from '../components/Receipt'
import { formatCurrency } from '../lib/currency'
import { formatDateTime } from '../lib/dates'
import { vehicleLabelWithPlate, ownerName, workerName, vehiclePlate } from '../lib/entities'
import { Pencil, Printer, Trash2 } from 'lucide-react'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Tabs } from '../components/ui/Tabs'
import { Badge } from '../components/ui/Badge'
import { Dialog, DialogFooter } from '../components/ui/Dialog'

type ViewMode = 'list' | 'edit'

export default function WorkOrders() {
  // Single-field selectors: this screen re-renders only when a slice it reads
  // changes, not on every mutation to any of these stores. Actions are stable
  // references in Zustand, so selecting them individually is safe.
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const addWorkOrder = useWorkOrderStore(s => s.addWorkOrder)
  const deleteWorkOrder = useWorkOrderStore(s => s.deleteWorkOrder)
  const completeWorkOrder = useWorkOrderStore(s => s.completeWorkOrder)
  const addItem = useWorkOrderStore(s => s.addItem)
  const removeItem = useWorkOrderStore(s => s.removeItem)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const vehicles = useVehicleStore(s => s.vehicles)
  const workers = useWorkerStore(s => s.workers)
  const getActiveWorkers = useWorkerStore(s => s.getActiveWorkers)
  const settings = useSettingsStore(s => s.settings)
  const products = useInventoryStore(s => s.products)
  const adjustStock = useInventoryStore(s => s.adjustStock)
  const showToast = useToastStore(s => s.show)

  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
  const [addMode, setAddMode] = useState<'inventory' | 'manual'>('inventory')
  const [itemDesc, setItemDesc] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [itemPrice, setItemPrice] = useState('')
  const [invProductId, setInvProductId] = useState('')
  const [invQty, setInvQty] = useState('1')

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
    setInvProductId('')
    setInvQty('1')
  }

  useEffect(() => {
    if (searchParams.get('new')) {
      resetForm()
      // Preselect the owner when returning from an inline add-customer/company flow.
      const ownerTypeParam = searchParams.get('ownerType')
      const ownerIdParam = searchParams.get('ownerId')
      if (ownerTypeParam === 'customer' || ownerTypeParam === 'company') {
        setOwnerType(ownerTypeParam)
        if (ownerIdParam) setOwnerId(ownerIdParam)
      }
      const vehicleIdParam = searchParams.get('vehicleId')
      if (vehicleIdParam) setVehicleId(vehicleIdParam)
      setShowCreateDialog(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

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
    setShowCreateDialog(false)
  }

  const handleAddManualItem = () => {
    if (!editingId || !itemDesc || !itemPrice) return
    addItem(editingId, {
      description: itemDesc,
      quantity: parseFloat(itemQty) || 1,
      unitPrice: Math.round(parseFloat(itemPrice) || 0),
      productId: null,
    })
    setItemDesc('')
    setItemQty('1')
    setItemPrice('')
  }

  const handleAddInventoryItem = () => {
    if (!editingId || !invProductId) return
    const product = products.find(p => p.id === invProductId)
    if (!product) return
    const qty = parseFloat(invQty) || 1

    // Out-of-stock / insufficient-stock guard — block the add and notify.
    if (product.qtyOnHand <= 0) {
      showToast({
        tone: 'danger',
        title: 'Stok habis',
        description: `${product.name} tidak bisa ditambahkan — stok 0.`,
      })
      return
    }
    if (qty > product.qtyOnHand) {
      showToast({
        tone: 'warning',
        title: 'Stok tidak cukup',
        description: `Hanya tersisa ${product.qtyOnHand} ${product.unit} untuk ${product.name}.`,
      })
      return
    }

    addItem(editingId, {
      description: product.name,
      quantity: qty,
      unitPrice: product.sellPrice,
      productId: product.id,
    })
    setInvProductId('')
    setInvQty('1')
  }

  const handleComplete = (paymentMethod: WorkOrder['paymentMethod']) => {
    if (payingOrderId) {
      completeWorkOrder(payingOrderId, paymentMethod)
      const completedOrder = workOrders.find(wo => wo.id === payingOrderId)
      if (completedOrder) {
        // Auto-deduct inventory for any line items sourced from a product
        completedOrder.items.forEach(item => {
          if (item.productId) adjustStock(item.productId, -item.quantity)
        })
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

  const getVehicleDisplay = (vehicleId: string) => vehicleLabelWithPlate(vehicles.find(x => x.id === vehicleId))
  const getOwnerName = (vehicleId: string) => ownerName(vehicles.find(x => x.id === vehicleId), customers, companies)
  const getWorkerName = (workerId: string | null) => workerName(workerId, workers)
  const getVehiclePlate = (vehicleId: string) => vehiclePlate(vehicles.find(x => x.id === vehicleId))

  const editingOrder = editingId ? workOrders.find(wo => wo.id === editingId) : null

  const deletingOrder = deletingId ? workOrders.find(wo => wo.id === deletingId) : null

  const deleteDialog = (
    <Dialog open={!!deletingId} onClose={() => setDeletingId(null)} title="Delete order" size="sm">
      <p>
        Delete order <span className="font-mono text-text-primary">SB-{deletingOrder?.orderNumber}</span>? This can't be undone.
      </p>
      <DialogFooter>
        <button
          type="button"
          onClick={() => setDeletingId(null)}
          className="px-4 py-2 text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          onClick={() => { if (deletingId) deleteWorkOrder(deletingId); setDeletingId(null) }}
          className="bg-danger text-white px-4 py-2 rounded-radius-sm hover:brightness-110 transition-all font-medium"
        >
          Delete
        </button>
      </DialogFooter>
    </Dialog>
  )

  const createOrderDialog = (
    <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} title="New Service Order" size="lg">
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
            onChange={e => {
              const v = e.target.value
              if (v === '__add_new__') {
                navigate(ownerType === 'customer'
                  ? '/customers?new=1&fromOrder=1'
                  : '/companies?new=1&fromOrder=1')
                return
              }
              setOwnerId(v); setVehicleId('')
            }}
            className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">Select {ownerType === 'customer' ? 'customer' : 'company'}...</option>
            {ownerType === 'customer'
              ? customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)
              : companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)
            }
            <option value="__add_new__">
              + Add new {ownerType === 'customer' ? 'customer' : 'company'}…
            </option>
          </select>
        </div>

        {ownerId && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Vehicle</label>
            {ownerVehicles.length === 0 ? (
              <div className="flex items-center gap-3">
                <p className="text-text-secondary text-sm">No vehicles found for this {ownerType}.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/vehicles?new=1&fromOrder=1&ownerType=${ownerType}&ownerId=${ownerId}`)}
                  className="text-accent text-sm hover:underline"
                >
                  + Add new vehicle
                </button>
              </div>
            ) : (
              <select
                value={vehicleId}
                onChange={e => {
                  const v = e.target.value
                  if (v === '__add_new__') {
                    navigate(`/vehicles?new=1&fromOrder=1&ownerType=${ownerType}&ownerId=${ownerId}`)
                    return
                  }
                  setVehicleId(v)
                }}
                className="w-full bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select vehicle...</option>
                {ownerVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.year} {v.make} {v.model} - {v.licensePlate}
                  </option>
                ))}
                <option value="__add_new__">+ Add new vehicle…</option>
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
      </div>

      <DialogFooter>
        <button
          type="button"
          onClick={() => setShowCreateDialog(false)}
          className="px-4 py-2 text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!vehicleId}
          className="bg-accent text-fg-inverse px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity disabled:bg-surface-sunken disabled:text-text-secondary font-medium"
        >
          Create Work Order &rarr;
        </button>
      </DialogFooter>
    </Dialog>
  )

  // List View
  if (viewMode === 'list') {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="mb-2">
          <h1 className="text-page-title text-text-primary">Service orders</h1>
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
          <div className="bg-surface-card rounded-radius-md flex-1 min-h-0 overflow-x-auto overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-surface-card z-10">
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
                          { label: 'Delete', icon: Trash2, onClick: () => setDeletingId(wo.id), variant: 'danger' as const },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {createOrderDialog}
        {deleteDialog}
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
              <p><span className="text-text-secondary">Date:</span> <span className="text-text-primary tabular-nums">{formatDateTime(editingOrder.createdAt)}</span></p>
              {editingOrder.notes && <p><span className="text-text-secondary">Notes:</span> <span className="text-text-primary">{editingOrder.notes}</span></p>}
            </div>
          </div>

          {/* Line Items */}
          <div className="lg:col-span-2 bg-surface-card rounded-radius-md p-4">
            <h2 className="font-semibold text-text-primary mb-3">Services & Products</h2>

            {editingOrder.status === 'open' && (
              <div className="mb-4">
                <Tabs
                  className="mb-3"
                  value={addMode}
                  onChange={v => setAddMode(v as 'inventory' | 'manual')}
                  tabs={[
                    { value: 'inventory', label: 'From inventory' },
                    { value: 'manual', label: 'Manual' },
                  ]}
                />

                {addMode === 'inventory' ? (
                  <div className="flex gap-2">
                    <select
                      value={invProductId}
                      onChange={e => setInvProductId(e.target.value)}
                      className="flex-1 bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="">Select product…</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(p.sellPrice)} · stok {p.qtyOnHand} {p.unit}
                          {p.qtyOnHand <= 0 ? ' — habis' : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={invQty}
                      onChange={e => setInvQty(e.target.value)}
                      placeholder="Qty"
                      className="w-16 bg-surface-sunken border border-border-subtle rounded-radius-sm p-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleAddInventoryItem}
                      disabled={!invProductId}
                      className="bg-accent text-fg-inverse px-3 rounded-radius-sm hover:opacity-90 transition-opacity disabled:bg-surface-sunken disabled:text-text-secondary"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
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
                      onClick={handleAddManualItem}
                      className="bg-accent text-fg-inverse px-3 rounded-radius-sm hover:opacity-90 transition-opacity"
                    >
                      Add
                    </button>
                  </div>
                )}
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
          </div>
        </div>

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

        {createOrderDialog}
      </div>
    )
  }

  return null
}
