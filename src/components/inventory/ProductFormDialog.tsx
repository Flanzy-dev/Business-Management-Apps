import { useEffect, useState } from 'react'
import { useInventoryStore } from '../../store/inventoryStore'
import { useSupplierStore } from '../../store/supplierStore'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useProductStock } from '../../hooks/useProductStock'
import type { ProductWithStock } from '../../lib/stockLedger'
import { createProduct, restockProduct } from '../../lib/ops/inventoryOps'
import { findDuplicateProduct } from '../../lib/productIdentity'
import { productCategoryLabel, unitLabel, PRODUCT_UNITS } from '../../lib/entities'
import { useToastStore } from '../../store/toastStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input, Select, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import { DuplicateProductDialog } from './DuplicateProductDialog'

const NEW_CATEGORY_VALUE = '__add_new__'

/**
 * Create/edit form for a product. Owns the whole flow including the
 * duplicate-name restock offer (DuplicateProductDialog) — a name clash while
 * creating is almost always a restock, so this dialog stays open underneath
 * it until that's confirmed or dismissed.
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
  const { categories, addProductCategory } = useProductCategoryStore()
  const showToast = useToastStore(s => s.show)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('Oil')
  const [unit, setUnit] = useState('each')
  const [costPrice, setCostPrice] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [qtyOnHand, setQtyOnHand] = useState('0')
  const [reorderPoint, setReorderPoint] = useState('5')
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [recordInitialExpense, setRecordInitialExpense] = useState(true)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [duplicateTarget, setDuplicateTarget] = useState<ProductWithStock | null>(null)

  // Seed the form when the dialog opens — from the product being edited, or
  // blank (with defaults) for a new one.
  useEffect(() => {
    if (!open) return
    setName(product?.name ?? '')
    setSku(product?.sku ?? '')
    setCategory(product?.category ?? 'Oil')
    setUnit(product?.unit ?? 'each')
    setCostPrice(product ? product.costPrice.toString() : '')
    setSellPrice(product ? product.sellPrice.toString() : '')
    setQtyOnHand(product ? product.qtyOnHand.toString() : '0')
    setReorderPoint(product ? product.reorderPoint.toString() : '5')
    setSupplierId(product?.supplierId || '')
    setNotes(product?.notes ?? '')
    setRecordInitialExpense(true)
    setAddingCategory(false)
    setNewCategoryName('')
    setDuplicateTarget(null)
  }, [open, product?.id])

  const getSupplierName = (id: string | null) => {
    if (!id) return '-'
    return suppliers.find(s => s.id === id)?.name || '-'
  }

  // Confirms the inline "+ New category…" input: reuse an existing category
  // on a case-insensitive match instead of creating a near-duplicate,
  // otherwise add it to the shared, Settings-managed list.
  const handleAddCategoryInline = () => {
    const name = newCategoryName.trim()
    if (!name) return
    const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (!existing) addProductCategory({ name })
    setCategory(existing ? existing.name : name)
    setAddingCategory(false)
    setNewCategoryName('')
  }

  // Live so the clash shows while typing, not only when saving fails. Excludes
  // the record being edited — a product can't be a duplicate of itself.
  const duplicate = findDuplicateProduct(products, { name, sku }, product?.id)

  const handleSave = () => {
    if (!name.trim()) return showToast({ tone: 'danger', title: t('inventory.nameRequired') })
    if (!sellPrice) return showToast({ tone: 'danger', title: t('inventory.sellPriceRequired') })

    if (duplicate) {
      // Adding a product that already exists is almost always a restock, so
      // offer that instead — but only for a name clash with stock to add. A
      // SKU clash means two differently-named rows share a code: merging
      // "Castrol" into "Shell" would compound the typo, so that just blocks.
      const incomingQty = parseInt(qtyOnHand) || 0
      if (!product && duplicate.field === 'name' && incomingQty > 0) {
        setDuplicateTarget(duplicate.product)
        return
      }
      return showToast({
        tone: 'danger',
        title: t(duplicate.field === 'name' ? 'inventory.duplicateNameError' : 'inventory.duplicateSkuError', {
          product: duplicate.product.name,
        }),
      })
    }

    const data = {
      name,
      sku,
      category,
      unit,
      costPrice: Math.round(parseFloat(costPrice || '0')),
      sellPrice: Math.round(parseFloat(sellPrice) || 0),
      reorderPoint: parseInt(reorderPoint) || 0,
      supplierId: supplierId || null,
      notes,
    }

    if (product) {
      // Qty On Hand is only editable while creating (initial stock, paired
      // with the recordInitialExpense checkbox below). Once a product exists,
      // Adjust Stock is the only path that may change it — that's also the
      // one path that keeps a matching stock-ledger movement, so editing
      // other fields here must never let stock drift.
      updateProduct(product.id, data)
    } else {
      const initialQty = parseInt(qtyOnHand) || 0
      const purchase = recordInitialExpense && initialQty > 0
        ? {
            amount: initialQty * data.costPrice,
            vendor: getSupplierName(data.supplierId),
            description: data.name,
          }
        : null
      createProduct(data, initialQty, purchase)
    }
    onClose()
  }

  /** Confirmed the restock offer: the quantity lands on the existing product as its own FIFO lot. */
  const handleRestockExisting = (target: ProductWithStock, options: { updateSellPrice: boolean }) => {
    const qty = parseInt(qtyOnHand) || 0
    const unitCost = Math.round(parseFloat(costPrice || '0'))
    const purchase = recordInitialExpense
      ? {
          amount: qty * unitCost,
          vendor: getSupplierName(supplierId || null),
          description: target.name,
        }
      : null

    restockProduct(target.id, qty, purchase)
    if (options.updateSellPrice) {
      updateProduct(target.id, { sellPrice: Math.round(parseFloat(sellPrice) || 0) })
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
              value={name}
              onChange={e => setName(e.target.value)}
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
            value={sku}
            onChange={e => setSku(e.target.value)}
            placeholder="e.g., OIL-MOB1-5W30"
            error={
              duplicate?.field === 'sku'
                ? t('inventory.duplicateSkuError', { product: duplicate.product.name })
                : undefined
            }
          />
          {addingCategory ? (
            <div className="col-span-2">
              <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('inventory.categoryLabel')}</label>
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder={t('inventory.newCategoryPlaceholder')}
                  className="flex-1"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategoryInline() }}
                />
                <Button variant="secondary" onClick={handleAddCategoryInline} disabled={!newCategoryName.trim()}>
                  {t('common.add')}
                </Button>
                <Button variant="ghost" onClick={() => { setAddingCategory(false); setNewCategoryName('') }}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Select
              label={t('inventory.categoryLabel')}
              value={category}
              onChange={e => {
                if (e.target.value === NEW_CATEGORY_VALUE) { setAddingCategory(true); setNewCategoryName('') }
                else setCategory(e.target.value)
              }}
            >
              {categories.map(c => <option key={c.id} value={c.name}>{productCategoryLabel(c.name)}</option>)}
              <option value={NEW_CATEGORY_VALUE}>{t('inventory.newCategoryOption')}</option>
            </Select>
          )}
          <Select label={t('inventory.unitLabel')} value={unit} onChange={e => setUnit(e.target.value)}>
            {PRODUCT_UNITS.map(u => <option key={u} value={u}>{unitLabel(u)}</option>)}
          </Select>
          <Select label={t('inventory.supplierLabel')} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">{t('inventory.noSupplier')}</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <div>
            <Input label={t('inventory.costPriceLabel')} type="number" step="0.01" mono value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0" />
            <p className="mt-1 text-2xs text-fg-3">{t('inventory.costPriceHint')}</p>
          </div>
          <Input label={t('inventory.sellPriceLabel')} type="number" step="0.01" mono value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0" />
          <div>
            <Input
              label={t('inventory.qtyOnHandLabel')}
              type="number"
              mono
              value={product ? product.qtyOnHand : qtyOnHand}
              onChange={e => setQtyOnHand(e.target.value)}
              disabled={!!product}
            />
            {product && <p className="mt-1 text-2xs text-fg-3">{t('inventory.qtyOnHandEditHint')}</p>}
          </div>
          <Input label={t('inventory.reorderPointLabel')} type="number" mono value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} />
          {!product && (parseInt(qtyOnHand) || 0) > 0 && (
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordInitialExpense}
                  onChange={e => setRecordInitialExpense(e.target.checked)}
                  className="accent-accent"
                />
                {t('inventory.recordInitialStockExpenseLabel')}
              </label>
            </div>
          )}
          <div className="col-span-2">
            <Textarea label={t('inventory.notesLabel')} value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {product ? t('inventory.saveChanges') : t('inventory.addProduct')}
          </Button>
        </DialogFooter>
      </Dialog>

      {duplicateTarget && (
        <DuplicateProductDialog
          open
          existing={duplicateTarget}
          incoming={{
            qty: parseInt(qtyOnHand) || 0,
            costPrice: Math.round(parseFloat(costPrice || '0')),
            sellPrice: Math.round(parseFloat(sellPrice) || 0),
          }}
          onConfirm={options => handleRestockExisting(duplicateTarget, options)}
          onClose={() => setDuplicateTarget(null)}
        />
      )}
    </>
  )
}
