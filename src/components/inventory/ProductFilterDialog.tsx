import type { ProductCategory } from '../../store/productCategoryStore'
import type { Supplier } from '../../store/supplierStore'
import { NO_FILTERS, activeFilterCount, type ProductFilters, type StockStatus } from '../../lib/productFilter'
import { productCategoryLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input, Select } from '../ui/Input'
import { Button } from '../ui/Button'

// The supplier filter has three states and a <select> only speaks strings:
// this sentinel is "any supplier" (filters.supplierId === null), while the
// empty string is the real, narrower "products with no supplier set".
const ALL_SUPPLIERS = '__all__'

/** The full filter set behind Inventory's Filter button — categories
 *  (multi-tick), price range, stock status, supplier, and missing-price-only. */
export function ProductFilterDialog({
  open,
  onClose,
  filters,
  onChange,
  categories,
  suppliers,
}: {
  open: boolean
  onClose: () => void
  filters: ProductFilters
  onChange: (filters: ProductFilters) => void
  categories: ProductCategory[]
  suppliers: Supplier[]
}) {
  const { t } = useTranslation()
  const filterCount = activeFilterCount(filters)

  const setFilter = <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => onChange({ ...filters, [key]: value })

  const toggleCategory = (name: string) =>
    onChange({
      ...filters,
      categories: filters.categories.includes(name) ? filters.categories.filter((c) => c !== name) : [...filters.categories, name],
    })

  return (
    <Dialog open={open} onClose={onClose} title={t('inventory.filterDialogTitle')} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
            {t('inventory.categoriesLabel')}
          </label>
          {/* Ticks, not a select: "all the engine oils" is three categories,
              and a single-choice dropdown can't express it. None ticked =
              every category, so the list starts unfiltered. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-accent shrink-0"
                  checked={filters.categories.includes(c.name)}
                  onChange={() => toggleCategory(c.name)}
                />
                <span className="truncate">{productCategoryLabel(c.name)}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
            {t('inventory.priceRangeLabel')}
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              mono
              placeholder={t('inventory.minPricePlaceholder')}
              value={filters.minPrice ?? ''}
              onChange={(e) => setFilter('minPrice', e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))}
            />
            <span className="text-fg-3">–</span>
            <Input
              type="number"
              min="0"
              mono
              placeholder={t('inventory.maxPricePlaceholder')}
              value={filters.maxPrice ?? ''}
              onChange={(e) => setFilter('maxPrice', e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label={t('inventory.stockStatusLabel')} value={filters.stockStatus} onChange={(e) => setFilter('stockStatus', e.target.value as StockStatus)}>
            <option value="all">{t('inventory.stockAll')}</option>
            <option value="in">{t('inventory.stockIn')}</option>
            <option value="out">{t('inventory.stockOut')}</option>
            <option value="low">{t('inventory.stockLow')}</option>
            <option value="oversold">{t('inventory.stockOversold')}</option>
          </Select>
          <Select
            label={t('inventory.supplierLabel')}
            value={filters.supplierId ?? ALL_SUPPLIERS}
            onChange={(e) => setFilter('supplierId', e.target.value === ALL_SUPPLIERS ? null : e.target.value)}
          >
            <option value={ALL_SUPPLIERS}>{t('inventory.allSuppliers')}</option>
            <option value="">{t('inventory.noSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            className="accent-accent"
            checked={filters.missingPriceOnly}
            onChange={(e) => setFilter('missingPriceOnly', e.target.checked)}
          />
          {t('inventory.missingPriceFilter')}
        </label>
      </div>
      <DialogFooter>
        <Button
          variant="ghost"
          // Keeps whatever is typed in the search box — that one has its own
          // visible control and isn't counted as a filter here.
          onClick={() => onChange({ ...NO_FILTERS, search: filters.search })}
          disabled={filterCount === 0}
        >
          {t('inventory.clearFilters')}
        </Button>
        <Button onClick={onClose}>{t('common.done')}</Button>
      </DialogFooter>
    </Dialog>
  )
}
