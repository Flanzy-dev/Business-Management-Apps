import { useState } from 'react'
import { History, Search, Car, Wrench, User } from 'lucide-react'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import type { WorkOrderItem } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useWorkerStore } from '../store/workerStore'
import { useServiceEventStore } from '../store/serviceEventStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { formatCurrency } from '../lib/currency'
import { formatDistance } from '../lib/units'
import { formatDate } from '../lib/dates'
import { ownerName, workerName, serviceItemTypeLabel } from '../lib/entities'
import { useTranslation } from '../lib/i18n'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { ServiceHistoryTimelineChart } from '../components/serviceHistory/ServiceHistoryTimelineChart'

function serviceTagLabel(
  item: WorkOrderItem,
  itemTypeName: (id: string) => string,
  t: (path: string, vars?: Record<string, string | number>) => string,
): string | null {
  if (!item.serviceItemTypeId) return null
  const liters = item.quantityLiters ? ` · ${item.quantityLiters}L` : ''
  const topped = item.serviceAction === 'topped_up' ? ` · ${t('serviceHistory.toppedUp')}` : ''
  return `${itemTypeName(item.serviceItemTypeId)}${liters}${topped}`
}

export default function ServiceHistory() {
  const { t, tc } = useTranslation()
  const { vehicles } = useVehicleStore()
  const { workOrders } = useWorkOrderStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { workers } = useWorkerStore()
  const { serviceEvents } = useServiceEventStore()
  const { serviceItemTypes } = useServiceItemTypeStore()
  const [search, setSearch] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [taggedOnly, setTaggedOnly] = useState(false)

  const matchingVehicles = search.length >= 2
    ? vehicles.filter(v => {
        const q = search.toLowerCase()
        return (
          v.licensePlate?.toLowerCase().includes(q) ||
          v.vin?.toLowerCase().includes(q) ||
          `${v.make} ${v.model}`.toLowerCase().includes(q)
        )
      })
    : []

  const selectedVehicle = selectedVehicleId ? vehicles.find(v => v.id === selectedVehicleId) : null

  const vehicleHistory = selectedVehicleId
    ? workOrders
        .filter(wo => wo.vehicleId === selectedVehicleId && wo.status === 'completed')
        .filter(wo => !taggedOnly || wo.items.some(i => i.serviceItemTypeId))
        .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
    : []

  const getOwnerName = (vehicle: typeof vehicles[0]) => ownerName(vehicle, customers, companies)
  const getWorkerName = (workerId: string | null) => workerName(workerId, workers)
  const itemTypeName = (id: string) => {
    const found = serviceItemTypes.find(it => it.id === id)
    return found ? serviceItemTypeLabel(found.name) : t('common.unknown')
  }

  const totalSpent = vehicleHistory.reduce((sum, wo) => sum + wo.total, 0)
  const totalVisits = vehicleHistory.length

  const timelineData = [...vehicleHistory].reverse().map((wo, index) => ({
    id: wo.id,
    index,
    date: wo.completedAt || wo.createdAt,
    orderNumber: wo.orderNumber,
    total: wo.total,
    odometer: wo.odometerAtService ?? wo.odometerAtArrival,
    workerName: getWorkerName(wo.workerId),
    items: wo.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      tag: serviceTagLabel(item, itemTypeName, t),
    })),
  }))

  // Most recent ServiceEvent date/odometer per item type, for the "last
  // serviced" summary — independent of the tagged-only timeline filter above.
  const lastServicedByItemType = selectedVehicleId
    ? serviceItemTypes
        .map(itemType => {
          const events = serviceEvents
            .filter(e => e.vehicleId === selectedVehicleId && e.items.some(i => i.itemTypeId === itemType.id))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          const latest = events[0]
          if (!latest) return null
          const odometer = latest.odometerAtService ?? latest.odometerAtArrival
          return { itemType, date: latest.date, odometer }
        })
        .filter((x): x is { itemType: typeof serviceItemTypes[0]; date: string; odometer: number | null } => x !== null)
    : []

  return (
    <div>
      <PageHeader title={t('serviceHistory.title')} caption={t('serviceHistory.caption')} />

      {/* Search */}
      <div className="bg-surface-card rounded-radius-md p-6 mb-6">
        <div className="max-w-md relative">
          <Input
            label={t('serviceHistory.searchLabel')}
            mono
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedVehicleId(null)
            }}
            placeholder={t('serviceHistory.searchPlaceholder')}
            className="pl-9"
          />
          <Search size={16} className="absolute left-3 bottom-[9px] text-text-secondary pointer-events-none" />
        </div>

        {/* Search Results */}
        {search.length >= 2 && !selectedVehicleId && (
          <div className="mt-4">
            {matchingVehicles.length === 0 ? (
              <p className="text-text-secondary text-sm">{t('serviceHistory.noVehiclesFound', { query: search })}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-caption mb-2">{tc('serviceHistory.vehiclesFound', matchingVehicles.length)}</p>
                {matchingVehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVehicleId(v.id)
                      setSearch('')
                    }}
                    className="w-full flex items-center gap-4 p-3 bg-surface-sunken rounded-radius-sm text-left hover:border-accent border border-transparent transition-colors"
                  >
                    <Car size={20} className="text-text-secondary" />
                    <div className="flex-1">
                      <div className="text-text-primary font-medium">
                        {v.year} {v.make} {v.model}
                      </div>
                      <div className="text-caption">
                        <span className="font-mono">{v.licensePlate || t('serviceHistory.noPlate')}</span>
                        {v.vin && <span className="ml-3 font-mono">VIN: {v.vin}</span>}
                      </div>
                    </div>
                    <span className="text-text-secondary text-sm">{getOwnerName(v)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Vehicle */}
      {selectedVehicle && (
        <>
          {/* Vehicle Info Card */}
          <div className="bg-surface-card rounded-radius-md p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-radius-sm bg-accent/20 flex items-center justify-center">
                  <Car size={24} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">
                    {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                  </h2>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-text-secondary font-mono">{selectedVehicle.licensePlate || t('serviceHistory.noPlate')}</span>
                    {selectedVehicle.vin && (
                      <span className="text-caption font-mono">VIN: {selectedVehicle.vin}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <User size={14} className="text-text-secondary" />
                    <span className="text-text-secondary text-sm">{getOwnerName(selectedVehicle)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedVehicleId(null)}
                className="text-text-secondary hover:text-text-primary text-sm"
              >
                {t('serviceHistory.clear')}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border-subtle">
              <div>
                <p className="text-caption">{t('serviceHistory.totalVisits')}</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{totalVisits}</p>
              </div>
              <div>
                <p className="text-caption">{t('serviceHistory.totalSpent')}</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(totalSpent)}</p>
              </div>
              <div>
                <p className="text-caption">{t('serviceHistory.currentMileage')}</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">
                  {selectedVehicle.currentMileage ? formatDistance(selectedVehicle.currentMileage) : '-'}
                </p>
              </div>
            </div>

            {/* Vehicle Specs */}
            {(selectedVehicle.oilTypeRequired || selectedVehicle.engineSize) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border-subtle">
                {selectedVehicle.oilTypeRequired && (
                  <div>
                    <p className="text-caption">{t('serviceHistory.oilType')}</p>
                    <p className="text-text-primary text-sm">{selectedVehicle.oilTypeRequired}</p>
                  </div>
                )}
                {selectedVehicle.oilCapacity && (
                  <div>
                    <p className="text-caption">{t('serviceHistory.oilCapacity')}</p>
                    <p className="text-text-primary text-sm">{selectedVehicle.oilCapacity}</p>
                  </div>
                )}
                {selectedVehicle.engineSize && (
                  <div>
                    <p className="text-caption">{t('serviceHistory.engine')}</p>
                    <p className="text-text-primary text-sm">{selectedVehicle.engineSize}</p>
                  </div>
                )}
                {selectedVehicle.transmissionType && (
                  <div>
                    <p className="text-caption">{t('serviceHistory.transmission')}</p>
                    <p className="text-text-primary text-sm">{selectedVehicle.transmissionType}</p>
                  </div>
                )}
              </div>
            )}

            {lastServicedByItemType.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border-subtle">
                {lastServicedByItemType.map(({ itemType, date, odometer }) => (
                  <div key={itemType.id}>
                    <p className="text-caption">{t('serviceHistory.lastItemPrefix', { item: serviceItemTypeLabel(itemType.name) })}</p>
                    <p className="text-text-primary text-sm">
                      {formatDate(date)}{odometer != null && ` · ${formatDistance(odometer)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service History */}
          <div className="bg-surface-card rounded-radius-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History size={20} className="text-accent" />
                <h3 className="text-card-title text-text-primary">{t('serviceHistory.serviceTimelineHeading')}</h3>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={taggedOnly}
                  onChange={(e) => setTaggedOnly(e.target.checked)}
                  className="accent-accent"
                />
                {t('serviceHistory.taggedServiceItemsOnly')}
              </label>
            </div>

            {vehicleHistory.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <History size={48} className="mx-auto mb-4 opacity-50" />
                <p>{t('serviceHistory.noHistoryFound')}</p>
              </div>
            ) : (
              <>
                <p className="text-caption mb-2">{t('serviceHistory.timelineHoverHint')}</p>
                <ServiceHistoryTimelineChart data={timelineData} className="mb-6" />
                <div className="space-y-4">
                {vehicleHistory.map((wo, index) => (
                  <div
                    key={wo.id}
                    className="flex gap-4 pb-4 border-b border-border-subtle last:border-0 last:pb-0"
                  >
                    {/* Timeline Dot */}
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-accent" />
                      {index < vehicleHistory.length - 1 && (
                        <div className="w-px flex-1 bg-border-subtle mt-2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-text-primary font-mono text-sm">#{wo.orderNumber}</span>
                          <span className="text-text-secondary text-sm tabular-nums">
                            {formatDate(wo.completedAt || wo.createdAt)}
                          </span>
                        </div>
                        <span className="text-text-primary font-medium tabular-nums">
                          {formatCurrency(wo.total)}
                        </span>
                      </div>

                      {/* Services */}
                      <div className="space-y-1">
                        {wo.items.map(item => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <Wrench size={12} className="text-text-secondary" />
                            <span className="text-text-secondary">{item.description}</span>
                            <span className="text-caption">x{item.quantity}</span>
                            {serviceTagLabel(item, itemTypeName, t) && (
                              <span className="text-2xs uppercase tracking-wide text-accent">
                                {serviceTagLabel(item, itemTypeName, t)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-2 text-caption">
                        <span>
                          {t('serviceHistory.mileageField')} {(() => {
                            const odo = wo.odometerAtService ?? wo.odometerAtArrival
                            return odo != null ? formatDistance(odo) : '-'
                          })()}
                        </span>
                        <span>{t('serviceHistory.techField')} {getWorkerName(wo.workerId)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {!selectedVehicle && search.length < 2 && (
        <div className="bg-surface-card rounded-radius-md p-12 text-center">
          <History size={48} className="mx-auto mb-4 text-text-secondary opacity-50" />
          <h2 className="text-lg font-medium text-text-primary mb-2">{t('serviceHistory.searchForVehicleTitle')}</h2>
          <p className="text-text-secondary">{t('serviceHistory.searchForVehicleMessage')}</p>
        </div>
      )}
    </div>
  )
}
