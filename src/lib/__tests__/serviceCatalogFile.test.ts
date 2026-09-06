// Runs the real importer over the real shipped catalog — data/service-catalog.csv,
// the file a shop actually picks in Settings → Import Services. Every other
// test here feeds the parser a fixture it wrote itself, which proves the
// rules but not that this file still satisfies them. A hand-edit to the CSV
// would sail past those and only surface as a half-imported catalog in
// front of the user.
//
// Requires data/service-catalog.csv to be committed; it's read relative to
// the repo root, which is vitest's working directory.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import { parseServiceCsv, planServiceImport, isEmptyServicePlan, type PlannedService } from '../serviceImport'

const csv = readFileSync(resolve(process.cwd(), 'data/service-catalog.csv'), 'utf8')
const { rows, errors } = parseServiceCsv(csv)

// The 7 built-in item types this shop already ships with (serviceItemTypeStore.ts).
const SEEDED_ITEM_TYPES = [
  { id: 'it-oli-mesin', name: 'Oli Mesin' },
  { id: 'it-filter-oli', name: 'Filter Oli' },
  { id: 'it-oli-transmisi', name: 'Oli Transmisi' },
  { id: 'it-oli-gardan', name: 'Oli Gardan' },
  { id: 'it-filter-solar', name: 'Filter Solar' },
  { id: 'it-minyak-rem', name: 'Minyak Rem' },
  { id: 'it-minyak-power-steering', name: 'Minyak Power Steering' },
]

/** A planned row as the service it would become, for the re-import check —
 *  a brand-new tag resolves to a made-up id here (never null), matching
 *  what applyServiceImport actually does: create the tag, then use its id. */
function asService(row: PlannedService, i: number): ServiceCatalogItem {
  return {
    id: `s-${i}`,
    name: row.name,
    price: row.price,
    serviceItemTypeId: row.serviceItemTypeId ?? `new-tag-${row.scheduleTag.trim().toLowerCase()}`,
    intervalKm: row.intervalKm,
    intervalMonths: row.intervalMonths,
    notes: row.notes,
    createdAt: '2026-09-06T00:00:00.000Z',
  }
}

describe('data/service-catalog.csv', () => {
  it('parses with no errors', () => {
    expect(errors).toEqual([])
    expect(rows).toHaveLength(14)
  })

  it('imports whole — every row becomes a service', () => {
    const plan = planServiceImport(rows, [], SEEDED_ITEM_TYPES)
    expect(plan.errors).toEqual([])
    expect(plan.duplicatesInFile).toEqual([])
    expect(plan.create).toHaveLength(14)
  })

  it('resolves every existing-tag row against the shop\'s seeded item types, by name', () => {
    const plan = planServiceImport(rows, [], SEEDED_ITEM_TYPES)
    const byName = new Map(plan.create.map((r) => [r.name, r]))
    expect(byName.get('Oil change labor')?.serviceItemTypeId).toBe('it-oli-mesin')
    expect(byName.get('Power steering fluid change')?.serviceItemTypeId).toBe('it-minyak-power-steering')
  })

  it('names exactly three new schedule tags: Tune Up, Purging, Grease', () => {
    const plan = planServiceImport(rows, [], SEEDED_ITEM_TYPES)
    expect(plan.newItemTypes).toEqual(['Tune Up', 'Purging', 'Grease'])
  })

  it('leaves alignment/balancing, car wash and general labor untagged', () => {
    const plan = planServiceImport(rows, [], SEEDED_ITEM_TYPES)
    const byName = new Map(plan.create.map((r) => [r.name, r]))
    expect(byName.get('Alignment & balancing')?.serviceItemTypeId).toBeNull()
    expect(byName.get('Car wash')?.serviceItemTypeId).toBeNull()
    expect(byName.get('General labor')?.serviceItemTypeId).toBeNull()
  })

  it('"General labor" is its own service — a distinct row from Car wash, not a note on it', () => {
    const byName = new Map(rows.map((r) => [r.name, r]))
    expect(byName.get('Car wash')?.notes).toBe('')
    expect(byName.get('General labor')).toMatchObject({ price: 0, scheduleTag: '', intervalKm: null, intervalMonths: null, notes: '' })
  })

  it('flags manual vs. automatic transmission oil as an intentional multi-candidate tag', () => {
    // Both target the shop's existing "Oli Transmisi" tag with different
    // intervals — deliberate (see NewVehicleScheduleFields.tsx's own manual
    // vs. matic example), but still worth surfacing in the import preview.
    const plan = planServiceImport(rows, [], SEEDED_ITEM_TYPES)
    const transmission = plan.multipleCandidateTags.find((c) => c.tagName === 'Oli Transmisi')
    expect(transmission?.serviceNames).toEqual(['Manual transmission oil change', 'Automatic transmission oil change'])
  })

  it('is a no-op when imported a second time', () => {
    const first = planServiceImport(rows, [], SEEDED_ITEM_TYPES)
    const secondItemTypes = [
      ...SEEDED_ITEM_TYPES,
      ...first.newItemTypes.map((name) => ({ id: `new-tag-${name.toLowerCase()}`, name })),
    ]
    const second = planServiceImport(rows, first.create.map(asService), secondItemTypes)
    expect(second.create).toEqual([])
    expect(second.unchanged).toBe(14)
    expect(isEmptyServicePlan(second)).toBe(true)
  })
})
