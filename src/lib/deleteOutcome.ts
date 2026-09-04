// The confirm -> checked-delete -> toast shape repeated at 8 call sites
// (Customers, Companies, Vehicles, Technicians, Suppliers, Inventory,
// Settings x2), inconsistently: Customers/Companies/Vehicles fire a success
// toast on top of the blocked-delete warning, Technicians/Inventory/Settings
// don't. This doesn't force one behavior — a page still decides whether it
// wants a success toast by passing `deletedTitle` or leaving it out — it just
// gives the decision one shape instead of eight hand-written if/else blocks.
import type { DeleteResult } from './ops/entityOps'

export interface DeleteOutcomeLabels {
  /** Shown as a warning toast when the delete was blocked; `result.reason`
   *  (already a translated, specific reason from deletionPolicy.ts) becomes
   *  the toast's description. */
  cannotDeleteTitle: string
  /** Shown as a success toast on an actual delete. Omit to stay silent on
   *  success — matches pages that never celebrated a delete before this. */
  deletedTitle?: string
}

export interface ToastSpec {
  tone: 'success' | 'warning'
  title: string
  description?: string
}

/** null means "show nothing" — a successful delete at a page that has no
 *  `deletedTitle` configured. */
export function deleteOutcomeToast(result: DeleteResult, labels: DeleteOutcomeLabels): ToastSpec | null {
  if (!result.ok) return { tone: 'warning', title: labels.cannotDeleteTitle, description: result.reason }
  return labels.deletedTitle ? { tone: 'success', title: labels.deletedTitle } : null
}
