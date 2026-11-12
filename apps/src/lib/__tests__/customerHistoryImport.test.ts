import { describe, it, expect } from 'vitest'
import {
  parseCustomerHistoryCsv,
  planCustomerHistoryImport,
  planTotals,
  isEmptyHistoryPlan,
} from '../customers/customerHistoryImport'

const HEADER =
  'source_file,owner_type,owner_name,phone,plate,vehicle,visit_no,visit_date,km,visit_note,section,item,qty,unit,unit_price,line_total,note,raw,needs_review'

function csv(...rows: string[]): string {
  return '﻿' + [HEADER, ...rows].join('\r\n') + '\r\n'
}

// Two visits shaped like a converted file (names, plates and readings are made up).
const FLEET_ROWS = [
  'PT. MAJU JAYA.xlsx,company,PT. MAJU JAYA,,H 4321 AB,,1,2022-11-14,512345,,Mesin,Mobil Delvac 15/40,9,Lt,50000,450000,,"Mobil Delvac 15/40 / 9 Lt @ 50.000",',
  'PT. MAJU JAYA.xlsx,company,PT. MAJU JAYA,,H 4321 AB,,1,2022-11-14,512345,,Gardan,HDA140,3.5,Lt,50000,175000,,"HDA140 / 3.5 Lt @ 50.000",',
  'PT. MAJU JAYA.xlsx,company,PT. MAJU JAYA,,H 4321 AB,,1,2022-11-14,512345,,Filter Solar,FSA,1,,70000,70000,FC-1003,"FSA @ 70.000 (FC-1003)",',
  'PT. MAJU JAYA.xlsx,company,PT. MAJU JAYA,,H 8765 CD,Canter,3,2022-12-17,401234,Ex 2468 EF,Mesin,Mobil Delvac 15/40,9,Lt,50000,450000,,,',
  'PT. MAJU JAYA.xlsx,company,PT. MAJU JAYA,,H 8765 CD,Canter,3,2022-12-17,401234,Ex 2468 EF,Lain-lain,Jasa Transport,1,,100000,100000,,,',
]

type Existing = { ownerNames: string[]; vehicles: { id: string; licensePlate: string }[] }
const NO_EXISTING: Existing = { ownerNames: [], vehicles: [] }

describe('parseCustomerHistoryCsv', () => {
  it('reads the converter output, BOM and all', () => {
    const { rows, errors } = parseCustomerHistoryCsv(csv(...FLEET_ROWS))
    expect(errors).toEqual([])
    expect(rows).toHaveLength(5)
    expect(rows[1]).toMatchObject({
      ownerType: 'company', ownerName: 'PT. MAJU JAYA', plate: 'H 4321 AB', section: 'Gardan',
      item: 'HDA140', qty: 3.5, unit: 'Lt', unitPrice: 50000, lineTotal: 175000, km: 512345,
    })
  })

  it('accepts the ";" and decimal-comma file Excel saves on an Indonesian-locale Windows', () => {
    const text = [
      HEADER.replace(/,/g, ';'),
      'a.xlsx;customer;BUDI;0812;H 1 AB;;1;2023-01-02;1000;;Gardan;HDA140;3,5;Lt;50.000;175.000;;;',
    ].join('\r\n')
    const { rows } = parseCustomerHistoryCsv(text)
    expect(rows[0]).toMatchObject({ ownerName: 'BUDI', qty: 3.5, unitPrice: 50000, lineTotal: 175000 })
  })

  it('refuses a file that is not the converter output', () => {
    const { rows, errors } = parseCustomerHistoryCsv('name,sellPrice\nOil,1000\n')
    expect(rows).toEqual([])
    expect(errors[0].message).toMatch(/owner_name/)
  })
})

describe('planCustomerHistoryImport', () => {
  const plan = (text: string, existing = NO_EXISTING) =>
    planCustomerHistoryImport(parseCustomerHistoryCsv(text).rows, existing)

  it('groups rows into owner → vehicle (by plate) → visit → lines', () => {
    const p = plan(csv(...FLEET_ROWS))
    expect(p.create).toHaveLength(1)
    const [owner] = p.create
    expect(owner).toMatchObject({ ownerType: 'company', name: 'PT. MAJU JAYA', sourceFile: 'PT. MAJU JAYA.xlsx' })
    expect(owner.vehicles.map((v) => v.plate)).toEqual(['H 4321 AB', 'H 8765 CD'])
    const [first, second] = owner.vehicles
    expect(first.visits).toHaveLength(1)
    expect(first.visits[0]).toMatchObject({ date: '2022-11-14', km: 512345, total: 695000, dateEstimated: false })
    expect(second.visits[0].notes).toContain('Ex 2468 EF')
    expect(planTotals(p)).toEqual({ customers: 0, companies: 1, vehicles: 2, orders: 2, revenue: 1245000 })
  })

  it('fills the vehicle card from its log: latest fluids, highest KM, latest type', () => {
    const p = plan(csv(
      'a.xlsx,customer,BUDI,,H 1 AB,Panther,1,2023-01-01,100000,,Mesin,Meditran S-40,7,Lt,38000,266000,,,',
      'a.xlsx,customer,BUDI,,H 1 AB,,2,2023-06-01,105000,,Mesin,Shell R4X 15/40,7,Lt,50000,350000,,,',
      'a.xlsx,customer,BUDI,,H1AB,,3,2023-09-01,110000,,Gardan,HDA140,3.5,Lt,50000,175000,,,',
    ))
    const [vehicle] = p.create[0].vehicles
    expect(p.create[0].vehicles).toHaveLength(1) // "H 1 AB" and "H1AB" are one plate
    expect(vehicle).toMatchObject({
      make: 'Panther', currentMileage: 110000, oilTypeRequired: 'Shell R4X 15/40', differentialFluidType: 'HDA140',
    })
  })

  it('labels gardan/transmisi oils and keeps the quantity, unit and note in the description', () => {
    const p = plan(csv(...FLEET_ROWS))
    const lines = p.create[0].vehicles[0].visits[0].lines
    expect(lines.map((l) => l.description)).toEqual([
      'Mobil Delvac 15/40 — 9 Lt',
      'HDA140 (Gardan) — 3.5 Lt',
      'FSA — FC-1003',
    ])
    expect(lines[0]).toMatchObject({ quantity: 9, unitPrice: 50000, lineTotal: 450000, quantityLiters: 9, kind: 'product' })
    expect(p.create[0].vehicles[1].visits[0].lines[1].kind).toBe('service') // Jasa Transport
  })

  it('takes a line total the shop corrected by hand over qty × price', () => {
    const p = plan(csv('a.xlsx,customer,BUDI,,H 1 AB,,1,2023-01-01,,,Mesin,Oil,4,Bt,112500,450000,,,'))
    expect(p.create[0].vehicles[0].visits[0].lines[0].lineTotal).toBe(450000)
  })

  it('imports an unpriced line at zero and says so, rather than dropping it', () => {
    const p = plan(csv('a.xlsx,customer,BUDI,,H 1 AB,,1,2023-01-01,,,Mesin,Shell HX7,,,,,,Shell HX7,yes'))
    const line = p.create[0].vehicles[0].visits[0].lines[0]
    expect(line).toMatchObject({ unitPrice: 0, lineTotal: 0, quantity: 1 })
    expect(line.description).toContain('harga tidak tercatat')
    expect(p.rowsNeedingReview).toBe(1)
  })

  it('dates a visit with an unreadable date from the visit logged before it', () => {
    const p = plan(csv(
      'a.xlsx,customer,BUDI,,H 1 AB,,1,2024-08-01,,,Mesin,Oil,1,,1000,1000,,,',
      'a.xlsx,customer,BUDI,,H 1 AB,,2,8/8/204,,,Mesin,Oil,1,,1000,1000,,,yes',
    ))
    const visits = p.create[0].vehicles[0].visits
    expect(visits[1]).toMatchObject({ date: '2024-08-01', dateEstimated: true })
    expect(visits[1].notes).toContain('tanggal asli: 8/8/204')
    expect(p.datesEstimated).toBe(1)
  })

  it('keeps two files that read as the same name as two owners', () => {
    // "ANTO 081200001111.xlsx" and "ANTO.xlsx": nothing says they're one person.
    const p = plan(csv(
      'ANTO 081200001111.xlsx,customer,ANTO,081200001111,,,,,,,,,,,,,,,',
      'ANTO.xlsx,customer,ANTO,,H 9 ZZ,,1,2023-01-01,,,Mesin,Oil,1,,1000,1000,,,',
    ))
    expect(p.create.map((o) => [o.name, o.phone, o.vehicles.length])).toEqual([
      ['ANTO', '081200001111', 0],
      ['ANTO', '', 1],
    ])
  })

  it('creates an owner with no visits, and no vehicle for them', () => {
    const p = plan(csv('ANGGA.xlsx,customer,ANGGA,081234567890,,,,,,,,,,,,,,,'))
    expect(p.create).toEqual([
      { ownerType: 'customer', name: 'ANGGA', phone: '081234567890', sourceFile: 'ANGGA.xlsx', vehicles: [] },
    ])
  })

  it('keeps a visit that has nothing priced on it, so the visit itself is on record', () => {
    const p = plan(csv('a.xlsx,customer,BUDI,,H 1 AB,,1,2023-01-01,50000,,,,,,,,,,'))
    expect(p.create[0].vehicles[0].visits[0]).toMatchObject({ km: 50000, lines: [], total: 0 })
  })

  it('is a no-op the second time: owners the shop already has are skipped whole', () => {
    const p = plan(csv(...FLEET_ROWS), { ownerNames: ['pt.  maju jaya'], vehicles: [] })
    expect(p.create).toEqual([])
    expect(p.skippedOwners).toEqual(['PT. MAJU JAYA'])
    expect(isEmptyHistoryPlan(p)).toBe(true)
  })

  it('attaches visits on a plate the app already has to that vehicle, creating no second one', () => {
    const p = plan(csv(...FLEET_ROWS), { ownerNames: [], vehicles: [{ id: 'v-existing', licensePlate: 'h4321ab' }] })
    expect(p.attachedToExisting).toEqual(['H 4321 AB'])
    expect(p.create[0].vehicles.map((v) => [v.plate, v.existingVehicleId])).toEqual([
      ['H 4321 AB', 'v-existing'],
      ['H 8765 CD', null],
    ])
    expect(planTotals(p).vehicles).toBe(1) // only H 8765 CD is new
  })

  it('makes a plate logged under two files one vehicle, owned by the file with its latest visit', () => {
    // BOGA S.xlsx / BOGA SARASA.xlsx in the real logs.
    const p = plan(csv(
      'BOGA S.xlsx,customer,BOGA S,,H 1899 PP,,1,2022-07-12,1000,,Mesin,Oil,1,,1000,1000,,,',
      'BOGA SARASA.xlsx,customer,BOGA SARASA,,h1899pp,Avanza,4,2024-12-26,9000,,Mesin,Oil,1,,2000,2000,,,',
    ))
    expect(p.sharedPlates).toEqual(['H1899PP'])
    const [bogaS, sarasa] = p.create
    expect(bogaS.vehicles).toEqual([]) // still created, as a customer with no vehicle
    expect(sarasa.vehicles).toHaveLength(1)
    expect(sarasa.vehicles[0]).toMatchObject({ plate: 'H1899PP', make: 'Avanza', currentMileage: 9000 })
    expect(sarasa.vehicles[0].visits.map((v) => v.date)).toEqual(['2022-07-12', '2024-12-26'])
  })
})
