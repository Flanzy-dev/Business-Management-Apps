import { describe, expect, it } from 'vitest'
import { formatOrderNumber, orderReferenceSuffix } from '../orders/orderNumber'

describe('orderReferenceSuffix', () => {
  it('uses the stable tail of a normal entity id', () => {
    expect(orderReferenceSuffix('6fc0c0bf-5537-45c5-9371-a72ae8d67358')).toBe('7358')
  })

  it('gives distinct short ids a fixed-width deterministic suffix', () => {
    expect(orderReferenceSuffix('order-a')).toHaveLength(4)
    expect(orderReferenceSuffix('order-a')).not.toBe(orderReferenceSuffix('order-b'))
  })
})

describe('formatOrderNumber', () => {
  it('preserves labels for historical orders without a device suffix', () => {
    expect(formatOrderNumber(1042)).toBe('SB-1042')
  })

  it('disambiguates orders created independently on different devices', () => {
    expect(formatOrderNumber(1042, 'AB12')).toBe('SB-1042-AB12')
    expect(formatOrderNumber(1042, '7K9P')).toBe('SB-1042-7K9P')
  })
})
