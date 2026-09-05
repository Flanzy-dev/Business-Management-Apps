import type { ProductWithStock } from '../../lib/stockLedger'
import type { Supplier } from '../../store/supplierStore'
import { purchaseAmount, newAverageCostAfterPurchase } from '../../lib/restockForm'
import { formatCurrency } from '../../lib/currency'
import { useTranslation } from '../../lib/i18n'
import { Input, Select } from '../ui/Input'

const OTHER_VENDOR_VALUE = '__other__'

/** The vendor + purchase-cost fields shown once an arrival is being recorded
 *  as an expense — including the "what this does to the blended average
 *  cost" preview underneath (see restockForm.ts). */
export function RestockExpenseFields({
  product,
  qty,
  unitCost,
  expenseCost,
  costEdited,
  onCostChange,
  vendor,
  vendorMode,
  suppliers,
  onVendorChange,
  onVendorModeToOther,
}: {
  product: ProductWithStock
  qty: number
  /** The blended cost of the stock currently on hand (useProductLots' averageCost, or costPrice with no lots). */
  unitCost: number
  expenseCost: string
  costEdited: boolean
  onCostChange: (value: string) => void
  vendor: string
  vendorMode: 'select' | 'other'
  suppliers: Supplier[]
  onVendorChange: (vendor: string) => void
  onVendorModeToOther: () => void
}) {
  const { t } = useTranslation()
  const amount = purchaseAmount(qty, costEdited, expenseCost, product.costPrice)
  const newAverage = newAverageCostAfterPurchase(product.qtyOnHand, unitCost, qty, amount)

  return (
    <div className="space-y-4">
      {vendorMode === 'other' ? (
        <Input label={t('inventory.vendorLabel')} value={vendor} onChange={e => onVendorChange(e.target.value)} placeholder={t('inventory.vendorPlaceholder')} />
      ) : (
        <Select
          label={t('inventory.vendorLabel')}
          value={vendor}
          onChange={e => (e.target.value === OTHER_VENDOR_VALUE ? onVendorModeToOther() : onVendorChange(e.target.value))}
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
          onChange={e => onCostChange(e.target.value)}
        />
        {qty > 0 && (
          <p className="mt-1 text-2xs text-fg-3">
            {t('inventory.newAverageAfterPurchase', { unit: formatCurrency(Math.round(amount / qty)), average: formatCurrency(newAverage) })}
          </p>
        )}
      </div>
    </div>
  )
}
