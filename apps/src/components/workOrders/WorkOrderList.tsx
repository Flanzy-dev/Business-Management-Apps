import { useDeferredValue, useMemo, useState } from 'react'
import { useWorkOrderStore, WorkOrder } from '../../store/workOrderStore'
import { useWorkerStore } from '../../store/workerStore'
import { useVehicleDirectory } from '../../hooks/useVehicleDirectory'
import { useIncrementalList } from '../../hooks/useIncrementalList'
import { ShowMoreFooter } from '../ui/ShowMoreFooter'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation } from '../../lib/i18n'
import { printReceipt, receiptShopInfoFromSettings } from './Receipt'
import { deleteOrder } from '../../lib/ops/orderOps'
import { outstandingReceivables } from '../../lib/orders/receivables'
import { filterWorkOrderList, workOrderTabCounts, type WorkOrderListTab } from '../../lib/orders/workOrderListFilter'
import { useMode } from '../../store/authStore'
import { canVoidOrder } from '../../lib/auth/permissions'
import { VoidOrderDialog } from './VoidOrderDialog'
import { WorkOrderRow } from './WorkOrderRow'
import { DeleteOrderDialog } from './DeleteOrderDialog'
import { vehicleLabelWithPlate, workerName, vehiclePlate } from '../../lib/format/entities'
import { ClipboardList, Search } from 'lucide-react'
import { useToastStore } from '../../store/uiStores'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Tabs } from '../ui/Tabs'
import { PageHeader } from '../ui/PageHeader'

export function WorkOrderList({ onEdit }: { onEdit: (id: string) => void }) {
  const { t } = useTranslation()
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const { vehicleById, ownerNameFor } = useVehicleDirectory()
  const workers = useWorkerStore(s => s.workers)
  const settings = useSettingsStore(s => s.settings)
  const showToast = useToastStore(s => s.show)

  // Opens on Open: the counter's job is the cars in the shop now, not the
  // full history.
  const [filter, setFilter] = useState<WorkOrderListTab>('open')
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

  // ~2,000 orders after the history import: filter on the deferred query so
  // typing stays instant, and mount only the first batch of matches.
  const deferredQuery = useDeferredValue(query)
  const filteredOrders = useMemo(
    () =>
      filterWorkOrderList(workOrders, filter, deferredQuery, (wo) => ({
        ownerName: getOwnerName(wo.vehicleId),
        vehicleDisplay: getVehicleDisplay(wo.vehicleId),
        vehiclePlate: getVehiclePlate(wo.vehicleId),
        workerName: getWorkerName(wo.workerId),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workOrders, filter, deferredQuery, vehicleById, workers]
  )
  const list = useIncrementalList(filteredOrders, `${filter}|${deferredQuery}`)

  const handlePrintReceipt = (wo: WorkOrder) => {
    printReceipt(wo, receiptShopInfoFromSettings(settings))
  }

  const deletingOrder = deletingId ? workOrders.find(wo => wo.id === deletingId) ?? null : null
  const voidingOrder = voidingId ? workOrders.find(wo => wo.id === voidingId) ?? null : null
  const tabCounts = useMemo(() => workOrderTabCounts(workOrders), [workOrders])

  const handleConfirmDelete = () => {
    if (deletingId) {
      deleteOrder(deletingId)
      showToast({ tone: 'success', title: t('workOrders.orderDeletedToast') })
    }
    setDeletingId(null)
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={t('workOrders.pageTitle')}
        caption={t('workOrders.pageCaption')}
      />

      <div className="mb-3">
        <Input
          type="text"
          leadingIcon={Search}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('workOrders.searchPlaceholder')}
          aria-label={t('workOrders.searchPlaceholder')}
        />
      </div>

      <Tabs
        className="mb-4"
        value={filter}
        onChange={(v) => setFilter(v as typeof filter)}
        tabs={[
          { value: 'open', label: t('workOrders.tabOpen'), count: tabCounts.open },
          { value: 'pending', label: t('workOrders.tabPending'), count: tabCounts.pending },
          { value: 'completed', label: t('workOrders.tabCompleted'), count: tabCounts.completed },
          ...(tabCounts.voided > 0 ? [{ value: 'voided', label: t('workOrders.tabVoided'), count: tabCounts.voided }] : []),
          { value: 'all', label: t('workOrders.tabAll'), count: tabCounts.all },
        ]}
      />

      {filteredOrders.length === 0 ? (
        query.trim() ? (
          <EmptyState
            icon={Search}
            title={t('workOrders.searchNoResults', { query: query.trim() })}
            action={filter !== 'all' && (
              <Button variant="secondary" onClick={() => setFilter('all')}>{t('workOrders.searchAllOrders')}</Button>
            )}
          />
        ) : filter === 'open' ? (
          <EmptyState icon={ClipboardList} title={t('workOrders.noOpenOrdersTitle')} message={t('workOrders.noOpenOrdersMessage')} />
        ) : (
          <EmptyState icon={ClipboardList} title={t('workOrders.noOrdersFound')} />
        )
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {list.visible.map(wo => (
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
          <ShowMoreFooter shown={list.shown} total={list.total} onShowMore={list.showMore} />
        </div>
      )}

      <VoidOrderDialog order={voidingOrder} onClose={() => setVoidingId(null)} />

      <DeleteOrderDialog order={deletingOrder} onClose={() => setDeletingId(null)} onConfirm={handleConfirmDelete} />
    </div>
  )
}
