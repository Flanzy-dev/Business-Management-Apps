// The dot-and-connector timeline row for one completed WorkOrder — shared by
// src/pages/ServiceHistory.tsx (the full page) and
// src/components/vehicles/VehicleServiceHistoryDialog.tsx (the quick popup),
// so the two don't carry two copies of the same ~40 lines of markup. Pure
// presentational: takes already-filtered/sorted orders (see
// src/lib/vehicleServiceHistory.ts's getCompletedOrdersForVehicle) and the
// two lookup closures every consumer already has bound to its own stores.
import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import type { WorkOrder } from '../../store/workOrderStore'
import { serviceTagLabel } from '../../lib/vehicleServiceHistory'
import { useExpandOrEdit } from '../../lib/rowInteraction'
import { formatCurrency } from '../../lib/currency'
import { formatDistance } from '../../lib/units'
import { formatDate } from '../../lib/dates'
import { useTranslation } from '../../lib/i18n'
import { OrderBreakdown } from '../workOrders/OrderBreakdown'

export function ServiceVisitList({
  orders,
  itemTypeName,
  workerName,
  onPrint,
  className = '',
}: {
  orders: WorkOrder[]
  itemTypeName: (id: string) => string
  workerName: (workerId: string | null) => string
  /** Shows a "Print receipt" button on an expanded visit. Omitted, it's hidden — a host with no receipt settings on hand can leave it out entirely. */
  onPrint?: (order: WorkOrder) => void
  className?: string
}) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Single click toggles a visit's detail open/closed; a double click always
  // opens it — never closes what the user just asked to see. Same hook
  // Companies.tsx/Vehicles.tsx use for expand-vs-edit, here with "force open"
  // standing in for "edit" (see rowInteraction.ts's comment on why a plain
  // onClick would flicker the panel shut on every double click).
  const rowHandlers = useExpandOrEdit()

  return (
    <div className={`space-y-4 ${className}`}>
      {orders.map((wo, index) => {
        const expanded = expandedId === wo.id
        return (
          <div key={wo.id} className="flex gap-4 pb-4 border-b border-border-subtle last:border-0 last:pb-0">
            {/* Timeline Dot */}
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-accent flex-shrink-0" />
              {index < orders.length - 1 && <div className="w-px flex-1 bg-border-subtle mt-2" />}
            </div>

            {/* Content */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              {...rowHandlers(wo.id, () => setExpandedId(expanded ? null : wo.id), () => setExpandedId(wo.id))}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {expanded ? (
                    <ChevronDown size={14} className="text-text-secondary flex-shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-text-secondary flex-shrink-0" />
                  )}
                  <span className="text-text-primary font-mono text-sm">#{wo.orderNumber}</span>
                  <span className="text-text-secondary text-sm tabular-nums">{formatDate(wo.completedAt || wo.createdAt)}</span>
                </div>
                <span className="text-text-primary font-medium tabular-nums">{formatCurrency(wo.total)}</span>
              </div>

              <div className="space-y-1">
                {wo.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <Wrench size={12} className="text-text-secondary flex-shrink-0" />
                    <span className="text-text-secondary truncate">{item.description}</span>
                    <span className="text-caption flex-shrink-0">x{item.quantity}</span>
                    {serviceTagLabel(item, itemTypeName, t) && (
                      <span className="text-2xs uppercase tracking-wide text-accent flex-shrink-0">
                        {serviceTagLabel(item, itemTypeName, t)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 mt-2 text-caption">
                <span>
                  {t('serviceHistory.mileageField')} {(() => {
                    const odo = wo.odometerAtService ?? wo.odometerAtArrival
                    return odo != null ? formatDistance(odo) : '-'
                  })()}
                </span>
                <span>{t('serviceHistory.techField')} {workerName(wo.workerId)}</span>
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-border-subtle" data-no-row-edit>
                  <OrderBreakdown order={wo} itemTypeName={itemTypeName} onPrint={onPrint} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
