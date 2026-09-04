// AppointmentDialog's form state and submit-time validation, pulled out of
// the component body — same shape as vehicleForm.ts/expenseForm.ts: a
// string-typed Draft, an initializer, and a validate-then-convert step.
import type { Appointment } from '../store/appointmentStore'

export interface AppointmentDraft {
  isWalkIn: boolean
  ownerType: 'customer' | 'company'
  ownerId: string
  vehicleId: string
  date: string
  time: string
  duration: string
  serviceType: string
  notes: string
}

/** Resets every field on each dialog open — including flipping the walk-in
 *  default to match which button opened it. `date` defaults to today, local. */
export function initialAppointmentDraft(walkIn: boolean, now: Date = new Date()): AppointmentDraft {
  return {
    isWalkIn: walkIn,
    ownerType: 'customer',
    ownerId: '',
    vehicleId: '',
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    time: '09:00',
    duration: '30',
    serviceType: '',
    notes: '',
  }
}

export type AppointmentDraftError = 'vehicleRequired' | 'invalidDate'

/**
 * A walk-in is stamped "now" — the date/time fields don't even show for one.
 * A scheduled appointment parses `date`+`time` (defaulting a blank time to
 * opening, 09:00) and fails closed on an unparseable combination rather than
 * silently booking "Invalid Date".
 */
export function validateAppointmentDraft(
  draft: AppointmentDraft,
  now: () => Date = () => new Date()
): { ok: true; scheduledAt: string } | { ok: false; error: AppointmentDraftError } {
  if (!draft.vehicleId) return { ok: false, error: 'vehicleRequired' }
  if (draft.isWalkIn) return { ok: true, scheduledAt: now().toISOString() }
  const parsed = new Date(`${draft.date}T${draft.time || '09:00'}`)
  if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'invalidDate' }
  return { ok: true, scheduledAt: parsed.toISOString() }
}

export function appointmentDraftToData(
  draft: AppointmentDraft,
  scheduledAt: string
): Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    vehicleId: draft.vehicleId,
    customerId: draft.ownerType === 'customer' ? draft.ownerId || null : null,
    companyId: draft.ownerType === 'company' ? draft.ownerId || null : null,
    scheduledAt,
    duration: parseInt(draft.duration, 10) || 30,
    serviceType: draft.serviceType.trim() || null,
    isWalkIn: draft.isWalkIn,
    status: draft.isWalkIn ? 'arrived' : 'scheduled',
    notes: draft.notes.trim() || null,
  }
}
