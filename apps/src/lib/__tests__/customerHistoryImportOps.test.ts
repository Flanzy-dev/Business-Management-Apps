// The store-touching half of the Excel-history import. customerHistoryImport
// .test.ts proves how the CSV becomes a plan; this proves what applying it
// writes — and, as importantly, what it must not: no stock movement, no lot,
// no schedule rule, nothing an order completed through orderOps would trigger.
import { describe, it, expect } from 'vitest'
import { createCustomerHistoryImportOps, visitDateToIso } from '../ops/customerHistoryImportOps'
import { parseCustomerHistoryCsv, planCustomerHistoryImport } from '../customers/customerHistoryImport'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'

const HEADER =
  'source_file,owner_type,owner_name,phone,plate,vehicle,visit_no,visit_date,km,visit_note,section,item,qty,unit,unit_price,line_total,note,raw,needs_review'

function planFrom(...rows: string[]) {
  const { rows: parsed } = parseCustomerHistoryCsv([HEADER, ...rows].join('\n'))
  return planCustomerHistoryImport(parsed, { ownerNames: [], vehicles: [] })
}

const PLAN_ROWS = [
  'b.xlsx,customer,BUDI 2,0812,H 2 BB,,1,2023-05-01,2000,,Mesin,Oil B,1,Gln,400000,400000,,,',
  'a.xlsx,company,PT. ABC,,H 1 AA,Fuso,1,2023-01-01,1000,,Mesin,Oil A,9,Lt,50000,450000,,,',
  'a.xlsx,company,PT. ABC,,H 1 AA,Fuso,1,2023-01-01,1000,,Filter Oli,Filter Oli,1,,115000,115000,,,',
  'a.xlsx,company,PT. ABC,,H 3 CC,,2,2022-12-01,500,,Mesin,Oil A,9,Lt,50000,450000,,,',
  'c.xlsx,customer,ANGGA,,,,,,,,,,,,,,,,',
]

describe('applyCustomerHistoryImport', () => {
  it('creates customers and companies, each with an activity entry', () => {
    const world = buildFakeOpsDeps()
    const outcome = createCustomerHistoryImportOps(world.deps).applyCustomerHistoryImport(planFrom(...PLAN_ROWS))

    expect(outcome).toEqual({ customers: 2, companies: 1, vehicles: 3, orders: 3 })
    expect(world.customers.customers.map((c) => [c.name, c.phone, c.notes])).toEqual([
      ['BUDI 2', '0812', 'Diimpor dari b.xlsx'],
      ['ANGGA', '', 'Diimpor dari c.xlsx'],
    ])
    expect(world.companies.companies.map((c) => [c.companyName, c.drivers])).toEqual([['PT. ABC', []]])
    expect(world.activityLog.entries.map((e) => [e.action, e.entityType, e.label])).toEqual([
      ['create', 'customer', 'BUDI 2'],
      ['create', 'customer', 'ANGGA'],
      ['create', 'company', 'PT. ABC'],
    ])
  })

  it('links each vehicle to its owner, with exactly one default per owner', () => {
    const world = buildFakeOpsDeps()
    createCustomerHistoryImportOps(world.deps).applyCustomerHistoryImport(planFrom(...PLAN_ROWS))

    const company = world.companies.companies[0]
    const fleet = world.vehicles.vehicles.filter((v) => v.companyId === company.id)
    expect(fleet.map((v) => [v.licensePlate, v.customerId, v.isDefault])).toEqual([
      ['H 1 AA', null, true],
      ['H 3 CC', null, false],
    ])
    expect(fleet[0]).toMatchObject({ make: 'Fuso', currentMileage: 1000, oilTypeRequired: 'Oil A' })
  })

  it('books every visit as a completed cash order, dated on the visit, numbered oldest first', () => {
    const world = buildFakeOpsDeps()
    createCustomerHistoryImportOps(world.deps).applyCustomerHistoryImport(planFrom(...PLAN_ROWS))

    const orders = world.workOrders.workOrders
    expect(orders.map((o) => [o.orderNumber, o.date, o.total])).toEqual([
      [1001, visitDateToIso('2022-12-01'), 450000],
      [1002, visitDateToIso('2023-01-01'), 565000],
      [1003, visitDateToIso('2023-05-01'), 400000],
    ])
    for (const o of orders) {
      expect(o).toMatchObject({ status: 'completed', paymentMethod: 'cash', taxAmount: 0, discountAmount: 0 })
      expect(o.completedAt).toBe(o.date)
      expect(o.subtotal).toBe(o.total)
    }
  })

  it('touches no stock, no lots and no service schedule', () => {
    const world = buildFakeOpsDeps()
    createCustomerHistoryImportOps(world.deps).applyCustomerHistoryImport(planFrom(...PLAN_ROWS))

    const lines = world.workOrders.workOrders.flatMap((o) => o.items)
    expect(lines.every((l) => l.productId == null)).toBe(true)
    expect(world.movements.movements).toEqual([])
    expect(world.stockLots.stockLots).toEqual([])
    expect(world.scheduleRules.scheduleRules).toEqual([])
  })

  it('pins the visit date to local midday, so no timezone can move it to another day', () => {
    const iso = visitDateToIso('2023-01-31')
    const local = new Date(iso)
    expect([local.getFullYear(), local.getMonth() + 1, local.getDate(), local.getHours()]).toEqual([2023, 1, 31, 12])
  })
})
