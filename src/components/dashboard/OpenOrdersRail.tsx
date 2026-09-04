import { ClipboardList } from 'lucide-react'
import type { WorkOrder } from '../../store/workOrderStore'
import { formatCurrency } from '../../lib/currency'
import { orderStatusLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { StatusBadge } from '../ui/Badge'

interface OpenOrdersRailProps {
  orders: WorkOrder[]
  getOwnerName: (vehicleId: string) => string
  getVehicleLabel: (vehicleId: string) => string
  onSelectOrder: (workOrderId: string) => void
}

/** Dashboard's "Open work orders" card body — the 5 most recent open
 *  orders, or an empty state when there are none. */
export function OpenOrdersRail({ orders, getOwnerName, getVehicleLabel, onSelectOrder }: OpenOrdersRailProps) {
  const { t } = useTranslation()

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
        <ClipboardList size={32} className="mb-2 opacity-50" />
        <p className="text-sm">{t('dashboardWidgets.noOpenOrders')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {orders.map((wo) => (
        <div
          key={wo.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelectOrder(wo.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelectOrder(wo.id)
            }
          }}
          className="flex justify-between items-center p-3 bg-bg-1 border border-border-1 rounded-radius-sm cursor-pointer hover:border-accent/30 transition-colors focus-ring"
        >
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm text-accent">#{wo.orderNumber}</span>
            <span className="text-text-primary">{getOwnerName(wo.vehicleId)}</span>
            <span className="text-caption">{getVehicleLabel(wo.vehicleId)}</span>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge status="open" label={orderStatusLabel('open')} />
            <span className="font-mono font-medium text-text-primary tabular-nums">{formatCurrency(wo.total)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
