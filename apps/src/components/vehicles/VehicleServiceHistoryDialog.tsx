// A vehicle's full service history: visits, totals, when each tracked item was
// last done, and (admin) what each visit cost over time. Opened from a
// vehicle's row on Vehicles, a reminder on the Dashboard and the Reminders
// tab. This used to be a quick glance, with the chart and the "last
// serviced" grid kept for a separate Service History page; that page is gone
// (it was a search box in front of this same history), so this dialog is now
// the one place it lives. The shared filter/sort and tag-label logic is in
// src/lib/vehicles/vehicleServiceHistory.ts.
import { useMemo } from 'react'
import { History } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useServiceEventStore } from '../../store/serviceEventStore'
import { useWorkerStore } from '../../store/workerStore'
import { useSettingsStore } from '../../store/settingsStore'
import {
  getCompletedOrdersForVehicle,
  serviceHistoryTotals,
  lastServicedByItemType,
  serviceTagLabel,
} from '../../lib/vehicles/vehicleServiceHistory'
import { printReceipt, receiptShopInfoFromSettings } from '../workOrders/Receipt'
import { formatCurrency } from '../../lib/format/numbers'
import { workerName, itemTypeNameLookup, vehicleLabelWithPlate } from '../../lib/format/entities'
import { useTranslation } from '../../lib/i18n'
import { useMode } from '../../store/authStore'
import { canSeeCostAndProfit } from '../../lib/auth/permissions'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { StatTile } from '../ui/StatTile'
import { ServiceVisitList } from '../serviceHistory/ServiceVisitList'
import { ServiceHistoryTimelineChart } from '../serviceHistory/ServiceHistoryTimelineChart'
import { LastServicedGrid } from '../serviceHistory/LastServicedGrid'
import { visitOdometer } from '../../lib/vehicles/visitOdometer'

export function VehicleServiceHistoryDialog({
  open,
  vehicle,
  onClose,
}: {
  open: boolean
  vehicle: Vehicle
  onClose: () => void
}) {
  const { t } = useTranslation()
  // Per-order totals and line prices stay visible (a worker handing back a
  // vehicle may need to say what a past visit cost) — only the aggregate
  // "total spent" figure and the spend-over-time chart are admin-only. See
  // src/lib/auth/permissions.ts's canSeeCostAndProfit.
  const canSeeMoney = canSeeCostAndProfit(useMode())
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const serviceEvents = useServiceEventStore((s) => s.serviceEvents)
  const workers = useWorkerStore((s) => s.workers)
  const settings = useSettingsStore((s) => s.settings)

  const history = useMemo(() => getCompletedOrdersForVehicle(workOrders, vehicle.id), [workOrders, vehicle.id])
  const { totalVisits, totalSpent } = serviceHistoryTotals(history)

  const getWorkerName = (workerId: string | null) => workerName(workerId, workers)
  const itemTypeName = useMemo(() => itemTypeNameLookup(serviceItemTypes), [serviceItemTypes])
  const handlePrintReceipt = (wo: (typeof history)[number]) => {
    printReceipt(wo, receiptShopInfoFromSettings(settings))
  }

  // Most recent ServiceEvent date/odometer per item type.
  const lastServiced = useMemo(
    () => lastServicedByItemType(vehicle.id, serviceItemTypes, serviceEvents),
    [vehicle.id, serviceItemTypes, serviceEvents]
  )

  const timelineData = useMemo(
    () =>
      [...history].reverse().map((wo, index) => ({
        id: wo.id,
        index,
        date: wo.completedAt || wo.createdAt,
        orderNumber: wo.orderNumber,
        orderNumberSuffix: wo.orderNumberSuffix,
        total: wo.total,
        odometer: visitOdometer(wo),
        workerName: workerName(wo.workerId, workers),
        items: wo.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          tag: serviceTagLabel(item, itemTypeName, t),
        })),
      })),
    [history, itemTypeName, workers, t]
  )

  return (
    <Dialog open={open} onClose={onClose} title={t('serviceHistory.title')} size="xl">
      <p className="text-sm text-text-primary mb-3">{vehicleLabelWithPlate(vehicle)}</p>

      {history.length === 0 ? (
        <EmptyState icon={History} title={t('serviceHistory.noHistoryFound')} />
      ) : (
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <div className={`grid gap-4 mb-4 pb-4 border-b border-border-subtle ${canSeeMoney ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <StatTile label={t('serviceHistory.totalVisits')} value={totalVisits} />
            {canSeeMoney && <StatTile label={t('serviceHistory.totalSpent')} value={formatCurrency(totalSpent)} />}
          </div>

          <LastServicedGrid entries={lastServiced} className="mb-4 pb-4 border-b border-border-subtle" />

          {canSeeMoney && history.length > 1 && (
            <>
              <p className="text-caption mb-2">{t('serviceHistory.timelineHoverHint')}</p>
              <ServiceHistoryTimelineChart data={timelineData} className="mb-6" />
            </>
          )}

          <ServiceVisitList orders={history} itemTypeName={itemTypeName} workerName={getWorkerName} onPrint={handlePrintReceipt} />
        </div>
      )}

      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>
          {t('common.close')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
