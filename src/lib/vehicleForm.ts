// The decisions behind the add/edit-vehicle form, pulled out of the component
// that renders it (src/components/vehicles/VehicleModal.tsx).
//
// Why this module exists: everything here used to live inside a component body,
// which in this repo is the one place a test can never reach — Vitest runs with
// environment:'node' and no jsdom/RTL (see src/lib/__tests__/permissions.test.ts).
// VehicleModal was the codebase's worst complexity hotspot by a factor of ~1.7
// (cyclomatic 57), and all of it was rules, not rendering: which owner a vehicle
// belongs to, whether it becomes that owner's default, what a valid plate/VIN is,
// and how ~20 form fields become a Vehicle. Those are exactly the things a shop
// would notice getting wrong, so they belong somewhere testable.
//
// Pure and store-free: callers pass the vehicle list in, same convention as
// orderLifecycle.ts and stockLedger.ts.
import type { Vehicle } from '../store/vehicleStore'
import type { ServiceCatalogItem } from '../store/serviceCatalogStore'
import { validateVIN, validateLicensePlate } from './validators'

export type OwnerType = 'customer' | 'company'

export type ScheduleMode = 'workshop_default' | 'customer_interval' | 'custom'

/**
 * What the form decided about this new vehicle's service schedule.
 * - `workshop_default` — seed a live ScheduleRule for exactly `serviceIds`
 *   (the Add Vehicle checklist's ticked catalog services). Empty means seed
 *   nothing (everything unticked).
 * - `customer_interval` — seed every item type the catalog can unambiguously
 *   resolve, then supersede engine oil with `oilIntervalKm`, the km interval
 *   the customer asked for at intake. `serviceIds` is unused for this mode.
 * - `custom` — seed nothing; the shop sets the schedule up later. `serviceIds`
 *   is unused for this mode.
 */
export interface ScheduleChoice {
  mode: ScheduleMode
  serviceIds: string[]
  oilIntervalKm?: number
}

export interface ScheduleSetupCandidate {
  serviceId: string
  itemTypeId: string
  /** Untranslated store name (e.g. "Oli Mesin") — caller translates for
   *  display via serviceItemTypeLabel (entities.ts). */
  itemTypeName: string
  /** The catalog service's own name (e.g. "Ganti Oli Transmisi Matic") —
   *  shop-entered text, never translated. */
  serviceName: string
  intervalKm: number | null
  intervalMonths: number | null
}

/**
 * Every catalog service that carries an interval, one row per service (not
 * per item type) in item-type-list order — what the Add Vehicle Workshop
 * Default checklist offers to seed. A tag with several candidate services
 * (e.g. manual vs matic transmission oil, both tagged "Oli Transmisi") lists
 * all of them rather than resolveDefaultCatalogMatch's usual refusal to
 * guess — the shop picks the right one per vehicle instead (see
 * toggleScheduleSelection).
 */
export function scheduleSetupCandidates(
  serviceItemTypes: { id: string; name: string }[],
  services: ServiceCatalogItem[]
): ScheduleSetupCandidate[] {
  const candidates: ScheduleSetupCandidate[] = []
  for (const it of serviceItemTypes) {
    for (const s of services) {
      if (s.serviceItemTypeId !== it.id || !(s.intervalKm || s.intervalMonths)) continue
      candidates.push({
        serviceId: s.id,
        itemTypeId: it.id,
        itemTypeName: it.name,
        serviceName: s.name,
        intervalKm: s.intervalKm ?? null,
        intervalMonths: s.intervalMonths ?? null,
      })
    }
  }
  return candidates
}

/** What the checklist opens showing: a tag with exactly one candidate
 *  service starts ticked (same coverage a resolvable tag always got before
 *  ambiguous ones were even listed); a tag with several candidates starts
 *  with none ticked — the same "never guess" default those rows would have
 *  gotten by being left off the checklist entirely. */
export function initialScheduleSelection(candidates: ScheduleSetupCandidate[]): Record<string, boolean> {
  const perType = new Map<string, number>()
  for (const c of candidates) perType.set(c.itemTypeId, (perType.get(c.itemTypeId) ?? 0) + 1)
  return Object.fromEntries(candidates.map((c) => [c.serviceId, perType.get(c.itemTypeId) === 1]))
}

/**
 * Applies one checklist tick, keeping at most one ticked service per item
 * type — only one live ScheduleRule can exist per vehicle+item-type pair
 * (setScheduleRule always supersedes), so ticking one sibling clears any
 * other already-ticked sibling under the same tag rather than letting both
 * silently race to seed the same rule. Ticking off just clears itself; an
 * unrecognized id is a no-op.
 */
export function toggleScheduleSelection(
  candidates: ScheduleSetupCandidate[],
  selected: Record<string, boolean>,
  serviceId: string
): Record<string, boolean> {
  const candidate = candidates.find((c) => c.serviceId === serviceId)
  if (!candidate) return selected
  const turningOn = !selected[serviceId]
  const next = { ...selected }
  if (turningOn) {
    for (const c of candidates) if (c.itemTypeId === candidate.itemTypeId) next[c.serviceId] = false
  }
  next[serviceId] = turningOn
  return next
}

/**
 * The chosen radio (+ the Workshop Default checklist's ticked state, or the
 * Customer Interval field's typed km) as a ScheduleChoice, or null when
 * Customer Interval was picked but its km field isn't a usable positive
 * number — the form's cue to refuse the submit.
 */
export function scheduleChoiceFromForm(
  mode: ScheduleMode,
  selected: Record<string, boolean>,
  oilIntervalKmText: string
): ScheduleChoice | null {
  if (mode === 'custom') return { mode, serviceIds: [] }

  if (mode === 'workshop_default') {
    const serviceIds = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([id]) => id)
    return { mode, serviceIds }
  }

  // customer_interval — always required, unlike a blank checklist row.
  const km = parseInt(oilIntervalKmText, 10)
  if (!oilIntervalKmText.trim() || !Number.isFinite(km) || km <= 0) return null
  return { mode, serviceIds: [], oilIntervalKm: km }
}

/**
 * What a fresh vehicle's `createVehicleWithSchedule` result is worth telling
 * the counter about — shared by every screen that can create a vehicle
 * (Vehicles.tsx, and the New Order dialog's inline step) so the two can't
 * drift on which case gets which toast. Translation stays with the caller;
 * this only decides which case applies.
 */
export type ScheduleSeedOutcome =
  | { kind: 'seeded'; count: number }
  | { kind: 'customerIntervalNotApplied' }
  | { kind: 'none' }

export function scheduleSeedOutcome(
  schedule: ScheduleChoice,
  result: { seededRules: unknown[]; oilIntervalApplied: boolean }
): ScheduleSeedOutcome {
  if (schedule.oilIntervalKm != null && !result.oilIntervalApplied) {
    return { kind: 'customerIntervalNotApplied' }
  }
  if (result.seededRules.length > 0) return { kind: 'seeded', count: result.seededRules.length }
  return { kind: 'none' }
}

/**
 * The toast half of scheduleSeedOutcome, split out the same way
 * deleteOutcome.ts splits a delete result from its toast: decide the case
 * here, translate at the caller. Was hand-duplicated identically at both
 * screens that create a vehicle (Vehicles.tsx, NewWorkOrderDialog.tsx) —
 * null means "show nothing" (the 'none' case), same convention as
 * deleteOutcomeToast.
 */
export function scheduleSeedToast(
  outcome: ScheduleSeedOutcome,
  t: (key: string, vars?: Record<string, string | number>) => string
): { tone: 'success' | 'warning'; title: string } | null {
  if (outcome.kind === 'customerIntervalNotApplied') {
    return { tone: 'warning', title: t('vehicles.customerIntervalNotAppliedToast') }
  }
  if (outcome.kind === 'seeded') {
    return { tone: 'success', title: t('vehicles.scheduleSeededToast', { count: outcome.count }) }
  }
  return null
}

/**
 * The form's own state. Numbers are strings because that's what an <input>
 * holds — a half-typed year is "20", which is neither 20 nor invalid yet.
 * Conversion to the stored shape happens once, in vehicleDraftToData.
 */
export interface VehicleDraft {
  ownerType: OwnerType
  customerId: string
  companyId: string
  make: string
  model: string
  year: string
  vin: string
  licensePlate: string
  color: string
  currentMileage: string
  engineType: string
  engineSize: string
  oilTypeRequired: string
  oilCapacity: string
  transmissionType: string
  transmissionFluidType: string
  driveType: string
  differentialFluidType: string
  notes: string
}

/** Where the form starts: an existing vehicle's values when editing, else the
 *  owner the caller pre-selected (e.g. arriving from a customer's page), else
 *  empty. An existing vehicle's own owner always wins over a hint. */
export function initialVehicleDraft(
  vehicle: Vehicle | null,
  initial: { ownerType?: OwnerType; customerId?: string; companyId?: string } = {}
): VehicleDraft {
  return {
    ownerType: vehicle?.companyId ? 'company' : (initial.ownerType ?? 'customer'),
    customerId: vehicle?.customerId ?? initial.customerId ?? '',
    companyId: vehicle?.companyId ?? initial.companyId ?? '',
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year?.toString() ?? '',
    vin: vehicle?.vin ?? '',
    licensePlate: vehicle?.licensePlate ?? '',
    color: vehicle?.color ?? '',
    currentMileage: vehicle?.currentMileage?.toString() ?? '',
    engineType: vehicle?.engineType ?? '',
    engineSize: vehicle?.engineSize ?? '',
    oilTypeRequired: vehicle?.oilTypeRequired ?? '',
    oilCapacity: vehicle?.oilCapacity ?? '',
    transmissionType: vehicle?.transmissionType ?? '',
    transmissionFluidType: vehicle?.transmissionFluidType ?? '',
    driveType: vehicle?.driveType ?? '',
    differentialFluidType: vehicle?.differentialFluidType ?? '',
    notes: vehicle?.notes ?? '',
  }
}

/** Whichever owner id the selected owner type points at — '' when none picked. */
export function draftOwnerId(draft: VehicleDraft): string {
  return draft.ownerType === 'customer' ? draft.customerId : draft.companyId
}

/**
 * Does this draft's owner already have a vehicle? Drives the one default-vehicle
 * rule the UI has: an owner's FIRST vehicle silently becomes their default, and
 * nothing afterwards moves it (there is deliberately no UI to change it — see
 * vehicleDraftToData). False when no owner is selected: a vehicle with no owner
 * has no "first for this owner" to be.
 */
export function ownerHasVehicle(
  vehicles: Pick<Vehicle, 'customerId' | 'companyId'>[],
  draft: VehicleDraft
): boolean {
  const ownerId = draftOwnerId(draft)
  if (!ownerId) return false
  return vehicles.some((v) =>
    draft.ownerType === 'customer' ? v.customerId === ownerId : v.companyId === ownerId
  )
}

export type DraftValidation =
  | { ok: true }
  | {
      ok: false
      /** Make and/or model are blank — the two fields the form marks required. */
      missingRequired: boolean
      vinError?: string
      plateError?: string
    }

/**
 * Everything that must hold before a draft may be saved. Returns the field
 * errors together rather than the first one, so submitting a form with a bad
 * plate AND a bad VIN surfaces both instead of making the tech fix them one
 * round-trip at a time.
 */
export function validateVehicleDraft(draft: VehicleDraft): DraftValidation {
  const missingRequired = !draft.make.trim() || !draft.model.trim()
  const vin = validateVIN(draft.vin)
  const plate = validateLicensePlate(draft.licensePlate)

  if (!missingRequired && vin.valid && plate.valid) return { ok: true }
  return {
    ok: false,
    missingRequired,
    vinError: vin.error,
    plateError: plate.error,
  }
}

/**
 * The draft as the store wants it. `isNew` decides whether `isDefault` is set at
 * all: on an edit the key is omitted entirely so updateVehicle's partial merge
 * leaves whatever default status the vehicle already had — passing `false` there
 * would quietly demote an owner's default vehicle every time someone corrected
 * its mileage.
 */
export function vehicleDraftToData(
  draft: VehicleDraft,
  opts: { isNew: boolean; ownerHasVehicles: boolean }
): Omit<Vehicle, 'id' | 'createdAt'> {
  return {
    customerId: draft.ownerType === 'customer' ? draft.customerId || null : null,
    companyId: draft.ownerType === 'company' ? draft.companyId || null : null,
    make: draft.make,
    model: draft.model,
    year: draft.year ? parseInt(draft.year) : null,
    vin: draft.vin,
    licensePlate: draft.licensePlate,
    color: draft.color,
    currentMileage: draft.currentMileage ? parseInt(draft.currentMileage) : null,
    engineType: draft.engineType,
    engineSize: draft.engineSize,
    oilTypeRequired: draft.oilTypeRequired,
    oilCapacity: draft.oilCapacity,
    transmissionType: draft.transmissionType,
    transmissionFluidType: draft.transmissionFluidType,
    driveType: draft.driveType,
    differentialFluidType: draft.differentialFluidType,
    notes: draft.notes,
    ...(opts.isNew ? { isDefault: !opts.ownerHasVehicles } : {}),
  }
}
