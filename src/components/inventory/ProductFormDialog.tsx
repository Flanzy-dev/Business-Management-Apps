import { useEffect, useState } from 'react'
import { useInventoryStore } from '../../store/inventoryStore'
import { useSupplierStore } from '../../store/supplierStore'
import { useProductStock } from '../../hooks/useProductStock'
import type { ProductWithStock } from '../../lib/stockLedger'
import { createProduct, restockProduct } from '../../lib/ops/inventoryOps'
import { findDuplicateProduct } from '../../lib/productIdentity'
import {
  initialProductDraft,
  validateProductDraft,
  productDraftToData,
  duplicateResolution,
  duplicateResolutionToast,
  initialPurchase,
  type ProductDraft,
} from '../../lib/productForm'
import { unitLabel, PRODUCT_UNITS } from '../../lib/entities'
import { useToastStore } from '../../store/toastStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogActions } from '../ui/Dialog'
import { Input, Select, Textarea } from '../ui/Input'
import { CategoryField } from './CategoryField'
import { ScheduleItemSelect } from './ScheduleItemSelect'
import { DuplicateProductDialog } from './DuplicateProductDialog'

/**
 * Create/edit form for a product. Owns the whole flow including the
 * duplicate-name restock offer (DuplicateProductDialog) — a name clash while
 * creating is almost always a restock, so this dialog stays open underneath
 * it until that's confirmed or dismissed. Draft state and its conversions
 * live in src/lib/productForm.ts.
 */
export function ProductFormDialog({
  open,
  product,
  onClose,
}: {
  open: boolean
  product: ProductWithStock | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { updateProduct } = useInventoryStore()
  const products = useProductStock()
  const { suppliers } = useSupplierStore()
  const showToast = useToastStore(s => s.show)

  const [draft, setDraft] = useState<ProductDraft>(() => initialProductDraft(product))
  const [duplicateTarget, setDuplicateTarget] = useState<ProductWithStock | null>(null)

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  // Seed the form when the dialog opens — from the product being edited, or
  // blank (with defaults) for a new one.
  useEffect(() => {
    if (!open) return
    setDraft(initialProductDraft(product))
    setDuplicateTarget(null)
  }, [open, product?.id])

  const getSupplierName = (id: string | null) => {
    if (!id) return '-'
    return suppliers.find(s => s.id === id)?.name || '-'
  }

  // Live so the clash shows while typing, not only when saving fails. Excludes
  // the record being edited — a product can't be a duplicate of itself.
  const duplicate = findDuplicateProduct(products, { name: draft.name, sku: draft.sku }, product?.id)

  const handleSave = () => {
    const validation = validateProductDraft(draft)
    if (!validation.ok) {
      if (validation.nameRequired) return showToast({ tone: 'danger', title: t('inventory.nameRequired') })
      return showToast({ tone: 'danger', title: t('inventory.sellPriceRequired') })
    }

    const incomingQty = parseInt(draft.qtyOnHand) || 0
    const resolution = duplicateResolution(duplicate, !product, incomingQty)
    if (resolution.kind === 'offerRestock') {
      setDuplicateTarget(resolution.product)
      return
    }
    const toast = duplicateResolutionToast(resolution, t)
    if (toast) return showToast(toast)

    const data = productDraftToData(draft)

    if (product) {
      // Qty On Hand is only editable while creating (initial stock, paired
      // with the recordInitialExpense checkbox below). Once a product exists,
      // Adjust Stock is the only path that may change it — that's also the
      // one path that keeps a matching stock-ledger movement, so editing
      // other fields here must never let stock drift.
      updateProduct(product.id, data)
    } else {
      const purchase = initialPurchase(draft.recordInitialExpense, incomingQty, data.costPrice, getSupplierName(data.supplierId), data.name)
      createProduct(data, incomingQty, purchase)
    }
    onClose()
  }

  /** Confirmed the restock offer: the quantity lands on the existing product as its own FIFO lot. */
  const handleRestockExisting = (target: ProductWithStock, options: { updateSellPrice: boolean }) => {
    const qty = parseInt(draft.qtyOnHand) || 0
    const unitCost = Math.round(parseFloat(draft.costPrice || '0'))
    const purchase = initialPurchase(draft.recordInitialExpense, qty, unitCost, getSupplierName(draft.supplierId || null), target.name)

    restockProduct(target.id, qty, purchase)
    if (options.updateSellPrice) {
      updateProduct(target.id, { sellPrice: Math.round(parseFloat(draft.sellPrice) || 0) })
    }
    setDuplicateTarget(null)
    onClose()
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} title={product ? t('inventory.editProductTitle') : t('inventory.addProductTitle')} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              label={t('inventory.nameLabel')}
              value={draft.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g., Mobil 1 5W-30 Synthetic"
              error={
                duplicate?.field === 'name'
                  ? t('inventory.duplicateNameError', { product: duplicate.product.name })
                  : undefined
              }
            />
          </div>
          <Input
            label={t('inventory.skuLabel')}
            mono
            value={draft.sku}
            onChange={e => set('sku', e.target.value)}
            placeholder="e.g., OIL-MOB1-5W30"
            error={
              duplicate?.field === 'sku'
                ? t('inventory.duplicateSkuError', { product: duplicate.product.name })
                : undefined
            }
          />
          <div>
            <Input
              label={t('inventory.supplierCodeLabel')}
              mono
              value={draft.supplierCode}
              // Uppercased as it's typed, not on save, so the field shows
              // exactly what the catalog will store and what the CSV exports.
              onChange={e => set('supplierCode', e.target.value.toUpperCase())}
              placeholder="e.g., LDW"
            />
            <p className="mt-1 text-2xs text-fg-3">{t('inventory.supplierCodeHint')}</p>
          </div>
          <CategoryField category={draft.category} onChange={(category) => set('category', category)} />
          <Select label={t('inventory.unitLabel')} value={draft.unit} onChange={e => set('unit', e.target.value)}>
            {PRODUCT_UNITS.map(u => <option key={u} value={u}>{unitLabel(u)}</option>)}
          </Select>
          <ScheduleItemSelect
            category={draft.category}
            value={draft.scheduleItemOverride}
            onChange={(value) => set('scheduleItemOverride', value)}
          />
          {/* Full width so the odd field count from Supplier Code above doesn't
              split Cost Price and Sell Price across two rows — those two are
              read against each other. */}
          <div className="col-span-2">
            <Select label={t('inventory.supplierLabel')} value={draft.supplierId} onChange={e => set('supplierId', e.target.value)}>
              <option value="">{t('inventory.noSupplier')}</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div>
            <Input label={t('inventory.costPriceLabel')} type="number" step="0.01" mono value={draft.costPrice} onChange={e => set('costPrice', e.target.value)} placeholder="0" />
            <p className="mt-1 text-2xs text-fg-3">{t('inventory.costPriceHint')}</p>
          </div>
          <Input label={t('inventory.sellPriceLabel')} type="number" step="0.01" mono value={draft.sellPrice} onChange={e => set('sellPrice', e.target.value)} placeholder="0" />
          <div>
            <Input
              label={t('inventory.qtyOnHandLabel')}
              type="number"
              mono
              value={product ? product.qtyOnHand : draft.qtyOnHand}
              onChange={e => set('qtyOnHand', e.target.value)}
              disabled={!!product}
            />
            {product && <p className="mt-1 text-2xs text-fg-3">{t('inventory.qtyOnHandEditHint')}</p>}
          </div>
          <Input label={t('inventory.reorderPointLabel')} type="number" mono value={draft.reorderPoint} onChange={e => set('reorderPoint', e.target.value)} />
          {!product && (parseInt(draft.qtyOnHand) || 0) > 0 && (
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.recordInitialExpense}
                  onChange={e => set('recordInitialExpense', e.target.checked)}
                  className="accent-accent"
                />
                {t('inventory.recordInitialStockExpenseLabel')}
              </label>
            </div>
          )}
          <div className="col-span-2">
            <Textarea label={t('inventory.notesLabel')} value={draft.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
        </div>
        <DialogActions onCancel={onClose} onConfirm={handleSave} confirmLabel={product ? t('inventory.saveChanges') : t('inventory.addProduct')} />
      </Dialog>

      {duplicateTarget && (
        <DuplicateProductDialog
          open
          existing={duplicateTarget}
          incoming={{
            qty: parseInt(draft.qtyOnHand) || 0,
            costPrice: Math.round(parseFloat(draft.costPrice || '0')),
            sellPrice: Math.round(parseFloat(draft.sellPrice) || 0),
          }}
          onConfirm={options => handleRestockExisting(duplicateTarget, options)}
          onClose={() => setDuplicateTarget(null)}
        />
      )}
    </>
  )
}
