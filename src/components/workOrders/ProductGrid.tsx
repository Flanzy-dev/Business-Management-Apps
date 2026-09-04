import type { ProductWithStock } from '../../lib/stockLedger'
import type { WorkOrderItem } from '../../store/workOrderStore'
import { remainingStock } from '../../lib/orderLifecycle'
import { onTicketCountFor } from '../../lib/checkoutCatalogFilter'
import { useTranslation } from '../../lib/i18n'
import { ProductTile } from './ProductTile'

/** The catalog pane's product group — a section label only shows up under
 *  "All", where services share the pane and the two groups need telling apart. */
export function ProductGrid({
  products,
  items,
  showSectionLabel,
  onAdd,
  onRestock,
}: {
  products: ProductWithStock[]
  items: WorkOrderItem[]
  showSectionLabel: boolean
  onAdd: (product: ProductWithStock) => void
  onRestock: (product: ProductWithStock) => void
}) {
  const { t } = useTranslation()

  return (
    <div>
      {showSectionLabel && (
        <h3 className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-2">
          {t('workOrders.productsSectionLabel')}
        </h3>
      )}
      <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {products.map(product => (
          <ProductTile
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
}
