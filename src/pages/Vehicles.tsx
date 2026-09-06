import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { createVehicleWithSchedule, updateVehicleLogged, deleteVehicleChecked } from '../lib/ops/entityOps'
import { scheduleSeedOutcome, scheduleSeedToast, type ScheduleChoice } from '../lib/vehicleForm'
import { filterBySearch } from '../lib/entitySearch'
import { parseNewEntityRequest, workOrderReturnPath } from '../lib/returnTrip'
import { deleteOutcomeToast } from '../lib/deleteOutcome'
import { getVehicleDueStatus } from '../lib/vehicleDueSummary'
import { activeRulesForVehicle } from '../lib/scheduleEngine'
import { useExpandOrEdit } from '../lib/rowInteraction'
import { ownerName, itemTypeNameLookup } from '../lib/entities'
import { useTranslation } from '../lib/i18n'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { VehicleModal } from '../components/vehicles/VehicleModal'
import { VehicleServiceHistoryDialog } from '../components/vehicles/VehicleServiceHistoryDialog'
import { VehicleRow } from '../components/vehicles/VehicleRow'

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
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null)
  const rowHandlers = useExpandOrEdit()
  const [returnToOrder, setReturnToOrder] = useState(false)
  const [newOwnerType, setNewOwnerType] = useState<'customer' | 'company' | null>(null)
  const [newOwnerId, setNewOwnerId] = useState('')

  const filteredVehicles = filterBySearch(vehicles, search, (v) => [v.make, v.model, v.licensePlate, v.vin])

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
  }, [searchParams])

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
        const ot = data.companyId ? 'company' : 'customer'
        const oid = data.companyId ?? data.customerId ?? ''
        navigate(workOrderReturnPath(ot, oid, { vehicleId: created.id }))
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
          placeholder={t('vehicles.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredVehicles.length === 0 ? (
          <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
            {vehicles.length === 0 ? t('vehicles.emptyNone') : t('vehicles.emptySearch')}
          </div>
        ) : (
          filteredVehicles.map((vehicle) => (
            <VehicleRow
              key={vehicle.id}
              vehicle={vehicle}
              ownerLabel={getOwnerName(vehicle)}
              dueStatus={getDueStatusForVehicle(vehicle)}
              itemTypeName={itemTypeName}
              expanded={expandedVehicle === vehicle.id}
              rowHandlers={rowHandlers(vehicle.id, () => setExpandedVehicle(expandedVehicle === vehicle.id ? null : vehicle.id), () => handleEdit(vehicle))}
              onEdit={() => handleEdit(vehicle)}
              onDelete={() => handleDelete(vehicle.id)}
              onShowHistory={() => setHistoryVehicle(vehicle)}
            />
          ))
        )}
      </div>

      {isModalOpen && (
        <VehicleModal
          vehicle={editingVehicle}
          customers={customers}
          companies={companies}
          initialOwnerType={newOwnerType ?? undefined}
          initialCustomerId={newOwnerType === 'customer' ? newOwnerId : ''}
          initialCompanyId={newOwnerType === 'company' ? newOwnerId : ''}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {historyVehicle && (
        <VehicleServiceHistoryDialog open vehicle={historyVehicle} onClose={() => setHistoryVehicle(null)} />
      )}
    </div>
  )
}
