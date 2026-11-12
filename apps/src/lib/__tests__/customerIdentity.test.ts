import { describe, expect, it } from 'vitest'
import { findCustomerByPhone, phoneKey } from '../customers/customerIdentity'

describe('phoneKey', () => {
  it('reads every common way of writing one Indonesian mobile number as the same key', () => {
    const forms = ['0812-3456-789', '+62 812 3456 789', '6281234567 89', '0812 3456 789', '(0812) 3456789']
    expect(new Set(forms.map(phoneKey))).toEqual(new Set(['8123456789']))
  })

  it('is empty for a number too short to identify anyone', () => {
    expect(phoneKey('112')).toBe('')
    expect(phoneKey('0812')).toBe('')
    expect(phoneKey('')).toBe('')
    expect(phoneKey(null)).toBe('')
    expect(phoneKey(undefined)).toBe('')
  })

  it('ignores text around the digits', () => {
    expect(phoneKey('WA: 0812 3456 789 (Budi)')).toBe('8123456789')
  })
})

describe('findCustomerByPhone', () => {
  const customers = [
    { id: 'c-1', name: 'Budi', phone: '0812-3456-789' },
    { id: 'c-2', name: 'Sari', phone: '' },
    { id: 'c-3', name: 'Andi', phone: '+62 857 1111 2222' },
  ]

  it('finds the customer however the number was typed', () => {
    expect(findCustomerByPhone(customers, '+6281234567 89')?.id).toBe('c-1')
    expect(findCustomerByPhone(customers, '0857-1111-2222')?.id).toBe('c-3')
  })

  it('returns undefined for a number nobody has', () => {
    expect(findCustomerByPhone(customers, '0899 9999 999')).toBeUndefined()
  })

  it('does not match customers with no phone on file, whatever is typed', () => {
    expect(findCustomerByPhone(customers, '')).toBeUndefined()
    expect(findCustomerByPhone([{ id: 'x', phone: '' }], '')).toBeUndefined()
  })

  it('does not match on a short number', () => {
    expect(findCustomerByPhone([{ id: 'x', phone: '112' }], '112')).toBeUndefined()
  })

  it('lets a customer keep their own number when editing', () => {
    expect(findCustomerByPhone(customers, '0812-3456-789', 'c-1')).toBeUndefined()
    expect(findCustomerByPhone(customers, '0812-3456-789', 'c-3')?.id).toBe('c-1')
  })
})
