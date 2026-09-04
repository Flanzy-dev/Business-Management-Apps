import { History } from 'lucide-react'
import type { Product } from '../../store/inventoryStore'
import { useProductLots } from '../../hooks/useProductLots'
import { lotInventoryValue } from '../../lib/inventoryCosting'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/dates'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

/**
 * What the shop actually paid for this product, batch by batch. No new data —
 * FIFO lots already record it (src/store/stockLotStore.ts), including stock
 * returned by deleting a completed order, which comes back at the cost the
 * sale was frozen at.
 */
export function PriceHistoryDialog({
  open,
  product,
  onClose,
}: {
  open: boolean
  product: Product
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { lots: balances, averageCost: average, rawLots } = useProductLots(product.id)

  // qtyReceived is immutable history, not carried on the hydrated balance
  // (see src/lib/inventoryCosting.ts's LotBalance) — read it off the raw lot
  // row and pair it with the derived remaining for display. Newest first:
  // history reads backwards, even though FIFO draws forwards.
  const remainingByLot = new Map(balances.map(b => [b.id, b.qtyRemaining]))
  const lots = rawLots
    .map(lot => ({ ...lot, qtyRemaining: remainingByLot.get(lot.id) ?? 0 }))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return (
    <Dialog open={open} onClose={onClose} title={t('inventory.priceHistoryTitle')} size="lg">
      <p className="text-sm text-text-primary mb-3">{product.name}</p>

      {lots.length === 0 ? (
        <EmptyState
          icon={History}
          title={t('inventory.priceHistoryEmpty')}
          message={t('inventory.priceHistoryEmptyHint')}
        />
      ) : (
        <>
          <div className="max-h-[45vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-card">
                <tr className="border-b border-border-1 text-2xs uppercase font-semibold tracking-wide text-fg-3">
                  <th className="text-left font-semibold py-1.5">{t('inventory.colReceived')}</th>
                  <th className="text-right font-semibold py-1.5">{t('inventory.colQtyReceived')}</th>
                  <th className="text-right font-semibold py-1.5">{t('inventory.colBuyPrice')}</th>
                  <th className="text-right font-semibold py-1.5">{t('inventory.colQtyLeft')}</th>
                </tr>
              </thead>
              <tbody>
                {lots.map(lot => (
                  <tr key={lot.id} className="border-b border-border-1 last:border-b-0">
                    <td className="py-2 text-text-primary">{formatDate(lot.receivedAt)}</td>
                    <td className="py-2 text-right font-mono text-text-secondary tabular-nums">
                      {lot.qtyReceived} {product.unit}
                    </td>
                    <td className="py-2 text-right font-mono text-text-primary tabular-nums">
                      {formatCurrency(lot.unitCost)}
                    </td>
                    <td
                      className={`py-2 text-right font-mono tabular-nums ${
                        lot.qtyRemaining === 0 ? 'text-fg-3' : 'text-text-primary'
                      }`}
                    >
                      {lot.qtyRemaining}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 pt-3 border-t border-border-1 space-y-1.5 text-sm">
            <SummaryRow
              label={t('inventory.currentAvgCostLabel')}
              value={average === null ? '—' : formatCurrency(Math.round(average))}
            />
            <SummaryRow label={t('inventory.stockValueLabel')} value={formatCurrency(lotInventoryValue(lots))} />
            <SummaryRow label={t('inventory.sellPriceLabel')} value={formatCurrency(product.sellPrice)} />
          </div>
        </>
      )}

      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>
          {t('common.close')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className="font-mono text-text-primary tabular-nums">{value}</span>
    </div>
  )
}
