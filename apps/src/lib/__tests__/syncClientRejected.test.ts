import { describe, it, expect } from 'vitest'
import { RejectedOpsError } from '../sync/client'

describe('RejectedOpsError.unknownEntityIndexes', () => {
  it('picks the ops a host refused only because it does not know their store', () => {
    const e = new RejectedOpsError(
      [0, 2, 3],
      ['malformed op', 'entity not allowed: brand-new-store', 'security-store requires a valid admin shop token'],
      ['malformed', 'unknown-entity', 'forbidden']
    )
    expect(e.unknownEntityIndexes).toEqual([2])
  })

  it('recognizes the reason text from a host older than the code field', () => {
    const e = new RejectedOpsError([1, 4], ['entity not allowed: brand-new-store', 'malformed op'])
    expect(e.unknownEntityIndexes).toEqual([1])
  })
})
