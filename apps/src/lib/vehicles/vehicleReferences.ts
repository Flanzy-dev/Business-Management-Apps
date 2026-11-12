// Everything that points at a vehicle, in one place. Pure — callers read the
// stores and pass arrays in (see ARCHITECTURE.md's ".tsx boundary").
//
// Five stores hold a vehicleId: work orders, schedule rules, service events,
// appointments and reminder follow-ups. Before this file, only the first two
// were known to anyone outside their own store: deletion.ts checked
// orders and rules, so a vehicle with an appointment or a follow-up could be
// deleted and leave those rows pointing at nothing. Merging two vehicles that
// share a plate (src/lib/vehicles/vehicleIdentity.ts) needs exactly the same knowledge
// — every row that says "vehicle B" has to end up saying "vehicle A" — so it
// lives here once, for both.
//
// A store that starts holding a vehicleId must be added here.
// src/lib/__tests__/vehicleReferences.test.ts scans src/store for vehicleId
// fields and fails if one is missing from VEHICLE_REFERENCE_STORES.
import type { Vehicle } from '../../store/vehicleStore'
import type { WorkOrder } from '../../store/workOrderStore'
import { newestRule, type ScheduleRule } from '../../store/scheduleRuleStore'
import type { ServiceEvent } from '../../store/serviceEventStore'
import type { Appointment } from '../../store/appointmentStore'
import type { ReminderFollowUp } from '../../store/reminderFollowUpStore'

/** The stores (by file, under src/store/) whose rows point at a vehicle. */
export const VEHICLE_REFERENCE_STORES = [
  'workOrderStore',
  'scheduleRuleStore',
  'serviceEventStore',
  'appointmentStore',
  'reminderFollowUpStore',
] as const

export interface VehicleWorld {
  workOrders: WorkOrder[]
  scheduleRules: ScheduleRule[]
  serviceEvents: ServiceEvent[]
  appointments: Appointment[]
  followUps: ReminderFollowUp[]
}

export interface VehicleReferenceCounts {
  orders: number
  /** Live rules only — superseded ones are history, not something the user can see or act on. */
  activeRules: number
  serviceEvents: number
  appointments: number
  followUp: boolean
}

const live = (r: ScheduleRule) => r.supersededAt === null

/**
 * How many rows of each kind point at this vehicle. Any part of the world the
 * caller doesn't have counts as empty — the deletion check, for one, is given
 * only what it consults.
 */
export function vehicleReferenceCounts(vehicleId: string, world: Partial<VehicleWorld>): VehicleReferenceCounts {
  const liveRules = (world.scheduleRules ?? []).filter((r) => r.vehicleId === vehicleId && live(r))
  return {
    orders: (world.workOrders ?? []).filter((wo) => wo.vehicleId === vehicleId).length,
    // One per item type, the way activeRulesForVehicle collapses sync duplicates.
    activeRules: new Set(liveRules.map((r) => r.itemTypeId)).size,
    serviceEvents: (world.serviceEvents ?? []).filter((e) => e.vehicleId === vehicleId).length,
    appointments: (world.appointments ?? []).filter((a) => a.vehicleId === vehicleId).length,
    followUp: (world.followUps ?? []).some((f) => f.vehicleId === vehicleId),
  }
}

/**
 * Which of several same-plate vehicles survives a merge: the one whose owner
 * brought the car in most recently (its newest work order), since that's who
 * the car belongs to now. A vehicle with no orders falls back to when it was
 * created. Ties keep list order.
 */
export function chooseSurvivor(vehicles: Vehicle[], workOrders: WorkOrder[]): Vehicle {
  const lastSeen = (v: Vehicle) =>
    workOrders.reduce((latest, wo) => (wo.vehicleId === v.id && wo.date > latest ? wo.date : latest), '') || v.createdAt
  return vehicles.reduce((best, v) => (lastSeen(v) > lastSeen(best) ? v : best))
}

/**
 * The more recently serviced of two live rules for the same item type: later
 * baseDate, then higher baseOdometer, then scheduleRuleStore's own newestRule
 * tie-break so every device picks the same one.
 */
function moreRecentlyServiced(a: ScheduleRule, b: ScheduleRule): ScheduleRule {
  const da = a.baseDate ?? ''
  const db = b.baseDate ?? ''
  if (da !== db) return da > db ? a : b
  const oa = a.baseOdometer ?? -1
  const ob = b.baseOdometer ?? -1
  if (oa !== ob) return oa > ob ? a : b
  return newestRule([a, b])!
}

const FILLABLE_TEXT_FIELDS = [
  'make', 'model', 'vin', 'color', 'engineType', 'engineSize', 'oilTypeRequired', 'oilCapacity',
  'transmissionType', 'transmissionFluidType', 'driveType', 'differentialFluidType',
] as const satisfies readonly (keyof Vehicle)[]

export interface VehicleMergePlan {
  survivorId: string
  loserIds: string[]
  /** Fields the survivor takes from the losers: blanks filled, the highest mileage, a merge note. */
  survivorPatch: Partial<Vehicle>
  /** Live rules that lose the per-item-type contest — superseded (never deleted) once every rule has moved to the survivor. */
  supersedeRuleIds: string[]
  /** The follow-up the survivor keeps, already re-keyed to it; null when none of them had one. */
  followUp: ReminderFollowUp | null
  /** What moves, for the confirmation and the activity log. */
  moved: { orders: number; serviceEvents: number; appointments: number; scheduleRules: number }
}

/**
 * Work out a merge of `loserIds` into `survivorId` without doing any of it —
 * applying it is src/lib/ops/vehicleMergeOps.ts.
 *
 * Every row pointing at a loser moves to the survivor, superseded schedule
 * rules included, so a rule's audit chain never ends at a deleted vehicle.
 * Where both sides had a live rule for the same item type, the more recently
 * serviced one stays live and the other is superseded — AGENTS.md's glossary: a rule is
 * never edited or deleted, only superseded.
 */
export function planVehicleMerge(
  survivor: Vehicle,
  losers: Vehicle[],
  world: VehicleWorld
): VehicleMergePlan {
  const loserIds = losers.map((v) => v.id)
  const all = new Set([survivor.id, ...loserIds])
  const fromLosers = <T extends { vehicleId: string | null }>(rows: T[]) => rows.filter((r) => r.vehicleId !== null && loserIds.includes(r.vehicleId))

  // Rule contest, per item type, across everyone's live rules.
  const liveByItem = new Map<string, ScheduleRule>()
  const supersedeRuleIds: string[] = []
  for (const r of world.scheduleRules) {
    if (!all.has(r.vehicleId) || !live(r)) continue
    const current = liveByItem.get(r.itemTypeId)
    if (!current) { liveByItem.set(r.itemTypeId, r); continue }
    const winner = moreRecentlyServiced(current, r)
    supersedeRuleIds.push(winner === current ? r.id : current.id)
    liveByItem.set(r.itemTypeId, winner)
  }

  // Follow-up: the survivor's own, else the most recent loser's.
  const followUps = world.followUps.filter((f) => all.has(f.vehicleId))
  const kept = followUps.find((f) => f.vehicleId === survivor.id)
    ?? followUps.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const followUp = kept ? { ...kept, id: survivor.id, vehicleId: survivor.id } : null

  const survivorPatch: Partial<Vehicle> = {}
  for (const field of FILLABLE_TEXT_FIELDS) {
    if (survivor[field]) continue
    const donor = losers.find((v) => v[field])
    if (donor) survivorPatch[field] = donor[field]
  }
  if (survivor.year == null) {
    const donor = losers.find((v) => v.year != null)
    if (donor) survivorPatch.year = donor.year
  }
  const mileages = [survivor, ...losers].map((v) => v.currentMileage).filter((m): m is number => m != null)
  if (mileages.length) {
    const highest = Math.max(...mileages)
    if (highest !== survivor.currentMileage) survivorPatch.currentMileage = highest
  }
  if (losers.length) {
    const note = `Digabung dari ${losers.length} kendaraan lain dengan no. polisi yang sama`
    survivorPatch.notes = survivor.notes ? `${survivor.notes}\n${note}` : note
  }

  return {
    survivorId: survivor.id,
    loserIds,
    survivorPatch,
    supersedeRuleIds,
    followUp,
    moved: {
      orders: fromLosers(world.workOrders).length,
      serviceEvents: fromLosers(world.serviceEvents).length,
      appointments: fromLosers(world.appointments).length,
      scheduleRules: fromLosers(world.scheduleRules).length,
    },
  }
}
