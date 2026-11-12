import { useState, useEffect, useDeferredValue, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useToastStore, useConfirmStore } from '../store/uiStores'
import { createVehicleWithSchedule, updateVehicleLogged, deleteVehicleChecked } from '../lib/ops/entityOps'
import { scheduleSeedOutcome, scheduleSeedToast, type ScheduleChoice } from '../lib/vehicles/vehicleForm'
import { filterVehiclesBySearch } from '../lib/format/entitySearch'
import { parseNewEntityRequest, workOrderReturnPath } from '../lib/orders/returnTrip'
import { deleteOutcomeToast } from '../lib/ops/deletion'
import { getVehicleDueStatus } from '../lib/vehicles/vehicleDueSummary'
import { activeRulesForVehicle } from '../lib/schedule/scheduleEngine'
import { useExpandOrEdit } from '../lib/app/rowInteraction'
import { ownerName, itemTypeNameLookup } from '../lib/format/entities'
import { useTranslation } from '../lib/i18n'
import { useIncrementalList } from '../hooks/useIncrementalList'
import { ShowMoreFooter } from '../components/ui/ShowMoreFooter'
import { Plus, Car } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { VehicleModal } from '../components/vehicles/VehicleModal'
import { VehicleServiceHistoryDialog } from '../components/vehicles/VehicleServiceHistoryDialog'
import { VehicleRow } from '../components/vehicles/VehicleRow'
import { ownerOf } from '../lib/vehicles/vehicleOwner'
import { useOpenRecordFromNav } from '../hooks/useOpenRecordFromNav'

export default function Vehicles() {
  const { t } = useTranslation()
  const vehicles = useVehicleStore((s) => s.vehicles)
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const scheduleRules = useScheduleRuleStore((s) => s.scheduleRules)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null)
  // Global search opens a vehicle's history directly (src/lib/app/navigation.ts).
  useOpenRecordFromNav((id) => setHistoryVehicle(useVehicleStore.getState().vehicles.find((v) => v.id === id) ?? null))
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null)
  const rowHandlers = useExpandOrEdit()
  const [returnToOrder, setReturnToOrder] = useState(false)
  const [newOwnerType, setNewOwnerType] = useState<'customer' | 'company' | null>(null)
  const [newOwnerId, setNewOwnerId] = useState('')

  // ~1,000 vehicles after the history import: filter on the deferred search
  // text and mount only the first batch of matches, so typing stays instant
  // (see useIncrementalList). Owner / due-status work below now runs for the
  // visible rows only.
  const deferredSearch = useDeferredValue(search)
  // Owner name + phone by id, built once per customer/company change — not a
  // linear owner lookup per vehicle per keystroke.
  const ownerTextById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of customers) map.set(`customer:${c.id}`, `${c.name} ${c.phone}`)
    for (const c of companies) map.set(`company:${c.id}`, `${c.companyName} ${c.contactPerson} ${c.phone}`)
    return map
  }, [customers, companies])
  const filteredVehicles = useMemo(
    () =>
      filterVehiclesBySearch(vehicles, deferredSearch, (v) => {
        const ref = ownerOf(v)
        return ref ? (ownerTextById.get(`${ref.type}:${ref.id}`) ?? '') : ''
      }),
    [vehicles, deferredSearch, ownerTextById]
  )
  const list = useIncrementalList(filteredVehicles, deferredSearch)

  const getLiveRules = (vehicleId: string) => activeRulesForVehicle(scheduleRules, vehicleId)

  const getDueStatusForVehicle = (vehicle: Vehicle) =>
    getVehicleDueStatus(getLiveRules(vehicle.id), vehicle.currentMileage ?? 0)

  const itemTypeName = itemTypeNameLookup(serviceItemTypes)

  const getOwnerName = (vehicle: Vehicle) => ownerName(vehicle, customers, companies)

  const handleAdd = () => {
    setEditingVehicle(null)
    setIsModalOpen(true)
  }

  // Auto-open the add form when arriving via ?new=1 (e.g. from the new-order dialog),
  // prefilling the owner passed in the URL so the vehicle is created under it.
  useEffect(() => {
    const request = parseNewEntityRequest(searchParams)
    if (request.open) {
      setReturnToOrder(request.shouldReturn)
      const ot = searchParams.get('ownerType')
      setNewOwnerType(ot === 'company' ? 'company' : ot === 'customer' ? 'customer' : null)
      setNewOwnerId(searchParams.get('ownerId') ?? '')
      handleAdd()
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const toggleExpanded = (id: string) => setExpandedVehicle((current) => (current === id ? null : id))

  // Straight into a new order for this car, owner and vehicle preselected.
  const startOrderFor = (vehicle: Vehicle) => {
    const owner = ownerOf(vehicle)
    navigate(owner ? workOrderReturnPath(owner.type, owner.id, { vehicleId: vehicle.id }) : `/work-orders?new=1&vehicleId=${vehicle.id}`)
  }

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    requestConfirm(
      { title: t('vehicles.deleteConfirmTitle'), message: t('vehicles.deleteConfirmMessage') },
      () => {
        // The activity-log entry is written by deleteVehicleChecked — see
        // Customers.tsx's handleDelete and src/lib/ops/activityOps.ts.
        const result = deleteVehicleChecked(id)
        const toast = deleteOutcomeToast(result, {
          cannotDeleteTitle: t('vehicles.cannotDeleteTitle'),
          deletedTitle: t('vehicles.deletedToast'),
        })
        if (toast) showToast(toast)
      }
    )
  }

  const handleSave = (data: Omit<Vehicle, 'id' | 'createdAt'>, schedule: ScheduleChoice) => {
    if (editingVehicle) {
      // Store write + activity log as one step — see src/lib/ops/entityOps.ts.
      updateVehicleLogged(editingVehicle.id, data)
      showToast({ tone: 'success', title: t('vehicles.savedToast') })
    } else {
      // createVehicleWithSchedule owns the activity log, default-vehicle slot,
      // and schedule seeding together — see src/lib/ops/entityOps.ts.
      const result = createVehicleWithSchedule(data, schedule)
      const created = result.vehicle
      const toast = scheduleSeedToast(scheduleSeedOutcome(schedule, result), t)
      if (toast) showToast(toast)

      if (returnToOrder) {
        setReturnToOrder(false)
        setIsModalOpen(false)
        const owner = ownerOf(data)
        navigate(workOrderReturnPath(owner?.type ?? 'customer', owner?.id ?? '', { vehicleId: created.id }))
        return
      }

      // Nothing actually got seeded — Custom, or Workshop Default with every
      // checklist row unticked — so skip auto-seeding and reopen Edit on this
      // same vehicle right away instead, its schedule section empty and ready
      // to fill in immediately. The work-order round trip above always wins
      // when both apply, since navigating away mid-task takes priority over
      // reopening.
      if (result.seededRules.length === 0) {
        setEditingVehicle(created)
        setIsModalOpen(true)
        return
      }
    }
    setIsModalOpen(false)
  }

  return (
    <div>
      <PageHeader
        title={t('vehicles.title')}
        action={
          <Button variant="primary" icon={Plus} onClick={handleAdd}>
            {t('vehicles.addVehicle')}
          </Button>
        }
      />

      <div className="mb-4 max-w-md">
        <Input
          mono
          placeholder={t('vehicles.searchPlaceholder')} aria-label={t('vehicles.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredVehicles.length === 0 ? (
          <EmptyState icon={Car} title={vehicles.length === 0 ? t('vehicles.emptyNone') : t('vehicles.emptySearch')} />
        ) : (
          list.visible.map((vehicle) => (
            <VehicleRow
              key={vehicle.id}
              vehicle={vehicle}
              ownerLabel={getOwnerName(vehicle)}
              dueStatus={getDueStatusForVehicle(vehicle)}
              itemTypeName={itemTypeName}
              expanded={expandedVehicle === vehicle.id}
              rowHandlers={rowHandlers(vehicle.id, () => toggleExpanded(vehicle.id), () => handleEdit(vehicle))}
              onToggle={() => toggleExpanded(vehicle.id)}
              onNewOrder={() => startOrderFor(vehicle)}
              onEdit={() => handleEdit(vehicle)}
              onDelete={() => handleDelete(vehicle.id)}
              onShowHistory={() => setHistoryVehicle(vehicle)}
            />
          ))
        )}
      </div>
      <ShowMoreFooter shown={list.shown} total={list.total} onShowMore={list.showMore} />

      {isModalOpen && (
        <VehicleModal
          // The modal seeds its draft once, at mount. "Open existing" (from the
          // duplicate-plate notice) swaps `vehicle` underneath an open modal;
          // without a new key it would keep the typed-in draft and Save would
          // write it over the existing vehicle.
          key={editingVehicle?.id ?? 'new'}
          vehicle={editingVehicle}
          customers={customers}
          companies={companies}
          initialOwnerType={newOwnerType ?? undefined}
          initialCustomerId={newOwnerType === 'customer' ? newOwnerId : ''}
          initialCompanyId={newOwnerType === 'company' ? newOwnerId : ''}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
          onOpenExisting={handleEdit}
        />
      )}

      {historyVehicle && (
        <VehicleServiceHistoryDialog open vehicle={historyVehicle} onClose={() => setHistoryVehicle(null)} />
      )}
    </div>
  )
}
