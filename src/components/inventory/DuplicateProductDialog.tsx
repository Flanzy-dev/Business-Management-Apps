import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ProductWithStock } from '../../lib/stockLedger'
import { useProductLots } from '../../hooks/useProductLots'
import { lotInventoryValue } from '../../lib/inventoryCosting'
import { formatCurrency } from '../../lib/currency'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'

export interface IncomingStock {
  qty: number
  costPrice: number
  sellPrice: number
}

/**
 * Shown when someone adds a product the shop already stocks — almost always
 * because they meant to restock it. Offers to put the quantity onto the
 * existing product instead of creating a second record, and lays out what that
 * does to the prices first: the batch arrives as its own FIFO lot, so the buy
 * price doesn't overwrite what the old stock cost, it blends into the average.
 */
export function DuplicateProductDialog({
  open,
  existing,
  incoming,
  onConfirm,
  onClose,
}: {
  open: boolean
  existing: ProductWithStock
  incoming: IncomingStock
  onConfirm: (options: { updateSellPrice: boolean }) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { lots, averageCost } = useProductLots(existing.id)

  const sellPriceDiffers = incoming.sellPrice !== existing.sellPrice
  const [updateSellPrice, setUpdateSellPrice] = useState(sellPriceDiffers)

  // Only offer to change the sell price when it actually changed, and re-seed
  // each time the dialog opens rather than while it's open.
  useEffect(() => {
    if (open) setUpdateSellPrice(sellPriceDiffers)
  }, [open, sellPriceDiffers])

  const currentAvg = averageCost ?? existing.costPrice
  const purchaseAmount = Math.round(incoming.qty * incoming.costPrice)
  const totalQty = existing.qtyOnHand + incoming.qty
  const newAvg =
    totalQty > 0
      ? ((lots.length > 0 ? lotInventoryValue(lots) : existing.costPrice * existing.qtyOnHand) +
          purchaseAmount) /
        totalQty
      : currentAvg

  return (
    <Dialog open={open} onClose={onClose} title={t('inventory.duplicateRestockTitle')} size="md">
      <p className="text-sm text-fg-2">
        {t('inventory.duplicateRestockMessage', {
          product: existing.name,
          qty: existing.qtyOnHand,
          unit: existing.unit,
          adding: incoming.qty,
        })}
      </p>

      <div className="mt-4 space-y-1">
        <PriceRow label={t('inventory.buyPriceLabel')} from={existing.costPrice} to={incoming.costPrice} />
        <PriceRow label={t('inventory.avgCostLabel')} from={Math.round(currentAvg)} to={Math.round(newAvg)} />
        <PriceRow label={t('inventory.sellPriceLabel')} from={existing.sellPrice} to={incoming.sellPrice} />
      </div>

      {sellPriceDiffers && (
        <label className="mt-3 flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={updateSellPrice}
            onChange={e => setUpdateSellPrice(e.target.checked)}
            className="accent-accent"
          />
          {t('inventory.updateSellPriceLabel')}
        </label>
      )}

      <p className="mt-4 pt-3 border-t border-border-1 text-xs text-fg-3">
        {t('inventory.duplicateRestockEffect', {
          qty: incoming.qty,
          unit: existing.unit,
          amount: formatCurrency(purchaseAmount),
        })}
      </p>
      <p className="mt-1 text-2xs text-fg-3">{t('inventory.duplicateRestockFieldsNote')}</p>

      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={() => onConfirm({ updateSellPrice })}>
          {t('inventory.duplicateRestockConfirm')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/** old → new, with the arrow and tone only where the number actually moved. */
function PriceRow({ label, from, to }: { label: string; from: number; to: number }) {
  const up = to > from
  const changed = to !== from
  const Arrow = up ? ArrowUp : ArrowDown

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="flex items-center gap-2 font-mono tabular-nums">
        <span className={changed ? 'text-fg-3 line-through' : 'text-text-primary'}>{formatCurrency(from)}</span>
        {changed && (
          <>
            <span className="text-text-primary">{formatCurrency(to)}</span>
            {/* Up is not automatically bad here — a higher buy price costs the
                shop, a higher sell price earns it — so this is a direction
                marker, not a verdict. */}
            <Arrow size={14} className={up ? 'text-warning' : 'text-success'} />
          </>
        )}
      </span>
    </div>
  )
}
