import { describe, it, expect } from 'vitest'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import { parseServiceCsv, planServiceImport, isEmptyServicePlan } from '../serviceImport'

let nextId = 1

function service(overrides: Partial<ServiceCatalogItem> = {}): ServiceCatalogItem {
  return {
    id: `s-${nextId++}`,
    name: 'Ganti Oli Mesin',
    price: 0,
    serviceItemTypeId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const HEADER = 'name,price,scheduleTag,intervalKm,intervalMonths,notes\n'

describe('parseServiceCsv', () => {
  it('maps columns by header name, whatever their order or spelling', () => {
    const { rows } = parseServiceCsv('Schedule Tag,Name,Interval_KM\nOli Mesin,Oil change labor,5000')
    expect(rows[0]).toMatchObject({ name: 'Oil change labor', scheduleTag: 'Oli Mesin', intervalKm: 5000 })
  })

  it('accepts a two-column name-only sheet', () => {
    const { rows, errors } = parseServiceCsv('name\nCar wash')
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ name: 'Car wash', price: 0, scheduleTag: '', intervalKm: null, intervalMonths: null })
  })

  it('ignores columns it does not know', () => {
    const { rows } = parseServiceCsv('name,duration,price\nOil change labor,30min,50000')
    expect(rows[0]).toMatchObject({ name: 'Oil change labor', price: 50_000 })
  })

  it('refuses a file with no name column', () => {
    const { rows, errors } = parseServiceCsv('service,price\nOil change,50000')
    expect(rows).toEqual([])
    expect(errors[0].message).toContain('name')
  })

  it('skips a nameless row and reports its line number', () => {
    const { rows, errors } = parseServiceCsv(`${HEADER},0,,,, \nCar wash,0,,,,`)
    expect(rows).toHaveLength(1)
    expect(errors).toEqual([{ line: 2, message: 'Row has no service name' }])
  })

  it('leaves an unpriced row at zero rather than dropping it', () => {
    const { rows } = parseServiceCsv(`${HEADER}Alignment & balancing,,,,,`)
    expect(rows[0]).toMatchObject({ name: 'Alignment & balancing', price: 0 })
  })

  it('treats a blank interval as null, not zero', () => {
    const { rows } = parseServiceCsv(`${HEADER}Car wash,0,,,,`)
    expect(rows[0].intervalKm).toBeNull()
    expect(rows[0].intervalMonths).toBeNull()
  })

  it('parses both interval axes when both are given', () => {
    const { rows } = parseServiceCsv(`${HEADER}Oil change labor,0,Oli Mesin,5000,4,`)
    expect(rows[0]).toMatchObject({ intervalKm: 5000, intervalMonths: 4 })
  })
})

describe('planServiceImport', () => {
  const rowsOf = (csv: string) => parseServiceCsv(HEADER + csv).rows

  it('creates everything against an empty catalog', () => {
    const rows = rowsOf('Oil change labor,0,Oli Mesin,5000,4,\nCar wash,0,,,,')
    const plan = planServiceImport(rows, [])
    expect(plan.create).toHaveLength(2)
    expect(plan.unchanged).toBe(0)
    expect(plan.updatePrice).toEqual([])
  })

  it('is a no-op when re-run against what it created', () => {
    const rows = rowsOf('Ganti Oli Mesin,50000,,,,')
    const plan = planServiceImport(rows, [service({ name: 'Ganti Oli Mesin', price: 50_000 })])
    expect(plan.create).toEqual([])
    expect(plan.unchanged).toBe(1)
    expect(isEmptyServicePlan(plan)).toBe(true)
  })

  it('matches an existing service case- and whitespace-insensitively', () => {
    const rows = rowsOf('  ganti oli mesin  ,60000,,,,')
    const existing = service({ name: 'Ganti Oli Mesin', price: 50_000 })
    const plan = planServiceImport(rows, [existing])
    expect(plan.create).toEqual([])
    expect(plan.updatePrice).toEqual([{ service: existing, from: 50_000, to: 60_000 }])
  })

  it('never wipes a real price with a blank/zero one', () => {
    const rows = rowsOf('Ganti Oli Mesin,,,,,')
    const plan = planServiceImport(rows, [service({ name: 'Ganti Oli Mesin', price: 50_000 })])
    expect(plan.updatePrice).toEqual([])
    expect(plan.unchanged).toBe(1)
  })

  it('never re-tags, re-schedules or renames an existing match — price only', () => {
    const existing = service({ name: 'Ganti Oli Mesin', price: 50_000, serviceItemTypeId: 'it-oil', intervalKm: 5000 })
    const rows = rowsOf('Ganti Oli Mesin,60000,Filter Oli,99999,99,changed via csv')
    const plan = planServiceImport(rows, [existing])
    expect(plan.updatePrice).toEqual([{ service: existing, from: 50_000, to: 60_000 }])
    // The plan carries no instruction to touch tag/interval/notes at all —
    // applyServiceImport's updateService call only ever sets `price`.
  })

  it('keeps the first of two rows claiming the same name', () => {
    const rows = rowsOf('Car wash,20000,,,,\nCar wash,,,,,')
    const plan = planServiceImport(rows, [])
    expect(plan.create).toHaveLength(1)
    expect(plan.create[0].price).toBe(20_000)
    expect(plan.duplicatesInFile).toHaveLength(1)
  })

  describe('schedule tag resolution', () => {
    it('resolves an existing tag by name to its id', () => {
      const rows = rowsOf('Oil change labor,0,Oli Mesin,5000,4,')
      const plan = planServiceImport(rows, [], [{ id: 'it-oil', name: 'Oli Mesin' }])
      expect(plan.create[0].serviceItemTypeId).toBe('it-oil')
      expect(plan.newItemTypes).toEqual([])
    })

    it('matches an existing tag ignoring case and surrounding space', () => {
      const rows = rowsOf('Oil change labor,0,  oli mesin  ,5000,4,')
      const plan = planServiceImport(rows, [], [{ id: 'it-oil', name: 'Oli Mesin' }])
      expect(plan.create[0].serviceItemTypeId).toBe('it-oil')
    })

    it('lists a brand-new tag once, leaving the row unresolved (no id yet)', () => {
      const rows = rowsOf('Tune up,0,Tune Up,20000,,\nPurging,0,Tune Up,20000,,')
      const plan = planServiceImport(rows, [], [])
      expect(plan.newItemTypes).toEqual(['Tune Up'])
      expect(plan.create.map((r) => r.serviceItemTypeId)).toEqual([null, null])
      expect(plan.create.map((r) => r.scheduleTag)).toEqual(['Tune Up', 'Tune Up'])
    })

    it('a blank schedule tag resolves to no tag at all, not a new one', () => {
      const rows = rowsOf('Car wash,0,,,,')
      const plan = planServiceImport(rows, [])
      expect(plan.create[0].serviceItemTypeId).toBeNull()
      expect(plan.newItemTypes).toEqual([])
    })

    it('does not count a tag as new just because an existing service uses it', () => {
      const rows = rowsOf('Oil change labor,0,Oli Mesin,5000,4,')
      const plan = planServiceImport(rows, [], [{ id: 'it-oil', name: 'oli mesin' }])
      expect(plan.newItemTypes).toEqual([])
    })
  })

  describe('multipleCandidateTags — the auto-fill ambiguity FYI', () => {
    it('flags a tag that would end up with two interval-carrying services', () => {
      const existing = service({ name: 'Ganti Oli Transmisi', serviceItemTypeId: 'it-trans', intervalKm: 40000 })
      const rows = rowsOf('Manual transmission oil change,0,Oli Transmisi,15000,12,')
      const plan = planServiceImport(rows, [existing], [{ id: 'it-trans', name: 'Oli Transmisi' }])
      expect(plan.multipleCandidateTags).toEqual([
        { tagName: 'Oli Transmisi', serviceNames: ['Ganti Oli Transmisi', 'Manual transmission oil change'] },
      ])
    })

    it('flags two new rows sharing a brand-new tag', () => {
      const rows = rowsOf('Manual transmission oil change,0,Oli Transmisi Baru,15000,12,\nAutomatic transmission oil change,0,Oli Transmisi Baru,25000,12,')
      const plan = planServiceImport(rows, [])
      expect(plan.multipleCandidateTags).toEqual([
        { tagName: 'Oli Transmisi Baru', serviceNames: ['Manual transmission oil change', 'Automatic transmission oil change'] },
      ])
    })

    it('does not flag a tag with only one interval-carrying candidate', () => {
      const rows = rowsOf('Oil change labor,0,Oli Mesin,5000,4,')
      const plan = planServiceImport(rows, [])
      expect(plan.multipleCandidateTags).toEqual([])
    })

    it('does not flag services with no interval at all, even sharing a tag', () => {
      const existing = service({ name: 'A', serviceItemTypeId: 'it-x' })
      const rows = rowsOf('B,0,X,,,')
      const plan = planServiceImport(rows, [existing], [{ id: 'it-x', name: 'X' }])
      expect(plan.multipleCandidateTags).toEqual([])
    })
  })
})
