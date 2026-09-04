import { describe, it, expect } from 'vitest'
import { initialAppointmentDraft, validateAppointmentDraft, appointmentDraftToData, type AppointmentDraft } from '../appointmentForm'

function draft(overrides: Partial<AppointmentDraft> = {}): AppointmentDraft {
  return {
    isWalkIn: false,
    ownerType: 'customer',
    ownerId: 'c-1',
    vehicleId: 'v-1',
    date: '2026-01-15',
    time: '10:30',
    duration: '30',
    serviceType: '',
    notes: '',
    ...overrides,
  }
}

describe('initialAppointmentDraft', () => {
  it('defaults the date field to today, local', () => {
    const now = new Date(2026, 0, 5) // Jan 5, 2026
    expect(initialAppointmentDraft(false, now).date).toBe('2026-01-05')
  })

  it('carries the walk-in flag from the button that opened it', () => {
    expect(initialAppointmentDraft(true).isWalkIn).toBe(true)
    expect(initialAppointmentDraft(false).isWalkIn).toBe(false)
  })

  it('resets owner/vehicle/time/duration to blank defaults', () => {
    const d = initialAppointmentDraft(false)
    expect(d.ownerType).toBe('customer')
    expect(d.ownerId).toBe('')
    expect(d.vehicleId).toBe('')
    expect(d.time).toBe('09:00')
    expect(d.duration).toBe('30')
  })
})

describe('validateAppointmentDraft', () => {
  it('rejects a blank vehicle', () => {
    expect(validateAppointmentDraft(draft({ vehicleId: '' }))).toEqual({ ok: false, error: 'vehicleRequired' })
  })

  it('stamps a walk-in with "now", ignoring date/time fields', () => {
    const now = () => new Date('2026-03-01T12:00:00.000Z')
    expect(validateAppointmentDraft(draft({ isWalkIn: true, date: '', time: '' }), now)).toEqual({
      ok: true,
      scheduledAt: '2026-03-01T12:00:00.000Z',
    })
  })

  it('parses date+time for a scheduled appointment', () => {
    const result = validateAppointmentDraft(draft({ date: '2026-01-15', time: '10:30' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(new Date(result.scheduledAt).getHours()).toBe(10)
  })

  it('defaults a blank time to opening (09:00)', () => {
    const result = validateAppointmentDraft(draft({ time: '' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(new Date(result.scheduledAt).getHours()).toBe(9)
  })

  it('fails closed on an unparseable date', () => {
    expect(validateAppointmentDraft(draft({ date: 'not-a-date' }))).toEqual({ ok: false, error: 'invalidDate' })
  })
})

describe('appointmentDraftToData', () => {
  it('maps a customer-owned appointment', () => {
    const data = appointmentDraftToData(draft({ ownerType: 'customer', ownerId: 'c-1' }), '2026-01-15T10:30:00.000Z')
    expect(data.customerId).toBe('c-1')
    expect(data.companyId).toBeNull()
  })

  it('maps a company-owned appointment', () => {
    const data = appointmentDraftToData(draft({ ownerType: 'company', ownerId: 'co-1' }), '2026-01-15T10:30:00.000Z')
    expect(data.customerId).toBeNull()
    expect(data.companyId).toBe('co-1')
  })

  it('a walk-in starts life already "arrived"; a scheduled one starts "scheduled"', () => {
    expect(appointmentDraftToData(draft({ isWalkIn: true }), 'x').status).toBe('arrived')
    expect(appointmentDraftToData(draft({ isWalkIn: false }), 'x').status).toBe('scheduled')
  })

  it('falls back to a 30-minute duration when the field is unparseable', () => {
    expect(appointmentDraftToData(draft({ duration: 'abc' }), 'x').duration).toBe(30)
  })

  it('trims serviceType/notes to null when blank', () => {
    const data = appointmentDraftToData(draft({ serviceType: '  ', notes: '  ' }), 'x')
    expect(data.serviceType).toBeNull()
    expect(data.notes).toBeNull()
  })
})
