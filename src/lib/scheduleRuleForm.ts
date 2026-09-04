// The decisions behind the per-vehicle schedule setup form, pulled out of the
// component that renders it (src/components/vehicles/ScheduleRulesEditor.tsx),
// mirroring why src/lib/vehicleForm.ts exists for VehicleModal.tsx: a rule a
// shop would notice getting wrong (which axis a reminder tracks, whether it's
// complete enough to save) belongs somewhere a test can reach, not inside a
// component body — Vitest runs with environment:'node', no jsdom/RTL.
//
// Pure and store-free: callers pass the resolved rule/catalog-match/settings
// values in, same convention as vehicleForm.ts and orderLifecycle.ts.
import type { ScheduleRule } from '../store/scheduleRuleStore'
import type { ServiceCatalogItem } from '../store/serviceCatalogStore'
import { intervalAxisOf, IntervalAxis } from './entities'
import { formatNumber } from './units'
import { formatDate } from './dates'

// A schedule rule always tracks at least one axis (validateScheduleDraft
// below), so unlike the service catalog's four-way picker (which also allows
// "no reminder"), this form only ever offers these three.
export type ScheduleAxis = Exclude<IntervalAxis, 'none'>

// What auto-filled the interval fields, so the hint under them can say why
// without pretending a specific service set it when it was really the shop's
// own fallback (settingsStore.ts's defaultServiceIntervalKm/Months).
export type SchedulePrefill = { kind: 'service'; name: string } | { kind: 'shop_default' }

/**
 * The form's own state. Numbers are strings because that's what an <input>
 * holds — a half-typed interval is "50", which is neither 50 nor invalid yet.
 * Conversion to the stored shape happens once, in scheduleDraftToRuleData.
 */
export interface ScheduleRuleDraft {
  axis: ScheduleAxis
  intervalKm: string
  baseOdometer: string
  intervalMonths: string
  baseDate: string
  source: 'workshop_default' | 'customer_request'
}

export function emptyScheduleDraft(): ScheduleRuleDraft {
  return { axis: 'km', intervalKm: '', baseOdometer: '', intervalMonths: '', baseDate: '', source: 'workshop_default' }
}

/**
 * Where the form starts when an item type is selected — the three-branch
 * prefill this used to be inline in ScheduleRulesEditor.tsx's selectItemType:
 * an existing live rule loads it for editing; otherwise the catalog's default
 * interval for this tag prefills a fresh draft (resolveDefaultCatalogMatch —
 * a months-only match like brake fluid opens on "By time", not a spurious km
 * axis); otherwise the shop's own km/months pair fills both axes together,
 * same "whichever comes first" pairing the oil-change starter service ships
 * with. `existing`/`catalogMatch` are mutually exclusive from the caller's
 * side (a live rule already answers the question), but only one is read here
 * regardless — `existing` wins if given.
 */
export function scheduleDraftFor(
  existing: ScheduleRule | undefined,
  catalogMatch: ServiceCatalogItem | null,
  shopDefaults: { km: number; months: number },
  vehicleMileage: number | null,
  today: string
): { draft: ScheduleRuleDraft; prefilledFrom: SchedulePrefill | null } {
  if (existing) {
    // A live rule always has at least one axis, so intervalAxisOf never
    // actually returns 'none' here — the fallback just keeps TypeScript
    // satisfied without a runtime assertion.
    const axis = intervalAxisOf(existing.intervalKm, existing.intervalMonths)
    return {
      draft: {
        axis: axis === 'none' ? 'km' : axis,
        intervalKm: existing.intervalKm != null ? String(existing.intervalKm) : '',
        baseOdometer: existing.baseOdometer != null ? String(existing.baseOdometer) : '',
        intervalMonths: existing.intervalMonths ? String(existing.intervalMonths) : '',
        baseDate: existing.baseDate ?? '',
        source: existing.source,
      },
      prefilledFrom: null,
    }
  }

  // Prefill the base with the vehicle's current reading — the common case is
  // setting up the schedule while servicing the car now. Still fully
  // editable for a backdated entry.
  const baseOdometer = vehicleMileage != null ? String(vehicleMileage) : ''

  if (catalogMatch) {
    // resolveDefaultCatalogMatch only ever returns a candidate carrying at
    // least one interval, so this mirrors what actually got prefilled.
    const axis = intervalAxisOf(catalogMatch.intervalKm, catalogMatch.intervalMonths)
    return {
      draft: {
        axis: axis === 'none' ? 'km' : axis,
        intervalKm: catalogMatch.intervalKm ? String(catalogMatch.intervalKm) : '',
        baseOdometer,
        intervalMonths: catalogMatch.intervalMonths ? String(catalogMatch.intervalMonths) : '',
        baseDate: today,
        source: 'workshop_default',
      },
      prefilledFrom: { kind: 'service', name: catalogMatch.name },
    }
  }

  // No catalog entry ties this item type to an interval — fall back to the
  // shop's own km/months pair rather than leaving both fields blank, both
  // axes together.
  return {
    draft: {
      axis: 'both',
      intervalKm: String(shopDefaults.km),
      baseOdometer,
      intervalMonths: String(shopDefaults.months),
      baseDate: today,
      source: 'workshop_default',
    },
    prefilledFrom: { kind: 'shop_default' },
  }
}

/**
 * Whichever axes are selected (one, or both) must have their interval and
 * base filled in together — a rule tracking a distance from nowhere isn't
 * meaningful. Shared by the form's Save guard and its disabled state so they
 * can never disagree about when saving is actually allowed.
 */
export function validateScheduleDraft(draft: ScheduleRuleDraft): { ok: boolean } {
  const axisReady = (a: 'km' | 'months') =>
    a === 'km' ? !!draft.intervalKm && !!draft.baseOdometer : !!draft.intervalMonths && !!draft.baseDate
  const ok = draft.axis === 'both' ? axisReady('km') && axisReady('months') : axisReady(draft.axis)
  return { ok }
}

/**
 * The draft as setScheduleRule (scheduleOps.ts) wants it. Which axis is even
 * eligible to be saved comes from the Track-by picker, not just whether the
 * field is non-empty — switching away from an axis doesn't clear its typed
 * value, so this must still leave it out.
 */
export function scheduleDraftToRuleData(draft: ScheduleRuleDraft): {
  intervalKm: number | null
  baseOdometer: number | null
  intervalMonths: number | null
  baseDate: string | null
  source: 'workshop_default' | 'customer_request'
} {
  const usesKm = draft.axis === 'km' || draft.axis === 'both'
  const usesMonths = draft.axis === 'months' || draft.axis === 'both'
  return {
    intervalKm: usesKm && draft.intervalKm ? parseInt(draft.intervalKm) : null,
    baseOdometer: usesKm && draft.baseOdometer ? parseInt(draft.baseOdometer) : null,
    intervalMonths: usesMonths && draft.intervalMonths ? parseInt(draft.intervalMonths) : null,
    baseDate: usesMonths ? draft.baseDate || null : null,
    source: draft.source,
  }
}

/** What a live rule's summary line shows — pulled out of the row renderer so
 *  the "which axes does this rule actually track" branching (and the
 *  km/date formatting) is testable without a component. Each axis part is
 *  `null` when the rule doesn't track it (or is missing the base it needs),
 *  same as scheduleDraftToRuleData's own per-axis guard. */
export interface ScheduleRuleSummary {
  kmPart: { interval: string; base: string } | null
  monthsPart: { months: number; base: string } | null
  isCustomerRequest: boolean
}

export function scheduleRuleSummary(rule: ScheduleRule): ScheduleRuleSummary {
  return {
    kmPart:
      rule.intervalKm != null && rule.baseOdometer != null
        ? { interval: formatNumber(rule.intervalKm), base: formatNumber(rule.baseOdometer) }
        : null,
    monthsPart:
      rule.intervalMonths != null && rule.baseDate
        ? { months: rule.intervalMonths, base: formatDate(rule.baseDate) }
        : null,
    isCustomerRequest: rule.source === 'customer_request',
  }
}
