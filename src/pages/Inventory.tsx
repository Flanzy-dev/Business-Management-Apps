import { useMemo, useState } from 'react'
import { useSupplierStore } from '../store/supplierStore'
import { useProductCategoryStore } from '../store/productCategoryStore'
import { useServiceCatalogStore } from '../store/serviceCatalogStore'
import { useProductStock } from '../hooks/useProductStock'
import { useInventoryValuation } from '../hooks/useInventoryValuation'
import type { ProductWithStock } from '../lib/stockLedger'
import { isLowStock } from '../lib/stockLedger'
import { NO_FILTERS, DEFAULT_SORT, activeFilterCount, filterProducts, sortProducts, type ProductFilters, type SortState } from '../lib/productFilter'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { deleteProductChecked } from '../lib/ops/entityOps'
import { deleteOutcomeToast } from '../lib/deleteOutcome'
import { useTranslation } from '../lib/i18n'
import { useMode } from '../store/authStore'
import { canSeeCostAndProfit, canMutateInventory, canSeeSupplierCode } from '../lib/auth/permissions'
import { Badge } from '../components/ui/Badge'
import { Plus, Filter } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { ServiceCatalogTable } from '../components/inventory/ServiceCatalogTable'
import { ProductFormDialog } from '../components/inventory/ProductFormDialog'
import { AdjustStockDialog } from '../components/inventory/AdjustStockDialog'
import { PriceHistoryDialog } from '../components/inventory/PriceHistoryDialog'
import { ReconcileStockDialog } from '../components/inventory/ReconcileStockDialog'
import { ProductTable } from '../components/inventory/ProductTable'
import { ProductFilterDialog } from '../components/inventory/ProductFilterDialog'
import { LowStockBanner } from '../components/inventory/LowStockBanner'
import { Input } from '../components/ui/Input'

export default function Inventory() {
  const { t } = useTranslation()
  // Worker mode: view stock levels and sell price, no cost, no editing, no
  // supplier code. Separate calls to src/lib/auth/permissions.ts rather
  // than one "isAdmin" flag, so each right can diverge later without a
  // find-and-replace across this file. Sell price itself is NOT gated —
  // only cost is — a worker quoting or ringing up a customer needs to see
  // it; cost is the margin-sensitive figure.
  const mode = useMode()
  const canSeeCost = canSeeCostAndProfit(mode)
  const canMutate = canMutateInventory(mode)
  const showSupplierCode = canSeeSupplierCode(mode)
  const products = useProductStock()
  const { suppliers } = useSupplierStore()
  const { categories } = useProductCategoryStore()
  const services = useServiceCatalogStore((s) => s.services)
  const { unitCostOf } = useInventoryValuation()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  const [tab, setTab] = useState<'products' | 'services'>('products')
  const [creatingService, setCreatingService] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [editing, setEditing] = useState<ProductWithStock | null>(null)
  const [adjustingProduct, setAdjustingProduct] = useState<ProductWithStock | null>(null)
  const [historyProduct, setHistoryProduct] = useState<ProductWithStock | null>(null)
  const [reconcilingProduct, setReconcilingProduct] = useState<ProductWithStock | null>(null)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  // One object rather than a state per filter: the Filter dialog, the
  // low-stock banner and the badge count all read the same thing, so they
  // can't drift out of agreement (see src/lib/productFilter.ts).
  const [filters, setFilters] = useState<ProductFilters>(NO_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)

  const setFilter = <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) =>
    setFilters(prev => ({ ...prev, [key]: value }))

  const lowStockProducts = useMemo(() => products.filter(isLowStock), [products])
  const filterCount = activeFilterCount(filters)

  const openCreate = () => {
    setEditing(null)
    setShowModal(true)
  }

  const openEdit = (p: ProductWithStock) => {
    setEditing(p)
    setShowModal(true)
  }

  const openAdjust = (p: ProductWithStock) => {
    setAdjustingProduct(p)
    setShowAdjustModal(true)
  }

  const handleDelete = (id: string) => {
    requestConfirm(
      { title: t('inventory.deleteConfirmTitle'), message: t('inventory.deleteConfirmMessage') },
      () => {
        const result = deleteProductChecked(id)
        const toast = deleteOutcomeToast(result, { cannotDeleteTitle: t('inventory.cannotDeleteTitle') })
        if (toast) showToast(toast)
      }
    )
  }

  // Built once per supplier-list change so neither the Supplier column render
  // nor the sort comparator does an O(n) .find() per product.
  const supplierNameById = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers])
  const getSupplierName = (id: string | null) => (id && supplierNameById.get(id)) || '-'

  // Filter then sort — sorting the smaller list is cheaper, and the Cost and
  // Supplier columns aren't stored on the product, so the two closures here
  // are what makes them sortable at all. Memoized: this used to re-run (and
  // re-sort) on every render, with a supplier .find() inside the comparator.
  const filtered = useMemo(
    () => sortProducts(filterProducts(products, filters), sort, {
      costOf: unitCostOf,
      supplierNameOf: p => (p.supplierId && supplierNameById.get(p.supplierId)) || '-',
    }),
    [products, filters, sort, unitCostOf, supplierNameById],
  )

  return (
    <div>
      <PageHeader
        title={t('inventory.title')}
        action={
          !canMutate ? undefined : tab === 'products' ? (
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              {t('inventory.addProduct')}
            </Button>
          ) : (
            <Button variant="primary" icon={Plus} onClick={() => setCreatingService(true)}>
              {t('inventory.addService')}
            </Button>
          )
        }
      />

      {/* Parts the shop stocks vs. the labor it charges for — one price list,
          two tabs. Services hold no stock, hence no low-stock banner or
          category filter on that side. */}
      <Tabs
        className="mb-4"
        value={tab}
        onChange={v => setTab(v as typeof tab)}
        tabs={[
          { value: 'products', label: t('inventory.tabProducts'), count: products.length },
          { value: 'services', label: t('inventory.tabServices'), count: services.length },
        ]}
      />

      {tab === 'services' ? (
        <ServiceCatalogTable creating={creatingService} onCreatingChange={setCreatingService} readOnly={!canMutate} />
      ) : (
        <>
          <LowStockBanner
            count={lowStockProducts.length}
            showingOnlyLow={filters.stockStatus === 'low'}
            onToggle={() => setFilter('stockStatus', filters.stockStatus === 'low' ? 'all' : 'low')}
          />

          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('inventory.searchPlaceholder')}
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
              />
            </div>
            <Button variant="secondary" icon={Filter} onClick={() => setShowFilterDialog(true)}>
              {t('inventory.filterButton')}
              {filterCount > 0 && <Badge tone="accent">{filterCount}</Badge>}
            </Button>
          </div>

          <ProductTable
            products={filtered}
            emptyFiltered={!!filters.search || filterCount > 0}
            sort={sort}
            onSortChange={setSort}
            canSeeCost={canSeeCost}
            canMutate={canMutate}
            showSupplierCode={showSupplierCode}
            unitCostOf={unitCostOf}
            getSupplierName={getSupplierName}
            onEdit={openEdit}
            onDelete={handleDelete}
            onAdjust={openAdjust}
            onReconcile={setReconcilingProduct}
            onShowHistory={setHistoryProduct}
          />
        </>
      )}

      <ProductFormDialog open={showModal} product={editing} onClose={() => setShowModal(false)} />

      <AdjustStockDialog open={showAdjustModal} product={adjustingProduct} onClose={() => setShowAdjustModal(false)} />

      {historyProduct && (
        <PriceHistoryDialog open product={historyProduct} onClose={() => setHistoryProduct(null)} />
      )}

      <ReconcileStockDialog open={!!reconcilingProduct} product={reconcilingProduct} onClose={() => setReconcilingProduct(null)} />

      <ProductFilterDialog
        open={showFilterDialog}
        onClose={() => setShowFilterDialog(false)}
        filters={filters}
        onChange={setFilters}
        categories={categories}
        suppliers={suppliers}
      />
    </div>
  )
}
