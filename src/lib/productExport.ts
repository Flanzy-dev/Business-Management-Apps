// Writing the product catalog back out as CSV — the inverse of
// src/lib/productImport.ts, and pure for the same reason: the caller passes
// its own products and derivations in, so what lands in the file is testable
// without a browser or a download.
//
// The file is deliberately one file for two jobs. The first nine columns are
// exactly what parseProductCsv reads, so export → edit prices in Excel →
// import is a real round trip; the last three are derived numbers that make
// the same sheet usable for a stock take. The importer ignores columns it
// doesn't know, which is what lets both live side by side.
import type { ProductWithStock } from './stockLedger'

export interface ExportDerivations {
  /** Supplier's name, or '' when the product has none — never the raw id. */
  supplierNameOf: (product: ProductWithStock) => string
  /** FIFO blended cost of the stock actually on hand — the Inventory Cost column. */
  unitCostOf: (product: ProductWithStock) => number
}

/**
 * Columns, in file order. The first nine round-trip through
 * parseProductCsv; qtyOnHand/supplier/stockValue are read-only extras.
 * `supplier` does round-trip — see planProductImport's supplier resolution —
 * but by name, not id.
 */
export const EXPORT_COLUMNS = [
  'name', 'sku', 'supplierCode', 'category', 'unit', 'costPrice', 'sellPrice', 'reorderPoint',
  'notes', 'qtyOnHand', 'supplier', 'stockValue',
] as const

/** Excel needs this to read "Pendingin & Minyak Rem" as written; parseCsv strips it. */
const BOM = '﻿'

/** A field needs quoting when it holds the separator, a quote, or a newline. */
function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Rows of raw fields to CSV text. The exact inverse of parseCsv. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeField).join(',')).join('\n') + '\n'
}

/** One product as its row of raw (unescaped) fields. */
function productRow(product: ProductWithStock, derive: ExportDerivations): string[] {
  // Stock value is worth what the stock on hand actually cost, so it uses the
  // FIFO blend rather than Product.costPrice — the same number the Inventory
  // table shows. Negative stock (an oversell) would give a negative value;
  // that's honest, so it isn't clamped.
  const stockValue = Math.round(product.qtyOnHand * derive.unitCostOf(product))
  return [
    product.name,
    product.sku,
    product.supplierCode ?? '',
    product.category,
    product.unit,
    // The *stored* cost price, not the blend above: re-importing this file
    // must not quietly replace a shop's entered cost with a derived number.
    String(product.costPrice),
    String(product.sellPrice),
    String(product.reorderPoint),
    product.notes,
    String(product.qtyOnHand),
    derive.supplierNameOf(product),
    String(stockValue),
  ]
}

/** The whole catalog as CSV text, ready to hand to a Blob. */
export function buildProductCsv(products: ProductWithStock[], derive: ExportDerivations): string {
  const rows = [[...EXPORT_COLUMNS], ...products.map((p) => productRow(p, derive))]
  return BOM + toCsv(rows)
}

/** "product-catalog-2026-08-08.csv" — echoes the file the catalog came from. */
export function productExportFilename(now: Date = new Date()): string {
  return `product-catalog-${now.toISOString().split('T')[0]}.csv`
}
