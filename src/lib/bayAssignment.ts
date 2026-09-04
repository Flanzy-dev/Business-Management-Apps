// Pure bay-assignment math. No store access — src/lib/ops/orderOps.ts reads
// live bays from bayStore and passes them in here, same convention as
// scheduleEngine.ts and orderLifecycle.ts.
import type { Bay } from '../store/bayStore'

/**
 * The bay currently holding this work order, if any — at most one, since
 * assignOrderToBay (orderOps.ts) releases whatever bay an order held before
 * claiming a new one.
 */
export function bayHoldingOrder(bays: Bay[], orderId: string): Bay | undefined {
  return bays.find((b) => b.currentWorkOrderId === orderId)
}

/** The first bay with nothing assigned — a default suggestion for the UI;
 *  the shop can still pick a different one explicitly. */
export function nextAvailableBay(bays: Bay[]): Bay | undefined {
  return bays.find((b) => b.status === 'available')
}

/**
 * ISO end time `minutes` from `now`. Computed here rather than inside
 * bayStore's own assignWorkOrder action, so the ops layer's injected `now()`
 * (src/lib/ops/deps.ts) is what determines it — a test can pin the result
 * the same way it pins every other stamped timestamp in the ops layer.
 */
export function estimatedEnd(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString()
}
