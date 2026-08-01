import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { deleteVehicleChecked } from '../lib/ops/entityOps'
import { seedDefaultScheduleRules } from '../lib/ops/scheduleOps'
import { getVehicleDueStatus, dueStatusLabel, dueStatusBadgeTone } from '../lib/vehicleDueSummary'
import { formatDistance } from '../lib/units'
import { formatDate } from '../lib/dates'
import { useExpandOrEdit } from '../lib/rowInteraction'
import { ownerName, serviceItemTypeLabel } from '../lib/entities'
import { useTranslation } from '../lib/i18n'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Badge } from '../components/ui/Badge'
import { Pencil, Trash2, Plus, CalendarClock, Star } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { VehicleModal } from '../components/vehicles/VehicleModal'
import { ManageScheduleDialog } from '../components/vehicles/ManageScheduleDialog'

export default function Vehicles() {
  const { t } = useTranslation()
  const vehicles = useVehicleStore((s) => s.vehicles)
  const addVehicle = useVehicleStore((s) => s.addVehicle)
  const updateVehicle = useVehicleStore((s) => s.updateVehicle)
  const setDefaultVehicle = useVehicleStore((s) => s.setDefaultVehicle)
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
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null)
  const rowHandlers = useExpandOrEdit()
  const [returnToOrder, setReturnToOrder] = useState(false)
  const [newOwnerType, setNewOwnerType] = useState<'customer' | 'company' | null>(null)
  const [newOwnerId, setNewOwnerId] = useState('')
  const [manageScheduleVehicle, setManageScheduleVehicle] = useState<Vehicle | null>(null)

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      v.vin.toLowerCase().includes(search.toLowerCase())
  )

  const getLiveRules = (vehicleId: string) =>
    scheduleRules.filter((r) => r.vehicleId === vehicleId && r.supersededAt === null)

  const getDueStatusForVehicle = (vehicle: Vehicle) =>
    getVehicleDueStatus(getLiveRules(vehicle.id), vehicle.currentMileage ?? 0)

  const itemTypeName = (id: string) => {
    const found = serviceItemTypes.find((it) => it.id === id)
    return found ? serviceItemTypeLabel(found.name) : t('common.unknown')
  }

  const getOwnerName = (vehicle: Vehicle) => ownerName(vehicle, customers, companies)

  const handleAdd = () => {
    setEditingVehicle(null)
    setIsModalOpen(true)
  }

  // Auto-open the add form when arriving via ?new=1 (e.g. from the new-order dialog),
  // prefilling the owner passed in the URL so the vehicle is created under it.
  useEffect(() => {
    if (searchParams.get('new')) {
      setReturnToOrder(searchParams.get('fromOrder') === '1')
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
        const result = deleteVehicleChecked(id)
        if (!result.ok) {
          showToast({ tone: 'warning', title: t('vehicles.cannotDeleteTitle'), description: result.reason })
        }
      }
    )
  }

  const handleSave = (data: Omit<Vehicle, 'id' | 'createdAt'>, scheduleMode: 'workshop_default' | 'custom') => {
    if (editingVehicle) {
      updateVehicle(editingVehicle.id, data)
    } else {
      const created = addVehicle(data)
      // addVehicle alone can't clear a sibling vehicle's default flag —
      // setDefaultVehicle does that in one pass. No-op in edit mode, where
      // VehicleModal omits isDefault from data entirely.
      if (data.isDefault) setDefaultVehicle(created.id)

      // Seeding is just data, not UI — it runs regardless of where we're
      // about to navigate/open next.
      if (scheduleMode === 'workshop_default') {
        const seeded = seedDefaultScheduleRules(created.id, created.currentMileage)
        if (seeded.length > 0) {
          showToast({ tone: 'success', title: t('vehicles.scheduleSeededToast', { count: seeded.length }) })
        }
      }

      if (returnToOrder) {
        setReturnToOrder(false)
        setIsModalOpen(false)
        const ot = data.companyId ? 'company' : 'customer'
        const oid = data.companyId ?? data.customerId ?? ''
        navigate(`/work-orders?new=1&ownerType=${ot}&ownerId=${oid}&vehicleId=${created.id}`)
        return
      }

      // "Custom" skips auto-seeding and opens Manage Schedule right away
      // instead — the work-order round trip above always wins when both
      // apply, since navigating away mid-task takes priority over a second
      // dialog.
      if (scheduleMode === 'custom') {
        setIsModalOpen(false)
        setManageScheduleVehicle(created)
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
            <div key={vehicle.id} className="bg-surface-card rounded-radius-md overflow-hidden">
              <div
                className="group p-4 flex justify-between items-center cursor-pointer hover:bg-surface-sunken active:bg-bg-4 transition-colors"
                {...rowHandlers(vehicle.id, () => setExpandedVehicle(expandedVehicle === vehicle.id ? null : vehicle.id), () => handleEdit(vehicle))}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                      {vehicle.color && <span className="text-text-secondary ml-2">({vehicle.color})</span>}
                    </h3>
                    <Badge tone={dueStatusBadgeTone(getDueStatusForVehicle(vehicle))} dot>
                      {dueStatusLabel(getDueStatusForVehicle(vehicle))}
                    </Badge>
                    {vehicle.isDefault && <Badge tone="accent">{t('vehicles.defaultBadge')}</Badge>}
                  </div>
                  <p className="text-sm text-text-secondary">
                    {vehicle.licensePlate && <span className="font-mono">{t('vehicles.plateLabel')} {vehicle.licensePlate}</span>}
                    {vehicle.licensePlate && vehicle.currentMileage && ' • '}
                    {vehicle.currentMileage && <span className="tabular-nums">{formatDistance(vehicle.currentMileage)}</span>}
                    {' • '}
                    <span className="text-accent">{getOwnerName(vehicle)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Pencil
                    size={14}
                    className="text-fg-3 opacity-0 group-hover:opacity-60 transition-opacity"
                    aria-hidden="true"
                  />
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      items={[
                        { label: t('vehicles.manageSchedule'), icon: CalendarClock, onClick: () => setManageScheduleVehicle(vehicle) },
                        ...(vehicle.isDefault
                          ? []
                          : [{ label: t('vehicles.setAsDefaultAction'), icon: Star, onClick: () => setDefaultVehicle(vehicle.id) }]),
                        { label: t('common.edit'), icon: Pencil, onClick: () => handleEdit(vehicle) },
                        { label: t('common.delete'), icon: Trash2, onClick: () => handleDelete(vehicle.id), variant: 'danger' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {expandedVehicle === vehicle.id && (
                <div className="border-t border-border-subtle p-4 bg-surface-sunken">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-text-primary flex items-center gap-2">
                      <CalendarClock size={16} className="text-text-secondary" /> {t('vehicles.dueHeading')}
                    </h4>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setManageScheduleVehicle(vehicle) }}
                      className="text-accent text-sm hover:underline"
                    >
                      {t('vehicles.manageSchedule')}
                    </button>
                  </div>
                  {(() => {
                    const status = getDueStatusForVehicle(vehicle)
                    if (status.kind === 'no_schedule') {
                      return <p className="text-text-secondary text-sm mb-4">{t('vehicles.dueNoScheduleLong')}</p>
                    }
                    return (
                      <div className="space-y-1 mb-4 text-sm">
                        {status.lines.map((line) => (
                          <p key={`${line.dueKm}-${line.dueDate}`} className="text-text-secondary">
                            <span className="text-text-primary tabular-nums font-mono">
                              {[line.dueKm != null ? formatDistance(line.dueKm) : null, line.dueDate != null ? formatDate(line.dueDate) : null]
                                .filter(Boolean)
                                .join(' / ')}
                            </span>
                            {' — '}
                            {line.itemTypeIds.map(itemTypeName).join(', ')}
                          </p>
                        ))}
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">{t('vehicles.basicInfoHeading')}</h4>
                      <div className="space-y-1 text-text-secondary">
                        {vehicle.vin && <p>{t('vehicles.vinLabel')} <span className="font-mono">{vehicle.vin}</span></p>}
                        {vehicle.licensePlate && <p>{t('vehicles.plateLabel')} <span className="font-mono">{vehicle.licensePlate}</span></p>}
                        {vehicle.currentMileage && <p>{t('vehicles.mileageLabel')} <span className="tabular-nums">{formatDistance(vehicle.currentMileage)}</span></p>}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-text-primary mb-2">{t('vehicles.engineHeading')}</h4>
                      <div className="space-y-1 text-text-secondary">
                        {vehicle.engineType && <p>{t('vehicles.typeLabel')} {vehicle.engineType}</p>}
                        {vehicle.engineSize && <p>{t('vehicles.sizeLabel')} {vehicle.engineSize}</p>}
                        {vehicle.oilTypeRequired && <p>{t('vehicles.oilLabel')} {vehicle.oilTypeRequired}</p>}
                        {vehicle.oilCapacity && <p>{t('vehicles.capacityLabel')} {vehicle.oilCapacity}</p>}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-text-primary mb-2">{t('vehicles.transmissionHeading')}</h4>
                      <div className="space-y-1 text-text-secondary">
                        {vehicle.transmissionType && <p>{t('vehicles.typeLabel')} {vehicle.transmissionType}</p>}
                        {vehicle.transmissionFluidType && <p>{t('vehicles.fluidLabel')} {vehicle.transmissionFluidType}</p>}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-text-primary mb-2">{t('vehicles.gardanHeading')}</h4>
                      <div className="space-y-1 text-text-secondary">
                        {vehicle.driveType && <p>{t('vehicles.driveLabel')} {vehicle.driveType}</p>}
                        {vehicle.differentialFluidType && <p>{t('vehicles.fluidLabel')} {vehicle.differentialFluidType}</p>}
                      </div>
                    </div>

                    {vehicle.notes && (
                      <div className="md:col-span-2">
                        <h4 className="font-medium text-text-primary mb-2">{t('vehicles.notesHeading')}</h4>
                        <p className="text-text-secondary">{vehicle.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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

      {manageScheduleVehicle && (
        <ManageScheduleDialog
          vehicle={manageScheduleVehicle}
          onClose={() => setManageScheduleVehicle(null)}
        />
      )}
    </div>
  )
}
