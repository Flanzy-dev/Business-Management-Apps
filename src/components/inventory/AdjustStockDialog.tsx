import { useEffect, useState } from 'react'
import type { ProductWithStock } from '../../lib/stockLedger'
import { useProductLots } from '../../hooks/useProductLots'
import { useSupplierStore } from '../../store/supplierStore'
import { useMode } from '../../store/authStore'
import { canSeeCostAndProfit } from '../../lib/auth/permissions'
import { restockProduct } from '../../lib/ops/inventoryOps'
import { restockPurchase, supplierNameById, type AdjustType } from '../../lib/restockForm'
import { unitLabel } from '../../lib/entities'
import { useToastStore } from '../../store/toastStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { AdjustTypeToggle } from './AdjustTypeToggle'
import { RestockExpenseSection } from './RestockExpenseSection'

/** Add or remove stock outside a sale — the only path (besides a sale) that may move qtyOnHand. */
export function AdjustStockDialog({
  open,
  product,
  onClose,
}: {
  open: boolean
  product: ProductWithStock | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { averageCost } = useProductLots(product?.id ?? '')
  const { suppliers } = useSupplierStore()
  const showToast = useToastStore(s => s.show)
  // Worker mode may only record an arrival's quantity, never its cost — see
  // canReceiveStock's doc comment. Everything cost-shaped below is gated on
  // this and forced to the values that make handleAdjust take the no-expense
  // path, so the same dialog serves both modes without a second component.
  const mode = useMode()
  const canSeeCost = canSeeCostAndProfit(mode)

  const [adjustQty, setAdjustQty] = useState('')
  const [adjustType, setAdjustType] = useState<AdjustType>('add')
  const [recordExpense, setRecordExpense] = useState(true)
  const [expenseCost, setExpenseCost] = useState('')
  const [costEdited, setCostEdited] = useState(false)
  const [vendor, setVendor] = useState('')
  const [vendorMode, setVendorMode] = useState<'select' | 'other'>('select')

  useEffect(() => {
    if (!open) return
    setAdjustQty('')
    setAdjustType('add')
    setRecordExpense(canSeeCost)
    setExpenseCost('')
    setCostEdited(false)
    setVendor(product ? supplierNameById(suppliers, product.supplierId) : '')
    setVendorMode('select')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suppliers is read as of the moment the dialog opens; only open/product should retrigger this reset
  }, [open, product?.id, canSeeCost])

  const qty = parseInt(adjustQty) || 0

  const handleAdjust = () => {
    if (!product || !adjustQty) return
    const parsedQty = parseInt(adjustQty)
    if (isNaN(parsedQty) || parsedQty <= 0) return showToast({ tone: 'danger', title: t('inventory.validQuantityRequired') })

    // Without canSeeCost the Subtract toggle and expense block are never
    // rendered, so adjustType/recordExpense can't have drifted from
    // 'add'/false — this just makes that invariant explicit at the write.
    const type = canSeeCost ? adjustType : 'add'
    const purchase = restockPurchase(type, canSeeCost && recordExpense, parsedQty, costEdited, expenseCost, product.costPrice, vendor, product.name)
    restockProduct(product.id, type === 'add' ? parsedQty : -parsedQty, purchase)
    onClose()
  }

  // Dialog unmounts its content immediately on open=false (no exit
  // transition to preserve), so bailing out here before the JSX — rather
  // than wrapping all of it in `{product && ...}` — is safe and keeps every
  // field below out of an extra nesting level.
  if (!product) {
    return (
      <Dialog open={false} onClose={onClose} title="">
        {null}
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title={t(canSeeCost ? 'inventory.adjustStockTitle' : 'inventory.receiveStockTitle')} size="sm">
      <p className="text-text-primary mb-1">{product.name}</p>
      <p className="text-sm text-text-secondary mb-4">
        {t('inventory.currentStockLabel')} <span className="font-mono font-medium text-text-primary">{product.qtyOnHand}</span> {unitLabel(product.unit)}
      </p>
      <div className="space-y-4">
        {canSeeCost && <AdjustTypeToggle value={adjustType} onChange={setAdjustType} />}
        <Input label={t('inventory.quantityLabel')} type="number" mono value={adjustQty} onChange={e => setAdjustQty(e.target.value)} min="1" autoFocus />
        {canSeeCost && adjustType === 'add' && (
          <RestockExpenseSection
            product={product}
            qty={qty}
            unitCost={averageCost ?? product.costPrice}
            recordExpense={recordExpense}
            onRecordExpenseChange={setRecordExpense}
            expenseCost={expenseCost}
            costEdited={costEdited}
            onCostChange={value => { setExpenseCost(value); setCostEdited(true) }}
            vendor={vendor}
            vendorMode={vendorMode}
            suppliers={suppliers}
            onVendorChange={setVendor}
            onVendorModeToOther={() => { setVendorMode('other'); setVendor('') }}
          />
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant={adjustType === 'add' ? 'primary' : 'danger'} onClick={handleAdjust}>
          {adjustType === 'add' ? t('inventory.addStock') : t('inventory.removeStock')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
