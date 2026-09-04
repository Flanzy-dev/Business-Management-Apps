import { useMemo, useState } from 'react'
import { useWorkOrderStore, WorkOrder } from '../../store/workOrderStore'
import { useWorkerStore } from '../../store/workerStore'
import { useVehicleDirectory } from '../../hooks/useVehicleDirectory'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation } from '../../lib/i18n'
import { printReceipt, receiptShopInfoFromSettings } from '../Receipt'
import { deleteOrder } from '../../lib/ops/orderOps'
import { outstandingReceivables } from '../../lib/receivables'
import { filterWorkOrderList, workOrderTabCounts, type WorkOrderListTab } from '../../lib/workOrderListFilter'
import { useMode } from '../../store/authStore'
import { canVoidOrder } from '../../lib/auth/permissions'
import { VoidOrderDialog } from './VoidOrderDialog'
import { WorkOrderRow } from './WorkOrderRow'
import { DeleteOrderDialog } from './DeleteOrderDialog'
import { vehicleLabelWithPlate, workerName, vehiclePlate } from '../../lib/entities'
import { Search } from 'lucide-react'
import { Tabs } from '../ui/Tabs'
import { PageHeader } from '../ui/PageHeader'

export function WorkOrderList({ onEdit }: { onEdit: (id: string) => void }) {
  const { t } = useTranslation()
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const { vehicleById, ownerNameFor } = useVehicleDirectory()
  const workers = useWorkerStore(s => s.workers)
  const settings = useSettingsStore(s => s.settings)

  const [filter, setFilter] = useState<WorkOrderListTab>('all')
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const canVoid = canVoidOrder(useMode())

  // Was three separate vehicles.find() scans per row (vehicle display, owner
  // name, plate) — and getOwnerName ran inside the search filter below, so a
  // keystroke re-scanned every vehicle for every order in the list. One map
  // (useVehicleDirectory), same pattern Dashboard.tsx uses for the same reason.
  const getVehicleDisplay = (vehicleId: string) => vehicleLabelWithPlate(vehicleById.get(vehicleId))
  // One shop-wide pass instead of a per-row outstandingReceivables call — same
  // reasoning as vehicleById above.
  const receivableByOrderId = useMemo(
    () => new Map(outstandingReceivables(workOrders).map(r => [r.order.id, r])),
    [workOrders]
  )
  const getOwnerName = ownerNameFor
  const getWorkerName = (workerId: string | null) => workerName(workerId, workers)
  const getVehiclePlate = (vehicleId: string) => vehiclePlate(vehicleById.get(vehicleId))

  const filteredOrders = useMemo(
    () =>
      filterWorkOrderList(workOrders, filter, query, (wo) => ({
        ownerName: getOwnerName(wo.vehicleId),
        vehicleDisplay: getVehicleDisplay(wo.vehicleId),
        vehiclePlate: getVehiclePlate(wo.vehicleId),
        workerName: getWorkerName(wo.workerId),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workOrders, filter, query, vehicleById, workers]
  )

  const handlePrintReceipt = (wo: WorkOrder) => {
    printReceipt(wo, receiptShopInfoFromSettings(settings))
  }

  const deletingOrder = deletingId ? workOrders.find(wo => wo.id === deletingId) ?? null : null
  const voidingOrder = voidingId ? workOrders.find(wo => wo.id === voidingId) ?? null : null
  const tabCounts = workOrderTabCounts(workOrders)

  const handleConfirmDelete = () => {
    if (deletingId) deleteOrder(deletingId)
    setDeletingId(null)
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={t('workOrders.pageTitle')}
        caption={t('workOrders.pageCaption')}
      />

      <div className="relative mb-3">
        <Search size={16} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('workOrders.searchPlaceholder')}
          className="w-full h-[34px] pl-9 pr-3 bg-surface-input border border-border-2 rounded-radius-sm text-fg-1 text-sm placeholder-fg-3 focus-ring"
        />
      </div>

      <Tabs
        className="mb-4"
        value={filter}
        onChange={(v) => setFilter(v as typeof filter)}
        tabs={[
          { value: 'all', label: t('workOrders.tabAll'), count: tabCounts.all },
          { value: 'open', label: t('workOrders.tabOpen'), count: tabCounts.open },
          { value: 'pending', label: t('workOrders.tabPending'), count: tabCounts.pending },
          { value: 'completed', label: t('workOrders.tabCompleted'), count: tabCounts.completed },
        ]}
      />

      {filteredOrders.length === 0 ? (
        <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
          {query.trim() ? t('workOrders.searchNoResults', { query: query.trim() }) : t('workOrders.noOrdersFound')}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {filteredOrders.map(wo => (
            <WorkOrderRow
              key={wo.id}
              order={wo}
              ownerName={getOwnerName(wo.vehicleId)}
              vehicleDisplay={getVehicleDisplay(wo.vehicleId)}
              vehiclePlate={getVehiclePlate(wo.vehicleId)}
              workerName={getWorkerName(wo.workerId)}
              receivable={receivableByOrderId.get(wo.id)}
              canVoid={canVoid}
              onEdit={() => onEdit(wo.id)}
              onPrint={() => handlePrintReceipt(wo)}
              onVoid={() => setVoidingId(wo.id)}
              onDelete={() => setDeletingId(wo.id)}
            />
          ))}
        </div>
      )}

      <VoidOrderDialog order={voidingOrder} onClose={() => setVoidingId(null)} />

      <DeleteOrderDialog order={deletingOrder} onClose={() => setDeletingId(null)} onConfirm={handleConfirmDelete} />
    </div>
  )
}
