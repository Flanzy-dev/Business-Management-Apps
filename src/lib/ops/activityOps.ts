// The single writer of the accountability log (src/store/activityLogStore.ts).
//
// Before this, every page assembled the entry itself — nine near-identical
// `record({ action, entityType, entityId, label, mode })` blocks across
// Customers/Companies/Vehicles, each re-deciding the entity-type string, how to
// label the record, and how to coerce the mode. Two things went wrong with that
// shape and both are structural rather than sloppiness:
//
//  1. On a delete the label has to be snapshotted BEFORE the row goes, because
//     afterwards there is nothing left to read a name off of. That ordering
//     lived in a comment at each call site, i.e. in whoever remembered it.
//  2. Nothing connected "this entity was deleted" to "the log was written", so
//     a new delete path simply wouldn't be logged and no test would notice.
//
// Both are fixed by giving deletes their log entry inside entityOps (where the
// store read happens anyway, before the delete) and leaving callers one small
// call for the create/update cases.
import type { ActivityEntityType, ActivityLogAction } from '../../store/activityLogStore'
import { realOpsDeps, type OpsDeps } from './deps'

export type ActivityOpsDeps = Pick<OpsDeps, 'activityLog' | 'mode'>

export function createActivityOps(deps: ActivityOpsDeps) {
  /**
   * Append one entry. `label` is a snapshot, not a reference: for a delete it's
   * the only surviving trace of what the row was called, and for create/update
   * it's what the entity was named at that moment — a later rename must not
   * rewrite history.
   */
  function recordEntityChange(
    action: ActivityLogAction,
    entityType: ActivityEntityType,
    entityId: string,
    label: string
  ): void {
    deps.activityLog.getState().record({
      action,
      entityType,
      entityId,
      label,
      mode: deps.mode(),
    })
  }

  return { recordEntityChange }
}

// The one real instance the running app uses.
const defaultOps = createActivityOps(realOpsDeps)

export const recordEntityChange = defaultOps.recordEntityChange
