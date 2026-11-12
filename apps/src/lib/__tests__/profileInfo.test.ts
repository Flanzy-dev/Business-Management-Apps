import { describe, expect, it } from 'vitest'
import { accountSummary, shopContact } from '../app/profileInfo'

const security = { adminUsername: 'bu.sari', workerUsername: 'budi' }

describe('accountSummary', () => {
  it('names the admin account when signed in as admin', () => {
    expect(accountSummary('admin', security)).toEqual({ name: 'bu.sari', role: 'admin' })
  })

  it('names the worker account when signed in as worker', () => {
    expect(accountSummary('worker', security)).toEqual({ name: 'budi', role: 'worker' })
  })

  it('has no name for an account that never had one — older installs', () => {
    expect(accountSummary('admin', { adminUsername: null, workerUsername: null })).toEqual({ name: null, role: 'admin' })
    expect(accountSummary('worker', { adminUsername: 'x', workerUsername: '   ' }).name).toBeNull()
  })

  it('does not show the admin name to a worker', () => {
    expect(accountSummary('worker', { adminUsername: 'bu.sari', workerUsername: null }).name).toBeNull()
  })
})

describe('shopContact', () => {
  it('passes saved details through, trimmed', () => {
    expect(shopContact({ shopName: ' Bengkel Jaya ', shopAddress: 'Jl. Merdeka 5', shopPhone: '0812', shopEmail: 'a@b.id' })).toEqual({
      name: 'Bengkel Jaya',
      address: 'Jl. Merdeka 5',
      phone: '0812',
      email: 'a@b.id',
    })
  })

  it('reports blanks as null, so the page says "not set" instead of showing nothing', () => {
    expect(shopContact({ shopName: '', shopAddress: '  ', shopPhone: '', shopEmail: '' })).toEqual({
      name: null,
      address: null,
      phone: null,
      email: null,
    })
  })
})
