// What a customer reads on a receipt or a WhatsApp reminder: km grouped the
// Indonesian way (never "45,000 km", which reads as 45 km there), and dates in
// the shop's UI language. The language store is the only input, so each test
// sets it and the afterEach puts it back.
import { afterEach, describe, expect, it } from 'vitest'
import { useLanguageStore } from '../../store/languageStore'
import { activeDateLocale } from '../format/locale'
import { formatDistance, formatNumber } from '../format/numbers'
import { formatDate, formatDateCompact, formatDateLong } from '../format/dates'
import { monthLabel } from '../format/dateKeys'

afterEach(() => useLanguageStore.setState({ language: 'en' }))

describe('formatNumber / formatDistance', () => {
  it('groups with a dot, matching "Rp 45.000"', () => {
    expect(formatNumber(45_000)).toBe('45.000')
    expect(formatDistance(45_000)).toBe('45.000 km')
    expect(formatDistance(1_234_567)).toBe('1.234.567 km')
  })

  it('does not change with the UI language', () => {
    useLanguageStore.setState({ language: 'en' })
    const english = formatDistance(55_000)
    useLanguageStore.setState({ language: 'id' })
    expect(formatDistance(55_000)).toBe(english)
  })
})

describe('activeDateLocale', () => {
  it('maps the UI language onto a date locale', () => {
    useLanguageStore.setState({ language: 'en' })
    expect(activeDateLocale()).toBe('en-US')
    useLanguageStore.setState({ language: 'id' })
    expect(activeDateLocale()).toBe('id-ID')
  })
})

describe('date formatters follow the UI language by default', () => {
  it('prints English month names in English', () => {
    useLanguageStore.setState({ language: 'en' })
    expect(formatDateCompact('2026-05-05')).toBe('5 May 26')
    expect(monthLabel('2026-05')).toContain('May')
  })

  it('prints Indonesian month names in Indonesian', () => {
    useLanguageStore.setState({ language: 'id' })
    expect(formatDateCompact('2026-05-05')).toBe('5 Mei 26')
    expect(monthLabel('2026-05')).toContain('Mei')
    expect(formatDate(new Date(2026, 0, 5))).toContain('Jan')
    // 2026-01-05 is a Monday.
    const long = formatDateLong(new Date(2026, 0, 5))
    expect(long).toContain('Senin')
    expect(long).toContain('Januari')
  })

  it('still lets a caller pass a locale explicitly', () => {
    useLanguageStore.setState({ language: 'id' })
    expect(formatDateCompact('2026-05-05', 'en-US')).toBe('5 May 26')
  })
})
