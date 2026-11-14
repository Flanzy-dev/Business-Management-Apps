import { PackagePlus } from 'lucide-react'
import type { ProductWithStock } from '../../lib/inventory/stockLedger'
import { isLowStock } from '../../lib/inventory/stockLedger'
import { formatCurrency } from '../../lib/format/numbers'
import { useClickOrDoubleClick } from '../../lib/app/rowInteraction'
import { useTranslation } from '../../lib/i18n'
import { IconButton } from '../ui/IconButton'

/**
 * Tap-to-add product row: the full name, what's left on the shelf under it,
 * and the price. A row rather than a tile because the catalog runs to
 * hundreds of products — names like "AP-75 Multi Purpose Lubricant Spray
 * 250 mL" need their whole width, and a row is easy to scan top to bottom.
 *
 * A sold-out row stays clickable rather than disabled — one tap still shows
 * the "out of stock" toast (via onAdd), and a double-tap opens Adjust/Receive
 * Stock (via onRestock) so a shipment that just arrived can be logged without
 * leaving the order. See useClickOrDoubleClick for why a plain onClick can't
 * sit next to that.
 *
 * A sold-out row ALSO gets a restock button at its end — the double-tap alone
 * used to be the only way in, and a double-tap on touch is unreliable (many
 * browsers treat it as a zoom gesture) with no tap-reachable substitute. The
 * row itself is a <button>, so the restock control can't nest inside it
 * (invalid HTML, and the tap would bubble into onAdd); it is laid out as a
 * sibling of that button instead, inside a shared relative wrapper, and only
 * rendered for the sold-out case.
 */
export function ProductRow({
  product,
  onTicket,
  remaining,
  onAdd,
  onRestock,
}: {
  product: ProductWithStock
  onTicket: number
  remaining: number
  onAdd: () => void
  onRestock: () => void
}) {
  const { t } = useTranslation()
  const soldOut = remaining <= 0
  const lowStock = isLowStock(product)
  const clickHandlers = useClickOrDoubleClick()

  return (
    <div className="relative border-b border-border-1 last:border-b-0">
      <button
        type="button"
        {...(soldOut ? clickHandlers(onAdd, onRestock) : { onClick: onAdd })}
        title={soldOut ? t('workOrders.outOfStockRestockHint') : product.sku ? `${product.name} · ${product.sku}` : product.name}
        className={`
          flex items-center gap-3 w-full min-h-[48px] coarse:min-h-[52px] py-2 pl-3 text-left focus-ring
          transition-colors duration-fast ease-out cursor-pointer
          ${soldOut ? 'pr-14' : 'pr-3'}
          ${soldOut ? '' : 'hover:bg-bg-4 active:bg-bg-4'}
        `}
      >
        {/* Dims the row's own content, not the wrapper — so the restock
            button rendered as this button's sibling stays at full contrast. */}
        <span className={`flex-1 min-w-0 ${soldOut ? 'opacity-45' : ''}`}>
          <span className="block text-sm text-fg-1 leading-snug">{product.name}</span>
          <span className="block truncate text-2xs tabular-nums">
            {product.sku && <span className="font-mono text-fg-3">{product.sku} · </span>}
            <span className={soldOut ? 'text-danger' : lowStock ? 'text-warning' : 'text-fg-3'}>
              {soldOut ? t('workOrders.outOfStockBadge') : t('workOrders.stockLabel', { qty: product.qtyOnHand, unit: product.unit })}
            </span>
          </span>
        </span>

        {onTicket > 0 && (
          <span
            title={t('workOrders.onTicketCount', { count: onTicket })}
            className="shrink-0 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-radius-full bg-accent text-fg-inverse font-mono text-2xs font-semibold"
          >
            {onTicket}
          </span>
        )}

        <span className={`shrink-0 font-mono text-sm text-accent tabular-nums ${soldOut ? 'opacity-45' : ''}`}>
          {formatCurrency(product.sellPrice)}
        </span>
      </button>

      {soldOut && (
        <IconButton
          size="touch"
          label={t('inventory.adjustStockAction')}
          onClick={onRestock}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface-card"
        >
          <PackagePlus size={18} />
        </IconButton>
      )}
    </div>
  )
}
