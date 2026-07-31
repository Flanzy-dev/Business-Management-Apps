import { useEffect, useState } from 'react'
import type { ProductWithStock } from '../../lib/stockLedger'
import { reconcileStock } from '../../lib/ops/inventoryOps'
import { unitLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

/**
 * Correct a product flagged with negative derived stock — see
 * src/lib/stockLedger.ts's negativeStockProducts and
 * src/lib/ops/inventoryOps.ts's reconcileStock. Shown from the Inventory
 * page only for a product that's actually gone negative; the counted
 * quantity the shop enters becomes a single reconciling movement.
 */
export function ReconcileStockDialog({
  open,
  product,
  onClose,
}: {
  open: boolean
  product: ProductWithStock | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [counted, setCounted] = useState('0')

  useEffect(() => {
    if (open) setCounted('0')
  }, [open, product?.id])

  const handleConfirm = () => {
    if (!product) return
    reconcileStock(product.id, parseInt(counted) || 0)
    onClose()
  }

  return (
    <Dialog open={open && !!product} onClose={onClose} title={product ? t('inventory.reconcileDialogTitle', { product: product.name }) : ''} size="sm">
      {product && (
        <>
          <p className="text-sm text-text-secondary mb-4">
            {t('inventory.reconcileDialogMessage', { qty: product.qtyOnHand })}
          </p>
          <Input
            label={t('inventory.reconcileCountedLabel')}
            type="number"
            mono
            min="0"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            autoFocus
          />
          <p className="mt-1 text-2xs text-fg-3">{unitLabel(product.unit)}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              {t('inventory.reconcileConfirm')}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}
