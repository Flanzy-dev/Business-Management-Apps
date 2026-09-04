import type { ProductWithStock } from '../../lib/stockLedger'
import { isLowStock } from '../../lib/stockLedger'
import { formatCurrency } from '../../lib/currency'
import { useClickOrDoubleClick } from '../../lib/rowInteraction'
import { useTranslation } from '../../lib/i18n'

/**
 * Tap-to-add product tile: name, price, and what's left on the shelf. A
 * sold-out tile stays clickable rather than disabled — one tap still shows
 * the "out of stock" toast (via onAdd), and a double-tap opens Adjust/Receive
 * Stock (via onRestock) so a shipment that just arrived can be logged without
 * leaving the order. See useClickOrDoubleClick for why a plain onClick can't
 * sit next to that.
 */
export function ProductTile({
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
    <button
      type="button"
      {...(soldOut ? clickHandlers(onAdd, onRestock) : { onClick: onAdd })}
      title={soldOut ? t('workOrders.outOfStockRestockHint') : product.name}
      className={`
        relative flex flex-col justify-between text-left min-h-[96px] p-3
        bg-surface-sunken border rounded-radius-sm focus-ring
        transition-colors duration-fast ease-out cursor-pointer
        ${soldOut ? 'border-border-1 opacity-45' : 'border-border-2 hover:border-accent hover:bg-bg-4 active:bg-bg-4'}
      `}
    >
      {onTicket > 0 && (
        <span
          title={t('workOrders.onTicketCount', { count: onTicket })}
          className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-radius-full bg-accent text-fg-inverse font-mono text-2xs font-semibold"
        >
          {onTicket}
        </span>
      )}

      <span className="text-sm text-fg-1 leading-snug pr-6 line-clamp-2">{product.name}</span>

      <span className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm text-accent tabular-nums">{formatCurrency(product.sellPrice)}</span>
        <span className={`text-2xs tabular-nums ${soldOut ? 'text-danger' : lowStock ? 'text-warning' : 'text-fg-3'}`}>
          {soldOut ? t('workOrders.outOfStockBadge') : t('workOrders.stockLabel', { qty: product.qtyOnHand, unit: product.unit })}
        </span>
      </span>
    </button>
  )
}
