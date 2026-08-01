// Pure construction of a ServiceEvent from a completed WorkOrder. No store
// access — src/lib/ops/orderOps.ts calls this and persists the result.
import type { WorkOrder, WorkOrderItem } from '../store/workOrderStore'
import type { ServiceEvent, ServiceEventItem } from '../store/serviceEventStore'
import { newId } from './id'

type TaggedItem = WorkOrderItem & { serviceItemTypeId: string }

function isTagged(item: WorkOrderItem): item is TaggedItem {
  return !!item.serviceItemTypeId
}

/**
 * Returns null when no line on the order was tagged with a service item —
 * most orders (tire rotation, wash, etc.) never produce a ServiceEvent.
 */
export function buildServiceEventFromOrder(order: WorkOrder): Omit<ServiceEvent, 'id' | 'createdAt'> | null {
  const tagged = order.items.filter(isTagged)
  if (tagged.length === 0) return null

  const items: ServiceEventItem[] = tagged.map((item) => ({
    id: newId(),
    itemTypeId: item.serviceItemTypeId,
    action: item.serviceAction ?? 'changed',
    quantityLiters: item.quantityLiters ?? null,
    containerType: item.containerType ?? null,
    notes: '',
  }))

  return {
    vehicleId: order.vehicleId,
    workOrderId: order.id,
    date: order.completedAt ?? order.date,
    odometerAtArrival: order.odometerAtArrival,
    odometerAtService: order.odometerAtService,
    items,
    notes: '',
  }
}
