// Quick "what did we last do to this car" popup, opened from Vehicles.tsx's
// row "..." menu — same idea as src/components/inventory/PriceHistoryDialog.tsx
// (a read-only history popup for one entity, opened from a row action), and
// the same timeline rows src/pages/ServiceHistory.tsx renders, so this reads
// as "the same history, just closer at hand" rather than a different
// feature. Deliberately excludes that page's chart and "last serviced by
// item type" schedule grid — those are for a deliberate deep look on a page
// you navigated to, not a fast glance from a list row. The shared filter/
// sort and tag-label logic lives in src/lib/vehicleServiceHistory.ts so this
// and the full page can't quietly drift apart.
import { History } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useWorkerStore } from '../../store/workerStore'
import { useSettingsStore } from '../../store/settingsStore'
import { getCompletedOrdersForVehicle, serviceHistoryTotals } from '../../lib/vehicleServiceHistory'
import { printReceipt, receiptShopInfoFromSettings } from '../Receipt'
import { formatCurrency } from '../../lib/currency'
import { workerName, itemTypeNameLookup, vehicleLabelWithPlate } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { useMode } from '../../store/authStore'
import { canSeeCostAndProfit } from '../../lib/auth/permissions'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { StatTile } from '../ui/StatTile'
import { ServiceVisitList } from '../serviceHistory/ServiceVisitList'

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
  // Same gate as ServiceHistory.tsx: per-order totals and line prices stay
  // visible (a worker handing back a vehicle may need to say what a past
  // visit cost) — only the aggregate "total spent" figure is admin-only.
  const canSeeMoney = canSeeCostAndProfit(useMode())
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const workers = useWorkerStore((s) => s.workers)
  const settings = useSettingsStore((s) => s.settings)

  const history = getCompletedOrdersForVehicle(workOrders, vehicle.id)
  const { totalVisits, totalSpent } = serviceHistoryTotals(history)

  const getWorkerName = (workerId: string | null) => workerName(workerId, workers)
  const itemTypeName = itemTypeNameLookup(serviceItemTypes)
  const handlePrintReceipt = (wo: (typeof history)[number]) => {
    printReceipt(wo, receiptShopInfoFromSettings(settings))
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('serviceHistory.title')} size="lg">
      <p className="text-sm text-text-primary mb-3">{vehicleLabelWithPlate(vehicle)}</p>

      {history.length === 0 ? (
        <EmptyState icon={History} title={t('serviceHistory.noHistoryFound')} />
      ) : (
        <>
          <div className={`grid gap-4 mb-4 pb-4 border-b border-border-subtle ${canSeeMoney ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <StatTile label={t('serviceHistory.totalVisits')} value={totalVisits} />
            {canSeeMoney && <StatTile label={t('serviceHistory.totalSpent')} value={formatCurrency(totalSpent)} />}
          </div>

          <div className="max-h-[50vh] overflow-y-auto pr-1">
            <ServiceVisitList orders={history} itemTypeName={itemTypeName} workerName={getWorkerName} onPrint={handlePrintReceipt} />
          </div>
        </>
      )}

      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>
          {t('common.close')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
