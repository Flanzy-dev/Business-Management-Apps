import type { ProductWithStock } from '../../lib/stockLedger'
import type { ProductValueEntry } from '../../lib/finance'
import { productInventoryValue } from '../../lib/finance'
import { formatCurrency } from '../../lib/currency'
import { productCategoryLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { DonutBreakdown } from './DonutBreakdown'
import { RankedBarChart } from './RankedBarChart'

export interface InventoryReportData {
  lowStock: ProductWithStock[]
  inventoryValue: number
  topProductsByValue: ProductValueEntry[]
  inventoryByCategory: { label: string; value: number }[]
}

/** Reports.tsx's Inventory tab: totals, the low-stock callout, category
 *  breakdown + top-products chart, and every product ranked by value. */
export function InventoryReportTab({
  data,
  products,
  valueByProductId,
}: {
  data: InventoryReportData
  products: ProductWithStock[]
  valueByProductId: Map<string, number>
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-radius-md p-4">
          <p className="text-caption">{t('reports.totalProducts')}</p>
          <p className="text-3xl font-bold text-text-primary tabular-nums">{products.length}</p>
        </div>
        <div className="bg-surface-card rounded-radius-md p-4">
          <p className="text-caption">{t('reports.inventoryValueCost')}</p>
          <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(data.inventoryValue)}</p>
        </div>
        <div className={`bg-surface-card rounded-radius-md p-4 ${data.lowStock.length > 0 ? 'border-l-4 border-warning' : ''}`}>
          <p className="text-caption">{t('reports.lowStockItems')}</p>
          <p className={`text-3xl font-bold tabular-nums ${data.lowStock.length > 0 ? 'text-warning' : 'text-text-primary'}`}>{data.lowStock.length}</p>
        </div>
      </div>

      {data.lowStock.length > 0 && (
        <div className="bg-warning/10 rounded-radius-md p-6 border border-warning/30">
          <h2 className="text-card-title text-warning mb-4">{t('reports.lowStockItems')}</h2>
          <div className="space-y-2">
            {data.lowStock.map((p) => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-surface-card rounded-radius-sm">
                <div>
                  <span className="font-medium text-text-primary">{p.name}</span>
                  <span className="ml-2 text-text-secondary text-sm">{productCategoryLabel(p.category)}</span>
                </div>
                <div className="text-right">
                  <span className="text-warning font-bold tabular-nums">{p.qtyOnHand}</span>
                  <span className="text-text-secondary text-sm ml-1">
                    / {p.reorderPoint} {p.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.inventoryByCategoryHeading')}</h2>
            <DonutBreakdown data={data.inventoryByCategory} valueFormatter={formatCurrency} />
          </div>
          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.topProductsChartHeading')}</h2>
            <RankedBarChart data={data.topProductsByValue.map((p) => ({ label: p.name, value: p.value }))} valueFormatter={formatCurrency} />
          </div>
        </div>
      )}

      <div className="bg-surface-card rounded-radius-md p-6">
        <h2 className="text-card-title text-text-primary mb-4">{t('reports.allProductsByValueHeading')}</h2>
        {products.length === 0 ? (
          <p className="text-text-secondary text-center py-4">{t('reports.noProductsYet')}</p>
        ) : (
          <div className="space-y-2">
            {[...products]
              .sort((a, b) => productInventoryValue(b, valueByProductId) - productInventoryValue(a, valueByProductId))
              .slice(0, 10)
              .map((p) => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                  <div>
                    <span className="font-medium text-text-primary">{p.name}</span>
                    <span className="ml-2 text-text-secondary text-sm">
                      {p.qtyOnHand} {p.unit}
                    </span>
                  </div>
                  <span className="font-medium text-text-primary tabular-nums">{formatCurrency(productInventoryValue(p, valueByProductId))}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
