import { describe, it, expect } from 'vitest'
import { parseNewEntityRequest, workOrderReturnPath, parseNewOrderParams } from '../returnTrip'

describe('parseNewEntityRequest', () => {
  it('is closed when the param is absent', () => {
    const params = new URLSearchParams('')
    expect(parseNewEntityRequest(params)).toEqual({ open: false, shouldReturn: false })
  })

  it('opens on the default "new" param and reads the default "fromOrder" return flag', () => {
    const params = new URLSearchParams('new=1&fromOrder=1')
    expect(parseNewEntityRequest(params)).toEqual({ open: true, shouldReturn: true })
  })

  it('opens without returning when the return flag is absent', () => {
    const params = new URLSearchParams('new=1')
    expect(parseNewEntityRequest(params)).toEqual({ open: true, shouldReturn: false })
  })

  it('supports a custom param name — Companies\' driver sub-flow uses "newDriver"', () => {
    const params = new URLSearchParams('newDriver=1&fromOrder=1')
    expect(parseNewEntityRequest(params, { param: 'newDriver' })).toEqual({ open: true, shouldReturn: true })
  })

  it('supports a custom return flag — Suppliers\' round trip back to Expenses uses "fromExpense"', () => {
    const params = new URLSearchParams('new=1&fromExpense=1')
    expect(parseNewEntityRequest(params, { returnFlag: 'fromExpense' })).toEqual({ open: true, shouldReturn: true })
  })

  it('does not confuse a same-named different flag with the configured one', () => {
    const params = new URLSearchParams('new=1&fromExpense=1')
    // Default returnFlag is 'fromOrder' — 'fromExpense' being set must not count.
    expect(parseNewEntityRequest(params)).toEqual({ open: true, shouldReturn: false })
  })
})

describe('workOrderReturnPath', () => {
  it('builds the base round-trip target with no extras', () => {
    expect(workOrderReturnPath('customer', 'c-1')).toBe('/work-orders?new=1&ownerType=customer&ownerId=c-1')
  })

  it('appends extra params — Vehicles\' vehicleId', () => {
    expect(workOrderReturnPath('customer', 'c-1', { vehicleId: 'v-1' })).toBe(
      '/work-orders?new=1&ownerType=customer&ownerId=c-1&vehicleId=v-1'
    )
  })

  it('appends extra params — Companies\' driverId', () => {
    expect(workOrderReturnPath('company', 'co-1', { driverId: 'd-1' })).toBe(
      '/work-orders?new=1&ownerType=company&ownerId=co-1&driverId=d-1'
    )
  })
})

describe('parseNewOrderParams', () => {
  it('is closed when "new" is absent', () => {
    expect(parseNewOrderParams(new URLSearchParams(''))).toEqual({ open: false })
  })

  it('reads back exactly what workOrderReturnPath wrote, for either owner type', () => {
    const params = new URLSearchParams(workOrderReturnPath('customer', 'c-1', { vehicleId: 'v-1' }).split('?')[1])
    expect(parseNewOrderParams(params)).toEqual({
      open: true,
      ownerType: 'customer',
      ownerId: 'c-1',
      vehicleId: 'v-1',
      driverId: undefined,
      autoAddOverdue: false,
    })
  })

  it('opens with no owner/vehicle/driver fields when only "new" is present', () => {
    expect(parseNewOrderParams(new URLSearchParams('new=1'))).toEqual({
      open: true,
      ownerType: undefined,
      ownerId: undefined,
      vehicleId: undefined,
      driverId: undefined,
      autoAddOverdue: false,
    })
  })

  it('drops an unrecognized ownerType rather than passing it through', () => {
    const params = new URLSearchParams('new=1&ownerType=bogus&ownerId=x')
    expect(parseNewOrderParams(params).ownerType).toBeUndefined()
  })

  it('carries a driverId — Companies\' driver sub-flow round trip', () => {
    const params = new URLSearchParams('new=1&ownerType=company&ownerId=co-1&driverId=d-1')
    expect(parseNewOrderParams(params)).toEqual({
      open: true,
      ownerType: 'company',
      ownerId: 'co-1',
      vehicleId: undefined,
      driverId: 'd-1',
      autoAddOverdue: false,
    })
  })

  it('reads back autoAddOverdue — Reminders\' "Start Work Order" on an Overdue row', () => {
    const params = new URLSearchParams(
      workOrderReturnPath('customer', 'c-1', { vehicleId: 'v-1', autoAddOverdue: '1' }).split('?')[1]
    )
    expect(parseNewOrderParams(params).autoAddOverdue).toBe(true)
  })

  it('defaults autoAddOverdue to false when absent — every other round trip (Companies/Vehicles/Customers)', () => {
    const params = new URLSearchParams(workOrderReturnPath('customer', 'c-1').split('?')[1])
    expect(parseNewOrderParams(params).autoAddOverdue).toBe(false)
  })
})
