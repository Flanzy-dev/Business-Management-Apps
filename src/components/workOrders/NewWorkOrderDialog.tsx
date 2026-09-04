import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore, type Vehicle } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useToastStore } from '../../store/toastStore'
import { createCustomer, createVehicleWithSchedule } from '../../lib/ops/entityOps'
import { scheduleSeedOutcome, scheduleSeedToast, type ScheduleChoice } from '../../lib/vehicleForm'
import { newOrderDraftToData, orderCreatedToast, type QuickFindResult } from '../../lib/newOrderForm'
import { overdueServiceSuggestions } from '../../lib/serviceSuggestions'
import { activeRulesForVehicle } from '../../lib/scheduleEngine'
import { serviceCatalogLine } from '../../lib/serviceCatalog'
import { parseNewOrderParams } from '../../lib/returnTrip'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { VehicleModal } from '../vehicles/VehicleModal'
import { OrderDetailsFields } from './OrderDetailsFields'
import { OwnerTypeRadios } from '../owners/OwnerTypeRadios'
import { QuickFindField } from './QuickFindField'
import { OwnerSelect } from './OwnerSelect'
import { OwnerVehiclePicker } from './OwnerVehiclePicker'
import { OdometerAtArrivalField } from './OdometerAtArrivalField'
import { DriverPicker } from './DriverPicker'
import { AddCustomerStepDialog } from './AddCustomerStepDialog'

/**
 * Only ever opened via the `?new=1` query param (see components/Layout.tsx's
 * "New Work Order" shortcut, and the "add new owner/vehicle" round-trips from
 * Vehicles/Customers/Companies) — there is no in-page trigger button.
 */
export function NewWorkOrderDialog({ onCreated }: { onCreated: (workOrderId: string) => void }) {
  const { t, tc } = useTranslation()
  const addWorkOrder = useWorkOrderStore(s => s.addWorkOrder)
  const addItem = useWorkOrderStore(s => s.addItem)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const vehicles = useVehicleStore(s => s.vehicles)
  const getActiveWorkers = useWorkerStore(s => s.getActiveWorkers)
  const settings = useSettingsStore(s => s.settings)
  const services = useServiceCatalogStore(s => s.services)
  const scheduleRules = useScheduleRuleStore(s => s.scheduleRules)
  const showToast = useToastStore(s => s.show)

  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  // 'order' is the normal form. 'customer'/'vehicle' are inline detours for
  // "+ Add new..." — swapped in as a sibling dialog rather than navigating
  // away, so the order form (and everything typed into it) survives the trip.
  const [step, setStep] = useState<'order' | 'customer' | 'vehicle'>('order')
  const [ownerType, setOwnerType] = useState<'customer' | 'company'>('customer')
  const [ownerId, setOwnerId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [notes, setNotes] = useState('')
  const [odometer, setOdometer] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  // Set only via ?autoAddOverdue=1 (Reminders.tsx's "Start Work Order" on an
  // Overdue row) — tells handleCreate to add a line for whatever's overdue
  // once the order exists, instead of leaving the ticket empty.
  const [autoAddOverdue, setAutoAddOverdue] = useState(false)

  const activeWorkers = getActiveWorkers()
  // Default vehicle first (stable sort keeps insertion order otherwise) — see
  // src/store/vehicleStore.ts's setDefaultVehicle for how isDefault is set.
  const ownerVehicles = vehicles
    .filter(v => ownerType === 'customer' ? v.customerId === ownerId : v.companyId === ownerId)
    .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault))
  const selectedCompany = companies.find(c => c.id === ownerId)
  const selectedVehicle = vehicles.find(v => v.id === vehicleId)

  const defaultVehicleFor = (type: 'customer' | 'company', id: string) =>
    vehicles.find(v => (type === 'customer' ? v.customerId === id : v.companyId === id) && v.isDefault)?.id ?? ''

  const resetForm = () => {
    setStep('order')
    setOwnerType('customer')
    setOwnerId('')
    setVehicleId('')
    setWorkerId('')
    setDriverId('')
    setNotes('')
    setOdometer('')
    setNewCustomerName('')
    setNewCustomerPhone('')
    setAutoAddOverdue(false)
  }

  // Returning customers already know their plate, not which owner record it's
  // filed under — QuickFindField searches plate/VIN/owner-name across every
  // vehicle at once (like GlobalSearch, Ctrl+K); picking a result sets
  // owner+vehicle in one go, much faster than the type->owner->vehicle picker
  // below, which stays as the fallback for a vehicle staff can't recall by
  // plate.
  const selectQuickFindResult = (r: QuickFindResult) => {
    setOwnerType(r.ownerType)
    setOwnerId(r.ownerId)
    setVehicleId(r.vehicleId)
    setDriverId('')
  }

  useEffect(() => {
    const params = parseNewOrderParams(searchParams)
    if (!params.open) return
    resetForm()
    // Preselect the owner when returning from an inline add-customer/company flow.
    if (params.ownerType) {
      setOwnerType(params.ownerType)
      if (params.ownerId) setOwnerId(params.ownerId)
    }
    if (params.vehicleId) setVehicleId(params.vehicleId)
    if (params.driverId) setDriverId(params.driverId)
    if (params.autoAddOverdue) setAutoAddOverdue(true)
    setOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams])

  // Prefill the odometer from whatever the vehicle already has on file every
  // time the selected vehicle changes — owner pick, Quick Find, the url params
  // above, or coming back from the inline "add vehicle" step. Staff overwrite
  // it with the real reading; this is just a starting point, not a guess that
  // has to be accepted.
  useEffect(() => {
    if (!vehicleId) { setOdometer(''); return }
    const vehicle = vehicles.find(v => v.id === vehicleId)
    setOdometer(vehicle?.currentMileage != null ? String(vehicle.currentMileage) : '')
  }, [vehicleId])

  // Add-new-customer detour (individual customers only — a company/driver
  // "+ Add new..." still navigates away, see the owner Select below). A brand
  // new customer has no vehicle yet, so the next question is always the
  // vehicle form — straight to 'vehicle', not back to the order.
  const handleCreateCustomer = () => {
    if (!newCustomerName.trim()) return
    const created = createCustomer({
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim(),
      email: '',
      address: '',
      notes: '',
    })
    setOwnerType('customer')
    setOwnerId(created.id)
    setNewCustomerName('')
    setNewCustomerPhone('')
    setStep('vehicle')
  }

  // Add-new-vehicle detour, reached from either owner type's "+ Add new
  // vehicle" — createVehicleWithSchedule (src/lib/ops/entityOps.ts) is the
  // same op Vehicles.tsx's own add-vehicle form calls, so the two screens
  // can't drift on what a new vehicle needs (activity log, default slot,
  // schedule seeding).
  const handleCreateVehicle = (data: Omit<Vehicle, 'id' | 'createdAt'>, schedule: ScheduleChoice) => {
    const result = createVehicleWithSchedule(data, schedule)
    const toast = scheduleSeedToast(scheduleSeedOutcome(schedule, result), t)
    if (toast) showToast(toast)
    setVehicleId(result.vehicle.id)
    setStep('order')
  }

  const handleCreate = () => {
    if (!vehicleId) return showToast({ tone: 'danger', title: t('workOrders.pleaseSelectVehicle') })

    const wo = addWorkOrder(
      newOrderDraftToData(
        { vehicleId, workerId, driverId, odometer, notes },
        settings.taxRate,
        vehicles.find(v => v.id === vehicleId)?.currentMileage ?? null
      )
    )

    // Only for an order started from an Overdue Reminders row — add a line
    // for whatever's actually overdue, using the odometer the order was just
    // created with (the same fallback-to-vehicle-mileage chain
    // newOrderDraftToData already applied), so this can never disagree with
    // what the order itself just recorded.
    let overdueAddedCount = 0
    if (autoAddOverdue) {
      const liveRules = activeRulesForVehicle(scheduleRules, vehicleId)
      const overdue = overdueServiceSuggestions(services, liveRules, wo.odometerAtArrival ?? 0, new Date())
      for (const suggestion of overdue) addItem(wo.id, serviceCatalogLine(suggestion.service))
      overdueAddedCount = overdue.length
    }

    setOpen(false)
    showToast(orderCreatedToast(wo.orderNumber, overdueAddedCount, t, tc))
    onCreated(wo.id)
  }

  // Three sibling dialogs, never more than one actually open — 'customer' and
  // 'vehicle' are detours off the main form, not nested inside it. Dialog.tsx
  // traps Tab/Escape on `document`, so two live instances would fight; each
  // one's `open` is gated on `step` so only one is ever mounted at a time, and
  // "back" is just setStep('order') rather than tearing the flow down.
  return (
    <>
    {/* animate={false}: Ctrl+N opens this dialog directly (see
        src/hooks/useKeyboardShortcuts.ts) and it's the single most-repeated
        action in the app. An entrance the user sees a hundred times a day is
        delay, not polish — every other dialog keeps its animation. */}
    <Dialog open={open && step === 'order'} onClose={() => setOpen(false)} title={t('workOrders.newServiceOrderTitle')} size="lg" animate={false}>
      <div className="space-y-4">
        <QuickFindField vehicles={vehicles} customers={customers} companies={companies} onSelect={selectQuickFindResult} />

        <OwnerTypeRadios
          value={ownerType}
          onChange={(next) => { setOwnerType(next); setOwnerId(''); setVehicleId('') }}
          label={t('workOrders.ownerTypeLabel')}
          individualLabel={t('workOrders.individualCustomer')}
          companyLabel={t('workOrders.companyFleet')}
        />

        <OwnerSelect
          ownerType={ownerType}
          ownerId={ownerId}
          customers={customers}
          companies={companies}
          onSelectOwner={(v) => {
            setOwnerId(v)
            setVehicleId(defaultVehicleFor(ownerType, v))
          }}
          onAddNew={() => {
            // Individual customers get the inline detour (step === 'customer'
            // below); a fleet company is rare enough mid-order that it keeps
            // the existing round trip to the Companies page.
            if (ownerType === 'customer') { setStep('customer'); return }
            navigate('/companies?new=1&fromOrder=1')
          }}
        />

        {ownerId && (
          <OwnerVehiclePicker
            ownerType={ownerType}
            ownerVehicles={ownerVehicles}
            vehicleId={vehicleId}
            onSelectVehicle={setVehicleId}
            onAddNew={() => setStep('vehicle')}
          />
        )}

        {vehicleId && <OdometerAtArrivalField value={odometer} onChange={setOdometer} selectedVehicle={selectedVehicle} />}

        {ownerType === 'company' && selectedCompany && (
          <DriverPicker
            drivers={selectedCompany.drivers}
            driverId={driverId}
            onSelectDriver={setDriverId}
            onAddNew={() => navigate(`/companies?newDriver=1&fromOrder=1&companyId=${ownerId}`)}
          />
        )}

        <OrderDetailsFields
          workerId={workerId}
          onWorkerChange={setWorkerId}
          activeWorkers={activeWorkers}
          notes={notes}
          onNotesChange={setNotes}
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

    <AddCustomerStepDialog
      open={open && step === 'customer'}
      name={newCustomerName}
      phone={newCustomerPhone}
      onNameChange={setNewCustomerName}
      onPhoneChange={setNewCustomerPhone}
      onBack={() => setStep('order')}
      onSave={handleCreateCustomer}
    />

    {step === 'vehicle' && (
      <VehicleModal
        vehicle={null}
        customers={customers}
        companies={companies}
        initialOwnerType={ownerType}
        initialCustomerId={ownerType === 'customer' ? ownerId : undefined}
        initialCompanyId={ownerType === 'company' ? ownerId : undefined}
        onSave={handleCreateVehicle}
        onClose={() => setStep('order')}
      />
    )}
    </>
  )
}
