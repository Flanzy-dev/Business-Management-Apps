// Writing the services catalog back out as CSV — the inverse of
// src/lib/serviceImport.ts, and the Services counterpart to
// src/lib/productExport.ts. Pure for the same reason: the caller passes its
// own services and item types in, so what lands in the file is testable
// without a browser or a download.
//
// Six columns, all of which round-trip through parseServiceCsv — unlike
// products, there's no read-only "extra" column here (no stock, no FIFO
// cost) to append.
import type { ServiceCatalogItem } from '../store/serviceCatalogStore'
import { toCsv } from './productExport'

export const EXPORT_COLUMNS = ['name', 'price', 'scheduleTag', 'intervalKm', 'intervalMonths', 'notes'] as const

/** Excel needs this to read a name with non-ASCII characters as written;
 *  parseCsv strips it. */
const BOM = '﻿'

/** One service as its row of raw (unescaped) fields. */
function serviceRow(service: ServiceCatalogItem, tagNameOf: (id: string) => string): string[] {
  return [
    service.name,
    String(service.price),
    service.serviceItemTypeId ? tagNameOf(service.serviceItemTypeId) : '',
    service.intervalKm ? String(service.intervalKm) : '',
    service.intervalMonths ? String(service.intervalMonths) : '',
    service.notes,
  ]
}

/** The whole catalog as CSV text, ready to hand to a Blob. `tagNameOf`
 *  resolves a serviceItemTypeId to the name parseServiceCsv reads back —
 *  the file round-trips by name, not id, same as products' category
 *  column. */
export function buildServiceCsv(services: ServiceCatalogItem[], tagNameOf: (id: string) => string): string {
  const rows = [[...EXPORT_COLUMNS], ...services.map((s) => serviceRow(s, tagNameOf))]
  return BOM + toCsv(rows)
}

/** "service-catalog-2026-09-06.csv" — echoes the file the catalog came from. */
export function serviceExportFilename(now: Date = new Date()): string {
  return `service-catalog-${now.toISOString().split('T')[0]}.csv`
}
