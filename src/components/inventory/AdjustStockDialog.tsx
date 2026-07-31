import { useEffect, useState } from 'react'
import type { ProductWithStock } from '../../lib/stockLedger'
import { useStockLotStore } from '../../store/stockLotStore'
import { useStockMovementStore } from '../../store/stockMovementStore'
import { useSupplierStore } from '../../store/supplierStore'
import { averageUnitCost } from '../../lib/inventoryCosting'
import { lotsByProduct } from '../../lib/stockLedger'
import { restockProduct } from '../../lib/ops/inventoryOps'
import { unitLabel } from '../../lib/entities'
import { formatCurrency } from '../../lib/currency'
import { useToastStore } from '../../store/toastStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input, Select } from '../ui/Input'
import { Button } from '../ui/Button'

const OTHER_VENDOR_VALUE = '__other__'

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
  const stockLots = useStockLotStore(s => s.stockLots)
  const movements = useStockMovementStore(s => s.movements)
  const { suppliers } = useSupplierStore()
  const showToast = useToastStore(s => s.show)

  const [adjustQty, setAdjustQty] = useState('')
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add')
  const [recordExpense, setRecordExpense] = useState(true)
  const [expenseCost, setExpenseCost] = useState('')
  const [costEdited, setCostEdited] = useState(false)
  const [vendor, setVendor] = useState('')
  const [vendorMode, setVendorMode] = useState<'select' | 'other'>('select')

  useEffect(() => {
    if (!open) return
    setAdjustQty('')
    setAdjustType('add')
    setRecordExpense(true)
    setExpenseCost('')
    setCostEdited(false)
    setVendor(product ? getSupplierName(product.supplierId) : '')
    setVendorMode('select')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getSupplierName reads suppliers via closure; only open/product should retrigger this reset
  }, [open, product?.id])

  /**
   * What the stock actually on hand cost, per unit — a blend when it came in
   * on batches at different prices. Falls back to the product's own cost price
   * for stock with no lot behind it.
   */
  const unitCostOf = (p: ProductWithStock) =>
    averageUnitCost(lotsByProduct(stockLots, movements, p.id)) ?? p.costPrice

  const getSupplierName = (id: string | null) => {
    if (!id) return ''
    return suppliers.find(s => s.id === id)?.name || ''
  }

  const handleAdjust = () => {
    if (!product || !adjustQty) return
    const qty = parseInt(adjustQty)
    if (isNaN(qty) || qty <= 0) return showToast({ tone: 'danger', title: t('inventory.validQuantityRequired') })

    const purchase = adjustType === 'add' && recordExpense
      ? {
          amount: costEdited ? Math.round(parseFloat(expenseCost) || 0) : qty * product.costPrice,
          vendor,
          description: product.name,
        }
      : null
    restockProduct(product.id, adjustType === 'add' ? qty : -qty, purchase)
    onClose()
  }

  return (
    <Dialog open={open && !!product} onClose={onClose} title={t('inventory.adjustStockTitle')} size="sm">
      {product && (
        <>
          <p className="text-text-primary mb-1">{product.name}</p>
          <p className="text-sm text-text-secondary mb-4">
            {t('inventory.currentStockLabel')} <span className="font-mono font-medium text-text-primary">{product.qtyOnHand}</span> {unitLabel(product.unit)}
          </p>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setAdjustType('add')}
                className={`flex-1 py-2 rounded-radius-sm border focus-ring ${adjustType === 'add' ? 'bg-accent/20 border-accent text-accent' : 'border-border-subtle text-text-secondary'}`}
              >
                {t('inventory.addOption')}
              </button>
              <button
                onClick={() => setAdjustType('subtract')}
                className={`flex-1 py-2 rounded-radius-sm border focus-ring ${adjustType === 'subtract' ? 'bg-danger/20 border-danger text-danger' : 'border-border-subtle text-text-secondary'}`}
              >
                {t('inventory.subtractOption')}
              </button>
            </div>
            <Input label={t('inventory.quantityLabel')} type="number" mono value={adjustQty} onChange={e => setAdjustQty(e.target.value)} min="1" autoFocus />
            {adjustType === 'add' && (
              <>
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordExpense}
                    onChange={e => setRecordExpense(e.target.checked)}
                    className="accent-accent"
                  />
                  {t('inventory.recordAsExpenseLabel')}
                </label>
                {recordExpense && (() => {
                  const qty = parseInt(adjustQty) || 0
                  const amount = costEdited
                    ? Math.round(parseFloat(expenseCost) || 0)
                    : qty * product.costPrice
                  // What this purchase does to the blended cost of stock on
                  // hand — the batch arrives as its own FIFO lot at
                  // amount/qty, it does not overwrite the old stock's cost.
                  const onHandValue = Math.round(unitCostOf(product) * product.qtyOnHand)
                  const newAverage =
                    product.qtyOnHand + qty > 0
                      ? Math.round((onHandValue + amount) / (product.qtyOnHand + qty))
                      : 0
                  return (
                    <div className="space-y-4">
                      {vendorMode === 'other' ? (
                        <Input
                          label={t('inventory.vendorLabel')}
                          value={vendor}
                          onChange={e => setVendor(e.target.value)}
                          placeholder={t('inventory.vendorPlaceholder')}
                        />
                      ) : (
                        <Select
                          label={t('inventory.vendorLabel')}
                          value={vendor}
                          onChange={e => {
                            const val = e.target.value
                            if (val === OTHER_VENDOR_VALUE) {
                              setVendorMode('other')
                              setVendor('')
                              return
                            }
                            setVendor(val)
                          }}
                        >
                          <option value="">{t('inventory.noVendor')}</option>
                          {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          <option value={OTHER_VENDOR_VALUE}>{t('inventory.otherVendorOption')}</option>
                        </Select>
                      )}
                      <div>
                        <Input
                          label={t('inventory.purchaseCostLabel')}
                          type="number"
                          mono
                          value={costEdited ? expenseCost : String(qty * product.costPrice)}
                          onChange={e => { setExpenseCost(e.target.value); setCostEdited(true) }}
                        />
                        {qty > 0 && (
                          <p className="mt-1 text-2xs text-fg-3">
                            {t('inventory.newAverageAfterPurchase', {
                              unit: formatCurrency(Math.round(amount / qty)),
                              average: formatCurrency(newAverage),
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </>
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
        </>
      )}
    </Dialog>
  )
}
