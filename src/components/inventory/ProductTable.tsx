import { PackagePlus, Package, History, Scale } from 'lucide-react'
import type { ProductWithStock } from '../../lib/stockLedger'
import { isLowStock } from '../../lib/stockLedger'
import { nextSortState, type SortKey, type SortState } from '../../lib/productFilter'
import { formatCurrency } from '../../lib/currency'
import { productCategoryLabel, unitLabel } from '../../lib/entities'
import { rowEditOnDoubleClick } from '../../lib/rowInteraction'
import { useTranslation } from '../../lib/i18n'
import { EmptyState } from '../ui/EmptyState'
import { Badge } from '../ui/Badge'
import { RowActions } from '../ui/RowActions'
import { SortableTh } from '../ui/SortableTh'

/**
 * The Inventory page's product list — sortable header, stock/price columns
 * gated by the same Worker/Admin rights the page already resolved, and the
 * per-row actions (Adjust Stock, Reconcile when oversold, Price History,
 * Edit/Delete). `sort`/`onSortChange` stay with the caller because they also
 * drive the `filtered` list itself (sortProducts runs before this ever
 * renders) — this component only turns that state into column headers.
 */
export function ProductTable({
  products,
  emptyFiltered,
  sort,
  onSortChange,
  canSeeCost,
  canMutate,
  showSupplierCode,
  unitCostOf,
  getSupplierName,
  onEdit,
  onDelete,
  onAdjust,
  onReconcile,
  onShowHistory,
}: {
  products: ProductWithStock[]
  /** True when the empty state should show "no matches" copy instead of "you have no products yet". */
  emptyFiltered: boolean
  sort: SortState
  onSortChange: (sort: SortState) => void
  canSeeCost: boolean
  canMutate: boolean
  showSupplierCode: boolean
  unitCostOf: (product: ProductWithStock) => number
  getSupplierName: (id: string | null) => string
  onEdit: (product: ProductWithStock) => void
  onDelete: (id: string) => void
  onAdjust: (product: ProductWithStock) => void
  onReconcile: (product: ProductWithStock) => void
  onShowHistory: (product: ProductWithStock) => void
}) {
  const { t } = useTranslation()

  /** Wires a column header to the sort state — see SortableTh. */
  const sortableColumn = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => {
    // Announce what the click will *do*, taken from nextSortState itself so
    // the label can't drift from the behaviour (numeric columns open
    // descending, text columns ascending).
    const upcoming = nextSortState(sort, key)
    return {
      sortKey: key,
      label,
      align,
      active: sort.key === key,
      direction: sort.direction,
      onSort: (k: SortKey) => onSortChange(nextSortState(sort, k)),
      ariaLabel: t(upcoming.direction === 'asc' ? 'inventory.sortAscLabel' : 'inventory.sortDescLabel', { column: label }),
    }
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title={emptyFiltered ? t('inventory.emptyTitleFiltered') : t('inventory.emptyTitleNone')}
        message={emptyFiltered ? t('inventory.emptyMessageFiltered') : t('inventory.emptyMessageNone')}
      />
    )
  }

  return (
    <div className="bg-surface-card rounded-radius-md overflow-auto max-h-[70vh]">
      <table className="w-full">
        <thead className="bg-surface-sunken border-b border-border-subtle sticky top-0 z-10">
          <tr>
            <SortableTh {...sortableColumn('name', t('inventory.colName'))} />
            <SortableTh {...sortableColumn('sku', t('inventory.colSku'))} />
            {showSupplierCode && <SortableTh {...sortableColumn('supplierCode', t('inventory.colSupplierCode'))} />}
            <SortableTh {...sortableColumn('category', t('inventory.colCategory'))} />
            {canSeeCost && <SortableTh {...sortableColumn('cost', t('inventory.colCost'), 'right')} />}
            <SortableTh {...sortableColumn('price', t('inventory.colPrice'), 'right')} />
            <SortableTh {...sortableColumn('stock', t('inventory.colStock'), 'right')} />
            <SortableTh {...sortableColumn('supplier', t('inventory.colSupplier'))} />
            {canMutate && <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colActions')}</th>}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr
              key={p.id}
              {...rowEditOnDoubleClick(canMutate ? () => onEdit(p) : () => {})}
              className={`border-t border-border-subtle hover:bg-surface-sunken ${isLowStock(p) ? 'bg-danger-muted' : ''}`}
            >
              <td className="p-3 font-medium text-text-primary">
                <span className="flex items-center gap-2">
                  {p.name}
                  {/* Nothing stops a Rp 0 product reaching a work order, so
                      say so where the cashier and the price list both look
                      — a price fact, same visibility as the price column. */}
                  {p.sellPrice <= 0 && <Badge tone="warning">{t('inventory.missingPriceBadge')}</Badge>}
                </span>
              </td>
              <td className="p-3 font-mono text-sm text-text-secondary">{p.sku || '-'}</td>
              {showSupplierCode && <td className="p-3 font-mono text-sm text-text-secondary">{p.supplierCode || '-'}</td>}
              <td className="p-3 text-text-secondary">{productCategoryLabel(p.category)}</td>
              {canSeeCost && (
                <td className="p-3 text-right font-mono text-text-secondary tabular-nums">{formatCurrency(Math.round(unitCostOf(p)))}</td>
              )}
              <td className="p-3 text-right font-mono font-medium text-text-primary tabular-nums">{formatCurrency(p.sellPrice)}</td>
              <td className="p-3 whitespace-nowrap">
                {/* grid, not inline text-align:right — the badge column is flexible/left, the
                    qty+unit column is auto-sized and always anchored to the cell's right edge,
                    so the qty number lines up row-to-row whether or not the badge renders. */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <span className="flex justify-end">
                    {p.qtyOnHand < 0 ? (
                      // Negative stock — a real oversell (see stockLedger.ts's
                      // negativeStockProducts), not just "running low", so it
                      // gets its own badge rather than collapsing into "Low".
                      <Badge tone="danger">{t('inventory.negativeStockBadge')}</Badge>
                    ) : (
                      isLowStock(p) && <Badge tone="danger">{t('inventory.lowBadge')}</Badge>
                    )}
                  </span>
                  <span className="flex items-baseline gap-1">
                    <span className={`font-mono tabular-nums ${isLowStock(p) ? 'text-danger font-medium' : 'text-text-primary'}`}>
                      {p.qtyOnHand}
                    </span>
                    <span className="text-text-secondary text-sm">{unitLabel(p.unit)}</span>
                  </span>
                </div>
              </td>
              <td className="p-3 text-sm text-text-secondary">{getSupplierName(p.supplierId)}</td>
              {canMutate && (
                <td className="p-3 text-right">
                  <RowActions
                    leadingItems={[
                      { label: t('inventory.adjustStockAction'), icon: PackagePlus, onClick: () => onAdjust(p) },
                      ...(p.qtyOnHand < 0
                        ? [{ label: t('inventory.reconcileAction'), icon: Scale, onClick: () => onReconcile(p) }]
                        : []),
                      { label: t('inventory.priceHistoryAction'), icon: History, onClick: () => onShowHistory(p) },
                    ]}
                    onEdit={() => onEdit(p)}
                    onDelete={() => onDelete(p.id)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
