import { useState } from 'react'
import { useWorkOrderStore, WorkOrder } from '../../store/workOrderStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation } from '../../lib/i18n'
import { printReceipt } from '../Receipt'
import { deleteOrder } from '../../lib/ops/orderOps'
import { rowEditOnDoubleClick } from '../../lib/rowInteraction'
import { formatCurrency } from '../../lib/currency'
import { vehicleLabelWithPlate, ownerName, workerName, vehiclePlate } from '../../lib/entities'
import { Pencil, Printer, Trash2 } from 'lucide-react'
import { DropdownMenu } from '../ui/DropdownMenu'
import { Tabs } from '../ui/Tabs'
import { StatusBadge } from '../ui/Badge'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'

export function WorkOrderList({ onEdit }: { onEdit: (id: string) => void }) {
  const { t } = useTranslation()
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const vehicles = useVehicleStore(s => s.vehicles)
  const workers = useWorkerStore(s => s.workers)
  const settings = useSettingsStore(s => s.settings)

  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredOrders = workOrders.filter(wo => {
    if (filter === 'open') return wo.status === 'open'
    if (filter === 'completed') return wo.status === 'completed'
    return true
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const getVehicleDisplay = (vehicleId: string) => vehicleLabelWithPlate(vehicles.find(x => x.id === vehicleId))
  const getOwnerName = (vehicleId: string) => ownerName(vehicles.find(x => x.id === vehicleId), customers, companies)
  const getWorkerName = (workerId: string | null) => workerName(workerId, workers)
  const getVehiclePlate = (vehicleId: string) => vehiclePlate(vehicles.find(x => x.id === vehicleId))

  const handlePrintReceipt = (wo: WorkOrder) => {
    printReceipt(wo, {
      shopName: settings.shopName,
      shopAddress: settings.shopAddress,
      shopPhone: settings.shopPhone,
      footerText: settings.receiptFooter,
    })
  }

  const deletingOrder = deletingId ? workOrders.find(wo => wo.id === deletingId) : null

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={t('workOrders.pageTitle')}
        caption={t('workOrders.pageCaption')}
      />

      <Tabs
        className="mb-4"
        value={filter}
        onChange={(v) => setFilter(v as typeof filter)}
        tabs={[
          { value: 'all', label: t('workOrders.tabAll'), count: workOrders.length },
          { value: 'open', label: t('workOrders.tabOpen'), count: workOrders.filter(wo => wo.status === 'open').length },
          { value: 'completed', label: t('workOrders.tabCompleted'), count: workOrders.filter(wo => wo.status === 'completed').length },
        ]}
      />

      {filteredOrders.length === 0 ? (
        <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
          {t('workOrders.noOrdersFound')}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {filteredOrders.map(wo => (
            <div key={wo.id} className="bg-surface-card rounded-radius-md overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-surface-sunken active:bg-bg-4 transition-colors"
                {...rowEditOnDoubleClick(() => onEdit(wo.id))}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-sm font-semibold text-accent">SB-{wo.orderNumber}</h3>
                    <StatusBadge status={wo.status} />
                  </div>
                  <p className="text-sm text-text-secondary">
                    <span className="text-text-primary">{getOwnerName(wo.vehicleId)}</span>
                    {' • '}{getVehicleDisplay(wo.vehicleId)}
                    {' • '}<span className="font-mono">{getVehiclePlate(wo.vehicleId)}</span>
                    {' • '}{getWorkerName(wo.workerId)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-semibold text-text-primary tabular-nums">{formatCurrency(wo.total)}</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      items={[
                        ...(wo.status === 'open' ? [{ label: t('common.edit'), icon: Pencil, onClick: () => onEdit(wo.id) }] : []),
                        ...(wo.status === 'completed' ? [{ label: t('workOrders.printAction'), icon: Printer, onClick: () => handlePrintReceipt(wo) }] : []),
                        { label: t('common.delete'), icon: Trash2, onClick: () => setDeletingId(wo.id), variant: 'danger' as const },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!deletingId} onClose={() => setDeletingId(null)} title={t('workOrders.deleteOrderTitle')} size="sm">
        <p>
          {t('workOrders.deleteOrderMessage', { order: `SB-${deletingOrder?.orderNumber}` })}
        </p>
        {deletingOrder?.status === 'completed' && (
          <p className="text-sm text-text-secondary mt-2">
            {t('workOrders.deleteOrderStockNote')}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={() => setDeletingId(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={() => { if (deletingId) deleteOrder(deletingId); setDeletingId(null) }}>
            {t('common.delete')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
