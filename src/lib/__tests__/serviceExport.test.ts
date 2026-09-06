import { describe, it, expect } from 'vitest'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import { buildServiceCsv, serviceExportFilename, EXPORT_COLUMNS } from '../serviceExport'
import { parseCsv } from '../productImport'
import { parseServiceCsv, planServiceImport } from '../serviceImport'

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

const tagNameOf = (id: string) => (id === 'it-oil' ? 'Oli Mesin' : id === 'it-trans' ? 'Oli Transmisi' : '')

/** Header + rows of the generated file, BOM already consumed by parseCsv. */
const tableOf = (services: ServiceCatalogItem[]) => parseCsv(buildServiceCsv(services, tagNameOf))

describe('buildServiceCsv', () => {
  it('starts with a BOM so Excel reads the encoding right', () => {
    expect(buildServiceCsv([service()], tagNameOf).startsWith('﻿')).toBe(true)
  })

  it('writes the header in the documented order', () => {
    expect(tableOf([service()])[0]).toEqual([...EXPORT_COLUMNS])
  })

  it('writes the schedule tag by name, blank when the service has none', () => {
    const rows = tableOf([
      service({ serviceItemTypeId: 'it-oil' }),
      service({ serviceItemTypeId: null }),
    ])
    expect(rows[1][2]).toBe('Oli Mesin')
    expect(rows[2][2]).toBe('')
  })

  it('writes intervals blank rather than 0 when unset', () => {
    const row = tableOf([service({ intervalKm: null, intervalMonths: null })])[1]
    expect(row[3]).toBe('')
    expect(row[4]).toBe('')
  })

  it('writes both interval axes when both are set', () => {
    const row = tableOf([service({ intervalKm: 40_000, intervalMonths: 24 })])[1]
    expect(row[3]).toBe('40000')
    expect(row[4]).toBe('24')
  })

  it('handles an empty catalog as a header-only file', () => {
    expect(tableOf([])).toEqual([[...EXPORT_COLUMNS]])
  })
})

describe('export -> import round trip', () => {
  const catalog = [
    service({ name: 'Ganti Oli Mesin', price: 50_000, serviceItemTypeId: 'it-oil', intervalKm: 5000, intervalMonths: 4 }),
    service({ name: 'Ganti Minyak Rem', price: 0, serviceItemTypeId: null, intervalKm: null, intervalMonths: 24, notes: 'catatan' }),
    // The awkward real row: a comma in the name.
    service({ name: 'Grease service (heavy-duty, cargo vehicles)', price: 0, serviceItemTypeId: null }),
  ]

  it('reads back every field exactly', () => {
    const { rows, errors } = parseServiceCsv(buildServiceCsv(catalog, tagNameOf))
    expect(errors).toEqual([])
    expect(rows.map((r) => ({ name: r.name, price: r.price, intervalKm: r.intervalKm, intervalMonths: r.intervalMonths, notes: r.notes }))).toEqual(
      catalog.map((s) => ({ name: s.name, price: s.price, intervalKm: s.intervalKm ?? null, intervalMonths: s.intervalMonths ?? null, notes: s.notes }))
    )
    expect(rows[0].scheduleTag).toBe('Oli Mesin')
    expect(rows[1].scheduleTag).toBe('')
  })

  it('is a no-op when imported back over the same catalog', () => {
    const { rows } = parseServiceCsv(buildServiceCsv(catalog, tagNameOf))
    const plan = planServiceImport(rows, catalog, [{ id: 'it-oil', name: 'Oli Mesin' }])
    expect(plan.create).toEqual([])
    expect(plan.updatePrice).toEqual([])
    expect(plan.unchanged).toBe(3)
    expect(plan.newItemTypes).toEqual([])
  })

  it('picks up exactly the prices that were edited', () => {
    const csv = buildServiceCsv(catalog, tagNameOf).replace('50000', '65000')
    const { rows } = parseServiceCsv(csv)
    const plan = planServiceImport(rows, catalog, [{ id: 'it-oil', name: 'Oli Mesin' }])
    expect(plan.updatePrice).toEqual([{ service: catalog[0], from: 50_000, to: 65_000 }])
    expect(plan.unchanged).toBe(2)
  })
})

describe('serviceExportFilename', () => {
  it('stamps the date', () => {
    expect(serviceExportFilename(new Date('2026-09-06T10:00:00Z'))).toBe('service-catalog-2026-09-06.csv')
  })
})
