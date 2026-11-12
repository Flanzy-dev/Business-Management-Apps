import { describe, expect, it } from 'vitest'
import { openIdFromState, openRecordState } from '../app/navigation'

describe('openIdFromState', () => {
  it('reads back what openRecordState wrote', () => {
    expect(openIdFromState(openRecordState('wo-1'))).toBe('wo-1')
  })

  it('returns null for missing or malformed state', () => {
    expect(openIdFromState(null)).toBeNull()
    expect(openIdFromState(undefined)).toBeNull()
    expect(openIdFromState('wo-1')).toBeNull()
    expect(openIdFromState({})).toBeNull()
    expect(openIdFromState({ openId: '' })).toBeNull()
    expect(openIdFromState({ openId: 42 })).toBeNull()
  })
})
