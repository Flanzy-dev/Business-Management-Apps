// LineItemDialog's save-time decisions, pulled out of the component body —
// same "real rules belong in a plain .ts, not a component body" reasoning as
// every other *Form.ts module in this codebase.
import type { WorkOrderItem } from '../store/workOrderStore'
import { type ServiceTagState, emptyServiceTag } from '../components/workOrders/ServiceTagFields'

/** What the dialog hands back — the editable slice of a line item. */
export interface LineItemDraft {
  description: string
  quantity: number
  unitPrice: number
  kind: 'product' | 'service'
  serviceItemTypeId: string | null
  quantityLiters: number | null
  serviceAction: 'changed' | 'topped_up' | null
  containerType: WorkOrderItem['containerType']
  requestedIntervalKm: number | null
}

export function tagFromItem(item?: WorkOrderItem): ServiceTagState {
  if (!item?.serviceItemTypeId) return emptyServiceTag
  return {
    enabled: true,
    itemTypeId: item.serviceItemTypeId,
    quantityLiters: item.quantityLiters != null ? String(item.quantityLiters) : '',
    action: item.serviceAction ?? 'changed',
    containerType: item.containerType ?? '',
    requestedIntervalKm: item.requestedIntervalKm != null ? String(item.requestedIntervalKm) : '',
  }
}

export function canSaveLineItem(description: string, quantity: string): boolean {
  return description.trim().length > 0 && parseFloat(quantity) > 0
}

/** The vehicle's live interval for whichever item type is tagged right now —
 *  `null` with nothing tagged yet, so the placeholder has nothing to show. */
export function liveIntervalForTag(tag: ServiceTagState, getLiveIntervalKm?: (itemTypeId: string) => number | null): number | null {
  if (!tag.itemTypeId) return null
  return getLiveIntervalKm?.(tag.itemTypeId) ?? null
}

/**
 * The tagged fields only carry through when the tag is both enabled and has
 * an item type picked — an enabled-but-unpicked tag saves as an untagged
 * line, same as a disabled one.
 */
export function lineItemDraftFromForm(
  description: string,
  quantity: string,
  unitPrice: string,
  kind: 'product' | 'service',
  stockLinked: boolean,
  tag: ServiceTagState
): LineItemDraft {
  const tagged = tag.enabled && !!tag.itemTypeId
  return {
    description: description.trim(),
    quantity: parseFloat(quantity) || 1,
    unitPrice: Math.round(parseFloat(unitPrice) || 0),
    kind: stockLinked ? 'product' : kind,
    serviceItemTypeId: tagged ? tag.itemTypeId : null,
    quantityLiters: tagged && tag.quantityLiters ? parseFloat(tag.quantityLiters) : null,
    serviceAction: tagged ? tag.action : null,
    containerType: tagged ? tag.containerType || null : null,
    requestedIntervalKm: tagged && tag.action === 'changed' && tag.requestedIntervalKm ? parseInt(tag.requestedIntervalKm, 10) : null,
  }
}
