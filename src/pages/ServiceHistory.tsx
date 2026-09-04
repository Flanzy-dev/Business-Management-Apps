import { useMemo, useState } from 'react'
import { History, Search } from 'lucide-react'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useWorkerStore } from '../store/workerStore'
import { useServiceEventStore } from '../store/serviceEventStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useSettingsStore } from '../store/settingsStore'
import { getCompletedOrdersForVehicle, serviceTagLabel, serviceHistoryTotals, lastServicedByItemType } from '../lib/vehicleServiceHistory'
import { printReceipt, receiptShopInfoFromSettings } from '../components/Receipt'
import { ownerName, workerName, itemTypeNameLookup } from '../lib/entities'
import { useTranslation } from '../lib/i18n'
import { useMode } from '../store/authStore'
import { canSeeCostAndProfit } from '../lib/auth/permissions'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { ServiceHistoryTimelineChart } from '../components/serviceHistory/ServiceHistoryTimelineChart'
import { ServiceVisitList } from '../components/serviceHistory/ServiceVisitList'
import { VehicleSummaryCard } from '../components/serviceHistory/VehicleSummaryCard'
import { VehicleSearchResults } from '../components/serviceHistory/VehicleSearchResults'

export default function ServiceHistory() {
  const { t } = useTranslation()
  // Per-order totals and line prices stay visible (a worker handing back a
  // vehicle may need to say what a past visit cost) — only the aggregate
  // "total spent" figure and the spend-over-time chart are admin-only. See
  // src/lib/auth/permissions.ts's canSeeCostAndProfit.
  const canSeeMoney = canSeeCostAndProfit(useMode())
  const { vehicles } = useVehicleStore()
  const { workOrders } = useWorkOrderStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { workers } = useWorkerStore()
  const { serviceEvents } = useServiceEventStore()
  const { serviceItemTypes } = useServiceItemTypeStore()
  const settings = useSettingsStore((s) => s.settings)
  const [search, setSearch] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [taggedOnly, setTaggedOnly] = useState(false)

  // Was recomputed on every render with no useMemo at all — including
  // vehicleHistory/timelineData/lastServicedByItemType on every keystroke in
  // the search box above, none of which that keystroke could actually change.
  const matchingVehicles = useMemo(
    () =>
      search.length >= 2
        ? vehicles.filter(v => {
            const q = search.toLowerCase()
            return (
              v.licensePlate?.toLowerCase().includes(q) ||
              v.vin?.toLowerCase().includes(q) ||
              `${v.make} ${v.model}`.toLowerCase().includes(q)
            )
          })
        : [],
    [vehicles, search]
  )

  const selectedVehicle = selectedVehicleId ? vehicles.find(v => v.id === selectedVehicleId) : null

  const vehicleHistory = useMemo(
    () =>
      selectedVehicleId
        ? getCompletedOrdersForVehicle(workOrders, selectedVehicleId, { taggedOnly })
        : [],
    [workOrders, selectedVehicleId, taggedOnly]
  )

  const getOwnerName = (vehicle: typeof vehicles[0]) => ownerName(vehicle, customers, companies)
  const getWorkerName = (workerId: string | null) => workerName(workerId, workers)
  const itemTypeName = useMemo(() => itemTypeNameLookup(serviceItemTypes), [serviceItemTypes])
  const handlePrintReceipt = (wo: (typeof vehicleHistory)[number]) => {
    printReceipt(wo, receiptShopInfoFromSettings(settings))
  }

  const { totalVisits, totalSpent } = serviceHistoryTotals(vehicleHistory)

  const timelineData = useMemo(
    () =>
      [...vehicleHistory].reverse().map((wo, index) => ({
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
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getWorkerName is a fresh closure every render but only ever reads `workers`, already listed.
    [vehicleHistory, itemTypeName, workers, t]
  )

  // Most recent ServiceEvent date/odometer per item type, for the "last
  // serviced" summary — independent of the tagged-only timeline filter above.
  // The full serviceItemTypes × serviceEvents scan this does was the one most
  // worth memoizing: it used to re-run on every keystroke in the search box
  // even while a vehicle was already selected and neither list had changed.
  const lastServiced = useMemo(
    () => (selectedVehicleId ? lastServicedByItemType(selectedVehicleId, serviceItemTypes, serviceEvents) : []),
    [selectedVehicleId, serviceItemTypes, serviceEvents]
  )

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
            <VehicleSearchResults
              query={search}
              vehicles={matchingVehicles}
              getOwnerLabel={getOwnerName}
              onSelect={(v) => {
                setSelectedVehicleId(v.id)
                setSearch('')
              }}
            />
          </div>
        )}
      </div>

      {/* Selected Vehicle */}
      {selectedVehicle && (
        <>
          <VehicleSummaryCard
            vehicle={selectedVehicle}
            ownerLabel={getOwnerName(selectedVehicle)}
            canSeeMoney={canSeeMoney}
            totalVisits={totalVisits}
            totalSpent={totalSpent}
            lastServiced={lastServiced}
            onClear={() => setSelectedVehicleId(null)}
          />

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
                {canSeeMoney && (
                  <>
                    <p className="text-caption mb-2">{t('serviceHistory.timelineHoverHint')}</p>
                    <ServiceHistoryTimelineChart data={timelineData} className="mb-6" />
                  </>
                )}
                <ServiceVisitList orders={vehicleHistory} itemTypeName={itemTypeName} workerName={getWorkerName} onPrint={handlePrintReceipt} />
              </>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {!selectedVehicle && search.length < 2 && (
        <EmptyState icon={History} title={t('serviceHistory.searchForVehicleTitle')} message={t('serviceHistory.searchForVehicleMessage')} />
      )}
    </div>
  )
}
