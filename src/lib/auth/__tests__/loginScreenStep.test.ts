import { describe, it, expect } from 'vitest'
import { loginScreenTitleKey } from '../loginScreenStep'

describe('loginScreenTitleKey', () => {
  it('picks the create title for the create step', () => {
    expect(loginScreenTitleKey('create')).toBe('auth.lockScreen.createTitle')
  })

  it('picks the sign-up title for the signUp step', () => {
    expect(loginScreenTitleKey('signUp')).toBe('auth.lockScreen.signUpTitle')
  })

  it('picks the forgot-password title for the forgot step', () => {
    expect(loginScreenTitleKey('forgot')).toBe('auth.lockScreen.forgotTitle')
  })

  it('falls back to the plain title for signIn', () => {
    expect(loginScreenTitleKey('signIn')).toBe('auth.lockScreen.title')
  })

  it('falls back to the plain title for restore too — it is reached from sign-in, not its own destination', () => {
    expect(loginScreenTitleKey('restore')).toBe('auth.lockScreen.title')
  })
})
