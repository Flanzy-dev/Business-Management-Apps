// Merging vehicles that share a plate into one. The decisions — which vehicle
// survives, which schedule rule stays live, which follow-up is kept, what the
// survivor's card inherits — are all made by src/lib/vehicles/vehicleReferences.ts's
// planVehicleMerge; this file only applies a plan, store by store, one set()
// each.
//
// Order matters only at the end: every reference moves first, the losers are
// deleted last, so there is no moment where a row points at a vehicle that's
// already gone.
import { duplicatePlateGroups } from '../vehicles/vehicleIdentity'
import { chooseSurvivor, planVehicleMerge, type VehicleMergePlan } from '../vehicles/vehicleReferences'
import { vehicleLabelWithPlate } from '../format/entities'
import { createActivityOps } from './activityOps'
import { realOpsDeps, type OpsDeps } from './deps'

export type VehicleMergeOpsDeps = Pick<
  OpsDeps,
  'vehicles' | 'workOrders' | 'scheduleRules' | 'serviceEvents' | 'appointments' | 'reminderFollowUps' | 'activityLog' | 'mode'
>

export function createVehicleMergeOps(deps: VehicleMergeOpsDeps) {
  const { recordEntityChange } = createActivityOps(deps)

  function world() {
    return {
      workOrders: deps.workOrders.getState().workOrders,
      scheduleRules: deps.scheduleRules.getState().scheduleRules,
      serviceEvents: deps.serviceEvents.getState().serviceEvents,
      appointments: deps.appointments.getState().appointments,
      followUps: deps.reminderFollowUps.getState().followUps,
    }
  }

  /**
   * Merge `loserIds` into `survivorId`. Returns the applied plan, or null when
   * either side is missing (already merged, deleted on another device).
   */
  function mergeVehicles(survivorId: string, loserIds: string[]): VehicleMergePlan | null {
    const { vehicles } = deps.vehicles.getState()
    const survivor = vehicles.find((v) => v.id === survivorId)
    const losers = vehicles.filter((v) => loserIds.includes(v.id) && v.id !== survivorId)
    if (!survivor || losers.length === 0) return null

    const plan = planVehicleMerge(survivor, losers, world())
    const from = plan.loserIds
    deps.workOrders.getState().reassignVehicle(from, survivorId)
    deps.serviceEvents.getState().reassignVehicle(from, survivorId)
    deps.appointments.getState().reassignVehicle(from, survivorId)
    const rules = deps.scheduleRules.getState()
    rules.reassignVehicle(from, survivorId)
    rules.supersedeRules(plan.supersedeRuleIds)
    deps.reminderFollowUps.getState().replaceForVehicles([survivorId, ...from], plan.followUp)

    const vehicleStore = deps.vehicles.getState()
    if (Object.keys(plan.survivorPatch).length) vehicleStore.updateVehicle(survivorId, plan.survivorPatch)
    vehicleStore.deleteVehicles(from)

    recordEntityChange('update', 'vehicle', survivorId, `${vehicleLabelWithPlate(survivor)} (+${from.length} digabung)`)
    return plan
  }

  /**
   * Every duplicate-plate group in the shop, each merged into the vehicle its
   * latest visit was on. Returns how many groups and vehicles were folded.
   */
  function mergeAllDuplicatePlates(): { groups: number; vehiclesRemoved: number } {
    const { workOrders } = deps.workOrders.getState()
    let groups = 0
    let vehiclesRemoved = 0
    for (const group of duplicatePlateGroups(deps.vehicles.getState().vehicles)) {
      const survivor = chooseSurvivor(group, workOrders)
      const plan = mergeVehicles(survivor.id, group.filter((v) => v.id !== survivor.id).map((v) => v.id))
      if (!plan) continue
      groups++
      vehiclesRemoved += plan.loserIds.length
    }
    return { groups, vehiclesRemoved }
  }

  return { mergeVehicles, mergeAllDuplicatePlates }
}

// The one real instance the running app uses.
const defaultOps = createVehicleMergeOps(realOpsDeps)
export const mergeVehicles = defaultOps.mergeVehicles
export const mergeAllDuplicatePlates = defaultOps.mergeAllDuplicatePlates
