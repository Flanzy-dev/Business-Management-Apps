import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useToastStore } from '../../store/toastStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Select, Textarea } from '../ui/Input'

interface QuickFindResult {
  vehicleId: string
  ownerType: 'customer' | 'company'
  ownerId: string
  plate: string
  vehicleLabel: string
  ownerLabel: string
}

/**
 * Only ever opened via the `?new=1` query param (see components/Layout.tsx's
 * "New Work Order" shortcut, and the "add new owner/vehicle" round-trips from
 * Vehicles/Customers/Companies) — there is no in-page trigger button.
 */
export function NewWorkOrderDialog({ onCreated }: { onCreated: (workOrderId: string) => void }) {
  const { t } = useTranslation()
  const addWorkOrder = useWorkOrderStore(s => s.addWorkOrder)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const vehicles = useVehicleStore(s => s.vehicles)
  const getActiveWorkers = useWorkerStore(s => s.getActiveWorkers)
  const settings = useSettingsStore(s => s.settings)
  const showToast = useToastStore(s => s.show)

  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [ownerType, setOwnerType] = useState<'customer' | 'company'>('customer')
  const [ownerId, setOwnerId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [notes, setNotes] = useState('')
  const [quickFind, setQuickFind] = useState('')
  const [quickFindHighlight, setQuickFindHighlight] = useState(0)

  const activeWorkers = getActiveWorkers()
  // Default vehicle first (stable sort keeps insertion order otherwise) — see
  // src/store/vehicleStore.ts's setDefaultVehicle for how isDefault is set.
  const ownerVehicles = vehicles
    .filter(v => ownerType === 'customer' ? v.customerId === ownerId : v.companyId === ownerId)
    .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault))
  const selectedCompany = companies.find(c => c.id === ownerId)

  const defaultVehicleFor = (type: 'customer' | 'company', id: string) =>
    vehicles.find(v => (type === 'customer' ? v.customerId === id : v.companyId === id) && v.isDefault)?.id ?? ''

  const resetForm = () => {
    setOwnerType('customer')
    setOwnerId('')
    setVehicleId('')
    setWorkerId('')
    setDriverId('')
    setNotes('')
    setQuickFind('')
    setQuickFindHighlight(0)
  }

  // Returning customers already know their plate, not which owner record it's
  // filed under — searching plate/VIN/owner-name across every vehicle at once
  // (like GlobalSearch, Ctrl+K) and setting owner+vehicle in one pick is much
  // faster than the type->owner->vehicle picker below, which stays as the
  // fallback for a vehicle staff can't recall by plate.
  const quickFindQuery = quickFind.trim().toLowerCase()
  const quickFindResults: QuickFindResult[] = []
  if (quickFindQuery.length >= 2) {
    for (const v of vehicles) {
      let ownerLabel: string | undefined
      let result: Pick<QuickFindResult, 'ownerType' | 'ownerId'> | undefined
      if (v.customerId) {
        const c = customers.find(c => c.id === v.customerId)
        if (c) { ownerLabel = c.name; result = { ownerType: 'customer', ownerId: c.id } }
      } else if (v.companyId) {
        const c = companies.find(c => c.id === v.companyId)
        if (c) { ownerLabel = c.companyName; result = { ownerType: 'company', ownerId: c.id } }
      }
      if (!result || !ownerLabel) continue
      const matches =
        v.licensePlate?.toLowerCase().includes(quickFindQuery) ||
        v.vin?.toLowerCase().includes(quickFindQuery) ||
        ownerLabel.toLowerCase().includes(quickFindQuery)
      if (!matches) continue
      quickFindResults.push({
        ...result,
        vehicleId: v.id,
        plate: v.licensePlate || t('globalSearch.noPlate'),
        vehicleLabel: `${v.year ?? ''} ${v.make} ${v.model}`.trim(),
        ownerLabel,
      })
      if (quickFindResults.length >= 6) break
    }
  }

  const selectQuickFindResult = (r: QuickFindResult) => {
    setOwnerType(r.ownerType)
    setOwnerId(r.ownerId)
    setVehicleId(r.vehicleId)
    setDriverId('')
    setQuickFind('')
    setQuickFindHighlight(0)
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
      const driverIdParam = searchParams.get('driverId')
      if (driverIdParam) setDriverId(driverIdParam)
      setOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  useEffect(() => {
    setQuickFindHighlight(0)
  }, [quickFind])

  const handleCreate = () => {
    if (!vehicleId) return showToast({ tone: 'danger', title: t('workOrders.pleaseSelectVehicle') })

    const wo = addWorkOrder({
      vehicleId,
      workerId: workerId || null,
      driverId: driverId || null,
      // Baseline is a snapshot of the vehicle's current odometer at the
      // moment the order is created — no manual entry. It only moves once
      // the tech records Odometer at Service (see the editor view).
      odometerAtArrival: vehicles.find(v => v.id === vehicleId)?.currentMileage ?? null,
      odometerAtService: null,
      date: new Date().toISOString(),
      items: [],
      subtotal: 0,
      // No discount/tax entry at creation — simpler than deciding per-order
      // up front. Discount stays adjustable once the order is open; tax
      // defaults to the shop's own configured rate instead of a hardcoded
      // value, so it's never disconnected from Settings.
      discountAmount: 0,
      taxPercent: settings.taxRate,
      taxAmount: 0,
      total: 0,
      paymentMethod: 'pending',
      status: 'open',
      notes,
    })
    setOpen(false)
    showToast({ tone: 'success', title: t('workOrders.orderCreatedTitle'), description: t('workOrders.orderCreatedDescription', { order: `SB-${wo.orderNumber}` }) })
    onCreated(wo.id)
  }

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t('workOrders.newServiceOrderTitle')} size="lg">
      <div className="space-y-4">
        <div className="relative">
          <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
            {t('workOrders.quickFindLabel')}
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
            <input
              type="text"
              value={quickFind}
              onChange={e => setQuickFind(e.target.value)}
              onKeyDown={e => {
                if (quickFindResults.length === 0) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setQuickFindHighlight(i => Math.min(i + 1, quickFindResults.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setQuickFindHighlight(i => Math.max(i - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  selectQuickFindResult(quickFindResults[quickFindHighlight])
                }
              }}
              placeholder={t('workOrders.quickFindPlaceholder')}
              className="w-full h-[34px] pl-9 pr-9 bg-surface-input border border-border-2 rounded-radius-sm text-fg-1 text-sm placeholder-fg-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)]"
            />
            {quickFind && (
              <button
                type="button"
                onClick={() => setQuickFind('')}
                aria-label={t('globalSearch.clearSearch')}
                className="absolute right-[8px] top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg-1 focus-ring"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {quickFindResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-surface-card border border-border-2 rounded-radius-sm shadow-lg">
              {quickFindResults.map((r, i) => (
                <button
                  key={r.vehicleId}
                  type="button"
                  onClick={() => selectQuickFindResult(r)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    i === quickFindHighlight ? 'bg-accent/20 text-accent' : 'text-text-primary hover:bg-surface-sunken'
                  }`}
                >
                  <span className="font-mono text-sm shrink-0">{r.plate}</span>
                  <span className="text-sm truncate flex-1">{r.vehicleLabel}</span>
                  <span className="text-caption shrink-0">{r.ownerLabel}</span>
                </button>
              ))}
            </div>
          )}
          {quickFindQuery.length >= 2 && quickFindResults.length === 0 && (
            <p className="mt-1.5 text-xs text-fg-3">{t('workOrders.quickFindNoResults')}</p>
          )}
        </div>

        <div>
          <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('workOrders.ownerTypeLabel')}</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="radio"
                checked={ownerType === 'customer'}
                onChange={() => { setOwnerType('customer'); setOwnerId(''); setVehicleId('') }}
                className="accent-accent"
              />
              {t('workOrders.individualCustomer')}
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="radio"
                checked={ownerType === 'company'}
                onChange={() => { setOwnerType('company'); setOwnerId(''); setVehicleId('') }}
                className="accent-accent"
              />
              {t('workOrders.companyFleet')}
            </label>
          </div>
        </div>

        <Select
          label={ownerType === 'customer' ? t('workOrders.customerLabel') : t('workOrders.companyLabel')}
          value={ownerId}
          onChange={e => {
            const v = e.target.value
            if (v === '__add_new__') {
              navigate(ownerType === 'customer'
                ? '/customers?new=1&fromOrder=1'
                : '/companies?new=1&fromOrder=1')
              return
            }
            setOwnerId(v); setVehicleId(defaultVehicleFor(ownerType, v))
          }}
        >
          <option value="">{ownerType === 'customer' ? t('workOrders.selectCustomer') : t('workOrders.selectCompany')}</option>
          {ownerType === 'customer'
            ? customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)
            : companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)
          }
          <option value="__add_new__">
            {ownerType === 'customer' ? t('workOrders.addNewCustomer') : t('workOrders.addNewCompany')}
          </option>
        </Select>

        {ownerId && (
          <div>
            <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('workOrders.vehicleLabel')}</label>
            {ownerVehicles.length === 0 ? (
              <div className="flex items-center gap-3">
                <p className="text-text-secondary text-sm">{ownerType === 'customer' ? t('workOrders.noVehiclesForCustomer') : t('workOrders.noVehiclesForCompany')}</p>
                <button
                  type="button"
                  onClick={() => navigate(`/vehicles?new=1&fromOrder=1&ownerType=${ownerType}&ownerId=${ownerId}`)}
                  className="text-accent text-sm hover:underline"
                >
                  {t('workOrders.addNewVehicle')}
                </button>
              </div>
            ) : (
              <Select
                value={vehicleId}
                onChange={e => {
                  const v = e.target.value
                  if (v === '__add_new__') {
                    navigate(`/vehicles?new=1&fromOrder=1&ownerType=${ownerType}&ownerId=${ownerId}`)
                    return
                  }
                  setVehicleId(v)
                }}
              >
                <option value="">{t('workOrders.selectVehicle')}</option>
                {ownerVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.year} {v.make} {v.model} - {v.licensePlate}
                    {v.isDefault ? t('workOrders.defaultVehicleSuffix') : ''}
                  </option>
                ))}
                <option value="__add_new__">{t('workOrders.addNewVehicleEllipsis')}</option>
              </Select>
            )}
          </div>
        )}

        {ownerType === 'company' && selectedCompany && (
          <div>
            <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('workOrders.driverOptionalLabel')}</label>
            {selectedCompany.drivers.length === 0 ? (
              <div className="flex items-center gap-3">
                <p className="text-text-secondary text-sm">{t('workOrders.noDriversForCompany')}</p>
                <button
                  type="button"
                  onClick={() => navigate(`/companies?newDriver=1&fromOrder=1&companyId=${ownerId}`)}
                  className="text-accent text-sm hover:underline"
                >
                  {t('workOrders.addNewDriver')}
                </button>
              </div>
            ) : (
              <Select
                value={driverId}
                onChange={e => {
                  const v = e.target.value
                  if (v === '__add_new__') {
                    navigate(`/companies?newDriver=1&fromOrder=1&companyId=${ownerId}`)
                    return
                  }
                  setDriverId(v)
                }}
              >
                <option value="">{t('workOrders.selectDriver')}</option>
                {selectedCompany.drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
                <option value="__add_new__">{t('workOrders.addNewDriverEllipsis')}</option>
              </Select>
            )}
          </div>
        )}

        <Select
          label={t('workOrders.assignedWorkerLabel')}
          value={workerId}
          onChange={e => setWorkerId(e.target.value)}
        >
          <option value="">{t('workOrders.selectWorker')}</option>
          {activeWorkers.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>

        <Textarea
          label={t('workOrders.notesLabel')}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      <DialogFooter>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleCreate} disabled={!vehicleId}>
          {t('workOrders.createWorkOrder')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
