import { useState, useEffect, type FormEvent } from 'react'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore, type Vehicle } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useToastStore } from '../../store/uiStores'
import { createCustomer, createVehicleWithSchedule } from '../../lib/ops/entityOps'
import { scheduleSeedOutcome, scheduleSeedToast, type ScheduleChoice } from '../../lib/vehicles/vehicleForm'
import { newOrderDraftToData, orderCreatedToast, openOrderForVehicle, type QuickFindResult } from '../../lib/orders/newOrderForm'
import { findCustomerByPhone } from '../../lib/customers/customerIdentity'
import { orderLabel } from '../../lib/format/entities'
import { overdueServiceSuggestions } from '../../lib/schedule/serviceSuggestions'
import { activeRulesForVehicle } from '../../lib/schedule/scheduleEngine'
import { serviceCatalogLine } from '../../lib/schedule/serviceCatalog'
import { parseNewOrderParams } from '../../lib/orders/returnTrip'
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
import { defaultVehicleOf, ownerOf, vehiclesOf } from '../../lib/vehicles/vehicleOwner'

/**
 * Only ever opened via the `?new=1` query param (see components/layout/Layout.tsx's
 * "New Work Order" shortcut, and the "add new owner/vehicle" round-trips from
 * Vehicles/Customers/Companies) — there is no in-page trigger button.
 */
export function NewWorkOrderDialog({ onCreated }: { onCreated: (workOrderId: string) => void }) {
  const { t, tc } = useTranslation()
  const addWorkOrder = useWorkOrderStore(s => s.addWorkOrder)
  const addItem = useWorkOrderStore(s => s.addItem)
  // Open orders only, shallow-compared: this dialog is always mounted, and a
  // bare subscription to every order re-rendered it on each edit anywhere.
  const openOrders = useStoreWithEqualityFn(useWorkOrderStore, s => s.workOrders.filter(wo => wo.status === 'open'), shallow)
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
  // What was typed into Quick Find when it found nothing — becomes the new
  // vehicle's plate once the new customer is saved.
  const [pendingPlate, setPendingPlate] = useState('')
  // Set only via ?autoAddOverdue=1 (Reminders.tsx's "Start Work Order" on an
  // Overdue row) — tells handleCreate to add a line for whatever's overdue
  // once the order exists, instead of leaving the ticket empty.
  const [autoAddOverdue, setAutoAddOverdue] = useState(false)

  const activeWorkers = getActiveWorkers()
  // Default vehicle first (stable sort keeps insertion order otherwise) — see
  // src/store/vehicleStore.ts's setDefaultVehicle for how isDefault is set.
  const ownerVehicles = vehiclesOf(vehicles, { type: ownerType, id: ownerId })
    .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault))
  const selectedCompany = companies.find(c => c.id === ownerId)
  const selectedVehicle = vehicles.find(v => v.id === vehicleId)
  // The car is already on the lift: a warning with a way to open that ticket,
  // not a block (two separate jobs on one car in a day are legitimate).
  const existingOpenOrder = openOrderForVehicle(openOrders, vehicleId)
  // Someone with this number is already a customer: offer them instead of a twin.
  const existingCustomer = step === 'customer' ? findCustomerByPhone(customers, newCustomerPhone) : undefined

  const defaultVehicleFor = (type: 'customer' | 'company', id: string) =>
    defaultVehicleOf(vehicles, { type, id })?.id ?? ''

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
    setPendingPlate('')
    setAutoAddOverdue(false)
  }

  // Returning customers already know their plate, not which owner record it's
  // filed under — QuickFindField searches plate/VIN/owner-name across every
  // vehicle at once (like GlobalSearch, Ctrl+K); picking a result sets
  // owner+vehicle in one go, much faster than the type->owner->vehicle picker
  // below, which stays as the fallback for a vehicle staff can't recall by
  // plate.
  // Quick Find came up empty: this is a new car, and almost always a new
  // customer. Ask for the customer, then the vehicle with the plate filled
  // in. Someone adding a car for an existing customer still has the owner
  // picker below.
  const startNewCustomerFromQuickFind = (query: string) => {
    setOwnerType('customer')
    setOwnerId('')
    setVehicleId('')
    setPendingPlate(query)
    setStep('customer')
  }

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
  }, [searchParams, setSearchParams])

  // Prefill the odometer from whatever the vehicle already has on file every
  // time the selected vehicle changes — owner pick, Quick Find, the url params
  // above, or coming back from the inline "add vehicle" step. Staff overwrite
  // it with the real reading; this is just a starting point, not a guess that
  // has to be accepted.
  useEffect(() => {
    if (!vehicleId) { setOdometer(''); return }
    const vehicle = vehicles.find(v => v.id === vehicleId)
    setOdometer(vehicle?.currentMileage != null ? String(vehicle.currentMileage) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a prefill for when the SELECTED vehicle changes; reacting to the vehicle list too would overwrite the reading staff are typing
  }, [vehicleId])

  // Add-new-customer detour (individual customers only — a company/driver
  // "+ Add new..." still navigates away, see the owner Select below). A brand
  // new customer has no vehicle yet, so the next question is always the
  // vehicle form — straight to 'vehicle', not back to the order.
  // The number typed in the add-customer step already belongs to someone on
  // file. Carry on as that customer: with a plate waiting from Quick Find this
  // is a new car for a returning customer, so go straight to the vehicle form.
  const useExistingCustomer = (customerId: string) => {
    setOwnerType('customer')
    setOwnerId(customerId)
    setNewCustomerName('')
    setNewCustomerPhone('')
    if (pendingPlate) {
      setVehicleId('')
      setStep('vehicle')
    } else {
      setVehicleId(defaultVehicleFor('customer', customerId))
      setStep('order')
    }
  }

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
    setPendingPlate('')
    setStep('order')
  }

  const handleCreate = (e?: FormEvent) => {
    e?.preventDefault()
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
    showToast(orderCreatedToast(wo.orderNumber, overdueAddedCount, t, tc, wo.orderNumberSuffix))
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
    <Dialog closeOnScrimClick={false} open={open && step === 'order'} onClose={() => setOpen(false)} title={t('workOrders.newServiceOrderTitle')} size="lg" animate={false}>
      {/* A form so Enter creates the order once a vehicle is picked. Quick
          Find handles its own Enter (pick a result, or add a new car), so
          it never submits this by accident. */}
      <form id="new-work-order-form" onSubmit={handleCreate}>
      <div className="space-y-4">
        <QuickFindField
          vehicles={vehicles}
          customers={customers}
          companies={companies}
          onSelect={selectQuickFindResult}
          onAddNew={startNewCustomerFromQuickFind}
        />

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
            navigate('/customers?tab=companies&new=1&fromOrder=1')
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

        {existingOpenOrder && (
          <div role="status" className="flex items-center gap-3 rounded-radius-sm border border-warning bg-warning-muted px-3 py-2 text-sm">
            <p className="min-w-0 flex-1 text-fg-1">
              {t('workOrders.vehicleHasOpenOrder', { order: orderLabel(existingOpenOrder.orderNumber, existingOpenOrder.orderNumberSuffix) })}
            </p>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => { setOpen(false); onCreated(existingOpenOrder.id) }}
            >
              {t('workOrders.openExistingOrder')}
            </Button>
          </div>
        )}

        {vehicleId && <OdometerAtArrivalField value={odometer} onChange={setOdometer} selectedVehicle={selectedVehicle} />}

        {ownerType === 'company' && selectedCompany && (
          <DriverPicker
            drivers={selectedCompany.drivers}
            driverId={driverId}
            onSelectDriver={setDriverId}
            onAddNew={() => navigate(`/customers?tab=companies&newDriver=1&fromOrder=1&companyId=${ownerId}`)}
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
        {/* Enabled with no vehicle picked: pressing it says so (handleCreate). */}
        <Button variant="primary" type="submit">
          {t('workOrders.createWorkOrder')}
        </Button>
      </DialogFooter>
      </form>
    </Dialog>

    <AddCustomerStepDialog
      open={open && step === 'customer'}
      name={newCustomerName}
      phone={newCustomerPhone}
      onNameChange={setNewCustomerName}
      onPhoneChange={setNewCustomerPhone}
      onBack={() => { setPendingPlate(''); setStep('order') }}
      onSave={handleCreateCustomer}
      existing={existingCustomer ? { id: existingCustomer.id, name: existingCustomer.name } : null}
      onUseExisting={useExistingCustomer}
    />

    {step === 'vehicle' && (
      <VehicleModal
        vehicle={null}
        customers={customers}
        companies={companies}
        initialOwnerType={ownerType}
        initialCustomerId={ownerType === 'customer' ? ownerId : undefined}
        initialCompanyId={ownerType === 'company' ? ownerId : undefined}
        initialPlate={pendingPlate || undefined}
        ownerLocked={!!ownerId}
        onSave={handleCreateVehicle}
        onClose={() => setStep('order')}
        onOpenExisting={(existing) => {
          // The car is already on file — order on it, under its real owner.
          const owner = ownerOf(existing)
          setOwnerType(owner?.type ?? 'customer')
          setOwnerId(owner?.id ?? '')
          setVehicleId(existing.id)
          setStep('order')
        }}
      />
    )}
    </>
  )
}
