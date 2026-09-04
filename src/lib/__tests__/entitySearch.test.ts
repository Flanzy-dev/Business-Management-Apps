import { describe, it, expect } from 'vitest'
import { filterBySearch } from '../entitySearch'

interface Row {
  name: string
  phone: string
}

const rows: Row[] = [
  { name: 'Budi Santoso', phone: '0812-3456-7890' },
  { name: 'siti aminah', phone: '0899-0000-1111' },
]

describe('filterBySearch', () => {
  it('returns every item for a blank query', () => {
    expect(filterBySearch(rows, '', (r) => [r.name, r.phone])).toEqual(rows)
    expect(filterBySearch(rows, '   ', (r) => [r.name, r.phone])).toEqual(rows)
  })

  it('matches case-insensitively on every listed field, not just the first', () => {
    expect(filterBySearch(rows, 'BUDI', (r) => [r.name, r.phone])).toEqual([rows[0]])
    expect(filterBySearch(rows, 'AMINAH', (r) => [r.name, r.phone])).toEqual([rows[1]])
  })

  it('matches phone case-insensitively — the drift the five hand-written filters disagreed on', () => {
    // Phone numbers are digits/dashes so case never actually matters for them,
    // but the field is passed through the same lowercasing as every other
    // field here rather than being special-cased, which is the actual fix:
    // four of the five original filters case-folded name/email but compared
    // phone with a bare `.includes(search)`.
    expect(filterBySearch(rows, '3456', (r) => [r.name, r.phone])).toEqual([rows[0]])
  })

  it('tolerates null/undefined fields without throwing', () => {
    const withGaps: { name: string; email: string | null }[] = [{ name: 'X', email: null }]
    expect(filterBySearch(withGaps, 'x', (r) => [r.name, r.email])).toEqual(withGaps)
    expect(filterBySearch(withGaps, 'nothing', (r) => [r.name, r.email])).toEqual([])
  })

  it('matches if any field matches, not requiring all', () => {
    expect(filterBySearch(rows, 'santoso', (r) => [r.name, r.phone])).toEqual([rows[0]])
  })
})
