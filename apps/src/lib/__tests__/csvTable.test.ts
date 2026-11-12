// parseCsv and parseIdrAmount keep their own tests in productImport.test.ts
// (where they used to live); this covers what the three importers now share.
import { describe, it, expect } from 'vitest'
import { readCsvTable, sniffDelimiter, normalizeHeader } from '../format/csvTable'

const COLUMNS = ['name', 'sellPrice', 'owner_name'] as const

describe('normalizeHeader', () => {
  it('treats spacing, case, underscores and dashes as the same column', () => {
    expect(['Sell Price', 'sell_price', 'sellPrice', 'SELL-PRICE'].map(normalizeHeader)).toEqual(Array(4).fill('sellprice'))
  })
})

describe('sniffDelimiter', () => {
  it("picks ';' only when the header uses it and no ','", () => {
    expect(sniffDelimiter('﻿a;b;c\n1;2;3')).toBe(';')
    expect(sniffDelimiter('a,b;c\n')).toBe(',')
    expect(sniffDelimiter('a,b,c')).toBe(',')
  })
})

describe('readCsvTable', () => {
  it('lets rows be read by declared column name, however the header was written', () => {
    const table = readCsvTable('Name,Sell Price,Extra\n Oil , 50.000 ,x\n', COLUMNS, { required: 'name' })
    if (!table.ok) throw new Error('expected ok')
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0].line).toBe(2)
    expect(table.rows[0].at('name')).toBe('Oil')
    expect(table.rows[0].at('sellPrice')).toBe('50.000')
    expect(table.rows[0].at('owner_name')).toBe('') // absent column reads as blank
    expect(table.has('owner_name')).toBe(false)
  })

  it('reads a semicolon file when asked to sniff', () => {
    const table = readCsvTable('owner_name;name\nANTO;Oil\n', COLUMNS, { required: 'owner_name', delimiter: 'auto' })
    expect(table.ok && table.rows[0].at('owner_name')).toBe('ANTO')
  })

  it('fails the whole file when it is empty or the required column is missing', () => {
    expect(readCsvTable('', COLUMNS, { required: 'name' })).toEqual({ ok: false, error: { line: 0, message: 'File is empty' } })
    expect(readCsvTable('sku\nX\n', COLUMNS, { required: 'name' })).toEqual({ ok: false, error: { line: 1, message: 'No "name" column found' } })
    expect(readCsvTable('sku\nX\n', COLUMNS, { required: 'name', missingRequired: 'custom' })).toMatchObject({ error: { message: 'custom' } })
  })
})
