// signUpFieldErrors builds on password.ts's newPasswordFieldErrors rather
// than restating its three base rules — these tests focus on the two rules
// this module adds (adminPasswordRequired, nameTaken) and on the precedence
// order, not on re-proving the base rules password.test.ts already covers.
import { describe, it, expect } from 'vitest'
import {
  requiresAdminAuthorization,
  signUpFieldErrors,
  SIGN_UP_FIELD_ORDER,
  type SignUpInput,
  type SignUpKnownAccounts,
} from '../auth/signUpValidation'

const validInput: SignUpInput = {
  role: 'worker',
  username: 'budi',
  password: 'secret1',
  confirmPassword: 'secret1',
  adminPassword: '',
}

const noExistingAdmin: SignUpKnownAccounts = {
  adminUsername: null,
  adminPasswordHash: null,
  workerUsername: null,
}

const existingShop: SignUpKnownAccounts = {
  adminUsername: 'owner',
  adminPasswordHash: 'pbkdf2$sha256$210000$salt$hash',
  workerUsername: 'budi',
}

describe('requiresAdminAuthorization', () => {
  it('is false for a shop with no admin account yet', () => {
    expect(requiresAdminAuthorization(null)).toBe(false)
  })

  it('is true once an admin password exists', () => {
    expect(requiresAdminAuthorization('pbkdf2$sha256$210000$salt$hash')).toBe(true)
  })
})

describe('signUpFieldErrors', () => {
  it('reports nothing for a valid worker sign-up on a fresh shop (no admin to authorize against)', () => {
    expect(signUpFieldErrors(validInput, noExistingAdmin)).toEqual({})
  })

  it('requires the admin password only when the shop already has an admin account', () => {
    expect(signUpFieldErrors({ ...validInput, username: 'newworker', adminPassword: '' }, existingShop)).toMatchObject({
      adminPassword: 'adminPasswordRequired',
    })
    expect(
      signUpFieldErrors({ ...validInput, username: 'newworker', adminPassword: 'correct-horse' }, existingShop)
    ).not.toHaveProperty('adminPassword')
  })

  it('delegates the three base rules to newPasswordFieldErrors', () => {
    expect(signUpFieldErrors({ ...validInput, username: '' }, noExistingAdmin)).toMatchObject({
      username: 'usernameRequired',
    })
    expect(signUpFieldErrors({ ...validInput, password: 'ab' }, noExistingAdmin)).toMatchObject({
      password: 'tooShort',
    })
    expect(signUpFieldErrors({ ...validInput, confirmPassword: 'different' }, noExistingAdmin)).toMatchObject({
      confirmPassword: 'mismatch',
    })
  })

  it('flags nameTaken when a worker sign-up collides with the admin username', () => {
    expect(
      signUpFieldErrors({ ...validInput, role: 'worker', username: 'owner', adminPassword: 'x' }, existingShop)
    ).toMatchObject({ username: 'nameTaken' })
  })

  it('flags nameTaken when an admin sign-up collides with the worker username', () => {
    expect(
      signUpFieldErrors(
        { ...validInput, role: 'admin', username: 'budi', adminPassword: 'x' },
        existingShop
      )
    ).toMatchObject({ username: 'nameTaken' })
  })

  it('does not flag nameTaken against the account being replaced (an admin keeping their own name)', () => {
    expect(
      signUpFieldErrors(
        { ...validInput, role: 'admin', username: 'owner', adminPassword: 'x' },
        existingShop
      )
    ).not.toHaveProperty('username')
  })

  it('lets usernameRequired win over nameTaken — an empty name is never "taken"', () => {
    expect(signUpFieldErrors({ ...validInput, username: '', adminPassword: 'x' }, existingShop)).toMatchObject({
      username: 'usernameRequired',
    })
  })

  it('reports every failing field at once, not just the first', () => {
    const errors = signUpFieldErrors(
      { role: 'worker', username: '', password: 'ab', confirmPassword: 'xy', adminPassword: '' },
      existingShop
    )
    expect(errors).toEqual({
      adminPassword: 'adminPasswordRequired',
      username: 'usernameRequired',
      password: 'tooShort',
      confirmPassword: 'mismatch',
    })
  })

  it('SIGN_UP_FIELD_ORDER covers every field signUpFieldErrors can report on', () => {
    const errors = signUpFieldErrors(
      { role: 'worker', username: '', password: 'ab', confirmPassword: 'xy', adminPassword: '' },
      existingShop
    )
    for (const field of Object.keys(errors)) {
      expect(SIGN_UP_FIELD_ORDER).toContain(field)
    }
  })
})
