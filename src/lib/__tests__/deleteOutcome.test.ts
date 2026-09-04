import { describe, it, expect } from 'vitest'
import { deleteOutcomeToast } from '../deleteOutcome'

describe('deleteOutcomeToast', () => {
  it('returns a warning toast with the blocker reason as description when blocked', () => {
    const toast = deleteOutcomeToast(
      { ok: false, reason: 'Customer has 2 vehicles' },
      { cannotDeleteTitle: 'Cannot delete' }
    )
    expect(toast).toEqual({ tone: 'warning', title: 'Cannot delete', description: 'Customer has 2 vehicles' })
  })

  it('returns a success toast on an actual delete when deletedTitle is configured', () => {
    const toast = deleteOutcomeToast({ ok: true }, { cannotDeleteTitle: 'Cannot delete', deletedTitle: 'Deleted' })
    expect(toast).toEqual({ tone: 'success', title: 'Deleted' })
  })

  it('returns null on a successful delete when no deletedTitle is configured — stays silent', () => {
    const toast = deleteOutcomeToast({ ok: true }, { cannotDeleteTitle: 'Cannot delete' })
    expect(toast).toBeNull()
  })
})
