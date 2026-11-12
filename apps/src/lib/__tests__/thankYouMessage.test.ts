import { describe, expect, it } from 'vitest'
import { buildThankYouMessage, formatNextDue } from '../orders/thankYouMessage'
import { signWithShop, whatsAppUrl } from '../schedule/reminders'
import { formatDate } from '../format/dates'
import type { ReceiptDueLine } from '../orders/receiptDueLines'

const row = (what: string, dueKm: number | null, dueDate: string | null, overdue = false): ReceiptDueLine => ({ what, dueKm, dueDate, overdue })

describe('formatNextDue', () => {
  it('is null when nothing is scheduled', () => {
    expect(formatNextDue([])).toBeNull()
  })

  it('writes the km and the date of a row, joined with a slash', () => {
    expect(formatNextDue([row('Oli Mesin', 55_000, '2027-03-12')])).toBe(`Oli Mesin 55.000 km / ${formatDate('2027-03-12')}`)
  })

  it('writes a km-only or date-only row without a stray separator', () => {
    expect(formatNextDue([row('Oli Mesin', 55_000, null)])).toBe('Oli Mesin 55.000 km')
    expect(formatNextDue([row('Minyak Rem', null, '2027-03-12')])).toBe(`Minyak Rem ${formatDate('2027-03-12')}`)
  })

  it('names a row with no marks by itself', () => {
    expect(formatNextDue([row('Oli Mesin', null, null)])).toBe('Oli Mesin')
  })

  it('keeps only the soonest few rows — it is a chat message, not a receipt', () => {
    const rows = [row('A', 1_000, null), row('B', 2_000, null), row('C', 3_000, null), row('D', 4_000, null)]
    expect(formatNextDue(rows)).toBe('A 1.000 km, B 2.000 km, C 3.000 km')
    expect(formatNextDue(rows, 1)).toBe('A 1.000 km')
  })
})

describe('buildThankYouMessage', () => {
  // A stand-in for translate(): echoes the key and the variables so the test
  // pins WHICH template is used and WHAT goes into it.
  const t = (key: string, vars: Record<string, string | number> = {}) => `${key}|${JSON.stringify(vars)}`
  const details = { owner: 'Budi', vehicle: 'B 1234 XYZ', shop: 'Bengkel Jaya' }

  it('tells the customer when to come back, if anything is scheduled', () => {
    const message = buildThankYouMessage(t, { ...details, nextDue: 'Oli Mesin 55.000 km' })
    expect(message).toContain('thankYouMessageWithNext')
    expect(message).toContain('"next":"Oli Mesin 55.000 km"')
  })

  it('still says thanks when nothing is scheduled', () => {
    const message = buildThankYouMessage(t, { ...details, nextDue: null })
    expect(message).toContain('reminders.thankYouMessage|')
    expect(message).not.toContain('next')
  })
})

describe('whatsAppUrl', () => {
  it('opens a chat on the normalised number with the text encoded', () => {
    expect(whatsAppUrl('0812-3456-789', 'Halo & terima kasih')).toBe('https://wa.me/628123456789?text=Halo%20%26%20terima%20kasih')
  })
})

describe('signWithShop', () => {
  const sign = (shop: string) => `— ${shop}`

  it('adds the shop on its own line', () => {
    expect(signWithShop('Halo Budi', 'Bengkel Jaya', sign)).toBe('Halo Budi\n— Bengkel Jaya')
  })

  it('leaves the message alone when the shop never set a name', () => {
    expect(signWithShop('Halo Budi', '', sign)).toBe('Halo Budi')
    expect(signWithShop('Halo Budi', '   ', sign)).toBe('Halo Budi')
    expect(signWithShop('Halo Budi', null, sign)).toBe('Halo Budi')
  })

  it('trims the name', () => {
    expect(signWithShop('Halo', '  Bengkel Jaya ', sign)).toBe('Halo\n— Bengkel Jaya')
  })
})
