import type { ProductWithStock } from '../../lib/stockLedger'
import type { Supplier } from '../../store/supplierStore'
import { useTranslation } from '../../lib/i18n'
import { RestockExpenseFields } from './RestockExpenseFields'

/** The "record as expense" checkbox, and its fields once checked — only
 *  shown for an addition in a mode that can see cost (see AdjustStockDialog's
 *  canSeeCost comment). */
export function RestockExpenseSection({
  product,
  qty,
  unitCost,
  recordExpense,
  onRecordExpenseChange,
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
  unitCost: number
  recordExpense: boolean
  onRecordExpenseChange: (checked: boolean) => void
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

  return (
    <>
      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={recordExpense}
          onChange={e => onRecordExpenseChange(e.target.checked)}
          className="accent-accent"
        />
        {t('inventory.recordAsExpenseLabel')}
      </label>
      {recordExpense && (
        <RestockExpenseFields
          product={product}
          qty={qty}
          unitCost={unitCost}
          expenseCost={expenseCost}
          costEdited={costEdited}
          onCostChange={onCostChange}
          vendor={vendor}
          vendorMode={vendorMode}
          suppliers={suppliers}
          onVendorChange={onVendorChange}
          onVendorModeToOther={onVendorModeToOther}
        />
      )}
    </>
  )
}
