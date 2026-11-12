import type { ProductWithStock } from '../../lib/inventory/stockLedger'
import type { WorkOrderItem } from '../../store/workOrderStore'
import { remainingStock } from '../../lib/orders/orderLifecycle'
import { onTicketCountFor } from '../../lib/orders/checkoutCatalogFilter'
import { useTranslation } from '../../lib/i18n'
import { ProductRow } from './ProductRow'

/** The catalog pane's product groups: the best sellers pinned on top (only
 *  under "All" with nothing typed), then the rest A–Z. A section label only
 *  shows up under "All", where services share the pane and the groups need
 *  telling apart. */
export function ProductList({
  products,
  frequent,
  items,
  showSectionLabel,
  onAdd,
  onRestock,
}: {
  products: ProductWithStock[]
  /** Best sellers, pinned above `products`; empty or omitted for no group. */
  frequent?: ProductWithStock[]
  items: WorkOrderItem[]
  showSectionLabel: boolean
  onAdd: (product: ProductWithStock) => void
  onRestock: (product: ProductWithStock) => void
}) {
  const { t } = useTranslation()

  const group = (rows: ProductWithStock[], label: string | null) => (
    <div>
      {label && <h3 className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-2">{label}</h3>}
      <div className="bg-surface-sunken border border-border-2 rounded-radius-sm overflow-hidden">
        {rows.map(product => (
          <ProductRow
            key={product.id}
            product={product}
            onTicket={onTicketCountFor(items, product.id)}
            remaining={remainingStock(items, product)}
            onAdd={() => onAdd(product)}
            onRestock={() => onRestock(product)}
          />
        ))}
      </div>
    </div>
  )

  const hasFrequent = !!frequent && frequent.length > 0
  return (
    <div className="space-y-4">
      {hasFrequent && group(frequent!, t('workOrders.frequentlySoldHeading'))}
      {products.length > 0 && group(products, showSectionLabel || hasFrequent ? t('workOrders.productsSectionLabel') : null)}
    </div>
  )
}
