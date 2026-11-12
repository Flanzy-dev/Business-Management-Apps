// src/lib/ops/activityOps.ts already takes injected deps (createActivityOps)
// and has a bound default export like every other ops file — it just had no
// tests yet.
import { describe, it, expect } from 'vitest'
import { createActivityOps } from '../ops/activityOps'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'

describe('activityOps', () => {
  it('records an entry with the given action/entityType/label and the ambient mode', () => {
    const world = buildFakeOpsDeps({ mode: 'worker' })
    const { recordEntityChange } = createActivityOps(world.deps)

    recordEntityChange('delete', 'customer', 'c-1', 'Budi Santoso')

    expect(world.activityLog.entries).toEqual([
      expect.objectContaining({
        action: 'delete',
        entityType: 'customer',
        entityId: 'c-1',
        label: 'Budi Santoso',
        mode: 'worker',
      }),
    ])
  })

  it('appends rather than replacing on repeated calls', () => {
    const world = buildFakeOpsDeps()
    const { recordEntityChange } = createActivityOps(world.deps)

    recordEntityChange('create', 'vehicle', 'v-1', '2021 Toyota Avanza')
    recordEntityChange('update', 'vehicle', 'v-1', '2021 Toyota Avanza - B 1234 XYZ')

    expect(world.activityLog.entries).toHaveLength(2)
    expect(world.activityLog.entries.map((e) => e.action)).toEqual(['create', 'update'])
  })
})
