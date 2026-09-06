// The store-touching half of the services CSV import. serviceImport.test.ts
// proves how a CSV becomes a ServiceImportPlan; this proves what applying
// that plan does to the catalog — new schedule tags are created BEFORE the
// services that reference them, and a price update is opt-in.
import { describe, it, expect } from 'vitest'
import { createServiceCatalogOps } from '../ops/serviceCatalogOps'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'
import type { ServiceImportPlan, PlannedService } from '../serviceImport'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'

function service(overrides: Partial<ServiceCatalogItem> = {}): ServiceCatalogItem {
  return {
    id: 's-1',
    name: 'Ganti Oli Mesin',
    price: 50_000,
    serviceItemTypeId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function plannedService(overrides: Partial<PlannedService> = {}): PlannedService {
  return {
    line: 2,
    name: 'Oil filter replacement',
    price: 0,
    scheduleTag: '',
    intervalKm: null,
    intervalMonths: null,
    notes: '',
    serviceItemTypeId: null,
    ...overrides,
  }
}

function plan(overrides: Partial<ServiceImportPlan> = {}): ServiceImportPlan {
  return {
    create: [],
    updatePrice: [],
    unchanged: 0,
    newItemTypes: [],
    duplicatesInFile: [],
    multipleCandidateTags: [],
    errors: [],
    ...overrides,
  }
}

describe('applyServiceImport — creating services', () => {
  it('creates every planned service and reports the count', () => {
    const world = buildFakeOpsDeps()
    const outcome = createServiceCatalogOps(world.deps).applyServiceImport(
      plan({ create: [plannedService({ name: 'A' }), plannedService({ name: 'B' })] }),
      { updatePrices: false }
    )

    expect(outcome.created).toBe(2)
    expect(world.serviceCatalog.services.map((s) => s.name)).toEqual(['A', 'B'])
  })

  it('carries every planned field onto the created service', () => {
    const world = buildFakeOpsDeps()
    createServiceCatalogOps(world.deps).applyServiceImport(
      plan({ create: [plannedService({ price: 20_000, intervalKm: 15_000, intervalMonths: 6, notes: 'x' })] }),
      { updatePrices: false }
    )

    expect(world.serviceCatalog.services[0]).toMatchObject({
      name: 'Oil filter replacement',
      price: 20_000,
      intervalKm: 15_000,
      intervalMonths: 6,
      notes: 'x',
    })
  })

  it('links a create row to an already-resolved tag id straight through', () => {
    const world = buildFakeOpsDeps({ serviceItemTypes: [{ id: 'it-oil', name: 'Oli Mesin' }] })
    createServiceCatalogOps(world.deps).applyServiceImport(
      plan({ create: [plannedService({ serviceItemTypeId: 'it-oil' })] }),
      { updatePrices: false }
    )

    expect(world.serviceCatalog.services[0].serviceItemTypeId).toBe('it-oil')
  })
})

describe('applyServiceImport — schedule tags', () => {
  it('creates the tags the file names but the shop lacks', () => {
    const world = buildFakeOpsDeps({ serviceItemTypes: [{ id: 'it-oil', name: 'Oli Mesin' }] })
    const outcome = createServiceCatalogOps(world.deps).applyServiceImport(
      plan({ newItemTypes: ['Tune Up', 'Grease'] }),
      { updatePrices: false }
    )

    expect(outcome.itemTypesCreated).toBe(2)
    expect(world.serviceItemTypes.serviceItemTypes.map((t) => t.name)).toEqual(['Oli Mesin', 'Tune Up', 'Grease'])
  })

  it('creates tags before the services filed under them, and resolves the link by name', () => {
    // The create row has no id yet (planServiceImport left it null pending
    // creation) — only its typed scheduleTag name. This is the one thing
    // applyServiceImport must get right that a straight field copy wouldn't.
    const world = buildFakeOpsDeps()
    createServiceCatalogOps(world.deps).applyServiceImport(
      plan({
        newItemTypes: ['Tune Up'],
        create: [plannedService({ name: 'Tune up', scheduleTag: 'Tune Up', serviceItemTypeId: null, intervalKm: 20_000 })],
      }),
      { updatePrices: false }
    )

    const tagId = world.serviceItemTypes.serviceItemTypes.find((t) => t.name === 'Tune Up')!.id
    expect(tagId).toBeTruthy()
    expect(world.serviceCatalog.services[0].serviceItemTypeId).toBe(tagId)
  })

  it('resolves the new-tag link case-insensitively against the typed name', () => {
    const world = buildFakeOpsDeps()
    createServiceCatalogOps(world.deps).applyServiceImport(
      plan({
        newItemTypes: ['Grease'],
        create: [plannedService({ name: 'Grease service', scheduleTag: '  grease  ', serviceItemTypeId: null })],
      }),
      { updatePrices: false }
    )

    const tagId = world.serviceItemTypes.serviceItemTypes.find((t) => t.name === 'Grease')!.id
    expect(world.serviceCatalog.services[0].serviceItemTypeId).toBe(tagId)
  })

  it('leaves a genuinely untagged create row at null, not linked to anything', () => {
    const world = buildFakeOpsDeps()
    createServiceCatalogOps(world.deps).applyServiceImport(
      plan({ create: [plannedService({ scheduleTag: '', serviceItemTypeId: null })] }),
      { updatePrices: false }
    )

    expect(world.serviceCatalog.services[0].serviceItemTypeId).toBeNull()
  })
})

describe('applyServiceImport — price updates are opt-in', () => {
  it('rewrites prices when updatePrices is true', () => {
    const existing = service({ id: 's-1', price: 50_000 })
    const world = buildFakeOpsDeps({ services: [existing] })
    const outcome = createServiceCatalogOps(world.deps).applyServiceImport(
      plan({ updatePrice: [{ service: existing, from: 50_000, to: 65_000 }] }),
      { updatePrices: true }
    )

    expect(outcome.pricesUpdated).toBe(1)
    expect(world.serviceCatalog.services[0].price).toBe(65_000)
  })

  it('leaves prices alone when updatePrices is false', () => {
    const existing = service({ id: 's-1', price: 50_000 })
    const world = buildFakeOpsDeps({ services: [existing] })
    const outcome = createServiceCatalogOps(world.deps).applyServiceImport(
      plan({ updatePrice: [{ service: existing, from: 50_000, to: 65_000 }] }),
      { updatePrices: false }
    )

    expect(outcome.pricesUpdated).toBe(0)
    expect(world.serviceCatalog.services[0].price).toBe(50_000)
  })

  it('never touches tag, interval or notes on a price-updated row', () => {
    const existing = service({ id: 's-1', price: 50_000, serviceItemTypeId: 'it-oil', intervalKm: 5000, notes: 'kept' })
    const world = buildFakeOpsDeps({ services: [existing] })
    createServiceCatalogOps(world.deps).applyServiceImport(
      plan({ updatePrice: [{ service: existing, from: 50_000, to: 65_000 }] }),
      { updatePrices: true }
    )

    expect(world.serviceCatalog.services[0]).toMatchObject({ serviceItemTypeId: 'it-oil', intervalKm: 5000, notes: 'kept' })
  })
})

describe('applyServiceImport — an empty plan', () => {
  it('changes nothing and reports all zeros', () => {
    const world = buildFakeOpsDeps({ services: [service()] })
    const outcome = createServiceCatalogOps(world.deps).applyServiceImport(plan(), { updatePrices: true })

    expect(outcome).toEqual({ created: 0, pricesUpdated: 0, itemTypesCreated: 0 })
    expect(world.serviceCatalog.services).toHaveLength(1)
  })
})
