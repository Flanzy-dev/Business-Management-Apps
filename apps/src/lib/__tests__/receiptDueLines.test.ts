import { describe, expect, it } from 'vitest'
import { describeDueLines } from '../orders/receiptDueLines'
import type { DueLine } from '../schedule/scheduleEngine'

const name = (id: string) => ({ oil: 'Oli Mesin', filter: 'Filter Oli', gardan: 'Oli Gardan', brake: 'Minyak Rem' })[id] ?? id
const NOW = new Date(2026, 9, 25) // 25 Oct 2026, local
const line = (overrides: Partial<DueLine> & { itemTypeIds: string[] }): DueLine => ({ dueKm: null, dueDate: null, ...overrides })

describe('describeDueLines', () => {
  it('carries the name, the km mark and the date mark through', () => {
    const [row] = describeDueLines([line({ itemTypeIds: ['oil'], dueKm: 55_000, dueDate: '2027-03-12' })], 50_000, NOW, name)
    expect(row).toEqual({ what: 'Oli Mesin', dueKm: 55_000, dueDate: '2027-03-12', overdue: false })
  })

  it('gives each item type its own row when two share a mark, so every row stays one line', () => {
    const rows = describeDueLines([line({ itemTypeIds: ['oil', 'filter'], dueKm: 55_000, dueDate: '2027-03-12' })], 50_000, NOW, name)
    expect(rows.map((r) => r.what)).toEqual(['Oli Mesin', 'Filter Oli'])
    expect(rows.every((r) => r.dueKm === 55_000 && r.dueDate === '2027-03-12')).toBe(true)
  })

  it('leaves the axis a rule does not track empty', () => {
    const rows = describeDueLines(
      [line({ itemTypeIds: ['oil'], dueKm: 55_000 }), line({ itemTypeIds: ['brake'], dueDate: '2027-06-01' })],
      50_000,
      NOW,
      name
    )
    expect(rows.find((r) => r.what === 'Oli Mesin')).toMatchObject({ dueKm: 55_000, dueDate: null })
    expect(rows.find((r) => r.what === 'Minyak Rem')).toMatchObject({ dueKm: null, dueDate: '2027-06-01' })
  })

  it('flags a row past its km mark as overdue, including exactly at the mark', () => {
    const rows = describeDueLines([line({ itemTypeIds: ['oil'], dueKm: 50_000 }), line({ itemTypeIds: ['gardan'], dueKm: 49_000 })], 50_000, NOW, name)
    expect(rows.every((r) => r.overdue)).toBe(true)
  })

  it('flags a row past its date mark as overdue even when its km is still ahead', () => {
    const [row] = describeDueLines([line({ itemTypeIds: ['oil'], dueKm: 80_000, dueDate: '2026-10-01' })], 50_000, NOW, name)
    expect(row.overdue).toBe(true)
  })

  it('does not flag a row that is ahead on every axis', () => {
    const [row] = describeDueLines([line({ itemTypeIds: ['oil'], dueKm: 55_000, dueDate: '2027-03-12' })], 50_000, NOW, name)
    expect(row.overdue).toBe(false)
  })

  it('lists overdue rows first, then the nearest date, then the lowest km', () => {
    const rows = describeDueLines(
      [
        line({ itemTypeIds: ['brake'], dueDate: '2027-09-01' }),
        line({ itemTypeIds: ['filter'], dueKm: 60_000 }),
        line({ itemTypeIds: ['gardan'], dueKm: 40_000 }), // overdue by km
        line({ itemTypeIds: ['oil'], dueDate: '2027-01-15' }),
      ],
      50_000,
      NOW,
      name
    )
    expect(rows.map((r) => r.what)).toEqual(['Oli Gardan', 'Oli Mesin', 'Minyak Rem', 'Filter Oli'])
  })

  it('returns nothing when there are no marks', () => {
    expect(describeDueLines([], 50_000, NOW, name)).toEqual([])
  })
})
