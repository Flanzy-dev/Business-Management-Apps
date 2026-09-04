// The Shop Information card's draft mapping, now that it lives outside the
// component (see src/lib/settingsForm.ts's header for why). The cases worth
// having are the ones the old triplicated-by-hand version could silently
// drift on: the three "predates this field" fallbacks, and a blank/unparsable
// number falling back to the shop default rather than 0/NaN.
import { describe, it, expect } from 'vitest'
import { initialSettingsDraft, settingsDraftToData } from '../settingsForm'
import type { Settings } from '../../store/settingsStore'

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    shopName: 'Bengkel Jaya',
    shopAddress: 'Jl. Merdeka 1',
    shopPhone: '0812',
    shopEmail: 'shop@example.com',
    taxRate: 8.25,
    receiptFooter: 'Thanks!',
    defaultServiceIntervalKm: 5000,
    defaultServiceIntervalMonths: 4,
    receiptPaperWidth: '80mm',
    receiptAutoPrint: true,
    defaultPaymentTermDays: 14,
    ...overrides,
  }
}

describe('initialSettingsDraft', () => {
  it('mirrors every field as its <Input>-facing text/value', () => {
    const draft = initialSettingsDraft(settings())
    expect(draft).toEqual({
      shopName: 'Bengkel Jaya',
      shopAddress: 'Jl. Merdeka 1',
      shopPhone: '0812',
      shopEmail: 'shop@example.com',
      taxRate: '8.25',
      serviceInterval: '5000',
      serviceIntervalMonths: '4',
      paymentTermDays: '14',
      receiptFooter: 'Thanks!',
      receiptPaperWidth: '80mm',
      receiptAutoPrint: true,
    })
  })

  it('falls back to the shop-wide defaults for fields that predate this settings object', () => {
    const draft = initialSettingsDraft(
      settings({
        defaultServiceIntervalKm: undefined as unknown as number,
        defaultServiceIntervalMonths: undefined as unknown as number,
        defaultPaymentTermDays: undefined as unknown as number,
        receiptPaperWidth: undefined as unknown as Settings['receiptPaperWidth'],
        receiptAutoPrint: undefined as unknown as boolean,
      })
    )
    expect(draft.serviceInterval).toBe('5000')
    expect(draft.serviceIntervalMonths).toBe('4')
    expect(draft.paymentTermDays).toBe('14')
    expect(draft.receiptPaperWidth).toBe('80mm')
    expect(draft.receiptAutoPrint).toBe(true)
  })
})

describe('settingsDraftToData', () => {
  it('parses numeric-text fields back to numbers', () => {
    const data = settingsDraftToData(initialSettingsDraft(settings()))
    expect(data.taxRate).toBe(8.25)
    expect(data.defaultServiceIntervalKm).toBe(5000)
    expect(data.defaultServiceIntervalMonths).toBe(4)
    expect(data.defaultPaymentTermDays).toBe(14)
  })

  it('falls back to the shop default for a blank or unparsable number, never 0/NaN', () => {
    const draft = initialSettingsDraft(settings())
    const data = settingsDraftToData({
      ...draft,
      taxRate: '',
      serviceInterval: 'not a number',
      serviceIntervalMonths: '',
      paymentTermDays: '',
    })
    expect(data.taxRate).toBe(0) // taxRate's own guard is `|| 0`, not a default constant
    expect(data.defaultServiceIntervalKm).toBe(5000)
    expect(data.defaultServiceIntervalMonths).toBe(4)
    expect(data.defaultPaymentTermDays).toBe(14)
  })

  it('round-trips a real edit unchanged', () => {
    const draft = initialSettingsDraft(settings())
    const data = settingsDraftToData({ ...draft, shopName: 'New Name', receiptAutoPrint: false })
    expect(data.shopName).toBe('New Name')
    expect(data.receiptAutoPrint).toBe(false)
  })
})
