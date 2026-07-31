import { useState } from 'react'
import { useStockLotStore } from '../store/stockLotStore'
import { useStockMovementStore } from '../store/stockMovementStore'
import { useSupplierStore } from '../store/supplierStore'
import { useProductCategoryStore } from '../store/productCategoryStore'
import { useServiceCatalogStore } from '../store/serviceCatalogStore'
import { useProductStock } from '../hooks/useProductStock'
import type { ProductWithStock } from '../lib/stockLedger'
import { lotsByProduct } from '../lib/stockLedger'
import { averageUnitCost } from '../lib/inventoryCosting'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { deleteProductChecked } from '../lib/ops/entityOps'
import { rowEditOnDoubleClick } from '../lib/rowInteraction'
import { formatCurrency } from '../lib/currency'
import { productCategoryLabel, unitLabel } from '../lib/entities'
import { useTranslation } from '../lib/i18n'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Badge } from '../components/ui/Badge'
import { Pencil, Trash2, PackagePlus, Plus, Package, History, Scale } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { ServiceCatalogTable } from '../components/inventory/ServiceCatalogTable'
import { ProductFormDialog } from '../components/inventory/ProductFormDialog'
import { AdjustStockDialog } from '../components/inventory/AdjustStockDialog'
import { PriceHistoryDialog } from '../components/inventory/PriceHistoryDialog'
import { ReconcileStockDialog } from '../components/inventory/ReconcileStockDialog'
import { Input, Select } from '../components/ui/Input'

export default function Inventory() {
  const { t } = useTranslation()
  const products = useProductStock()
  const { suppliers } = useSupplierStore()
  const { categories } = useProductCategoryStore()
  const services = useServiceCatalogStore((s) => s.services)
  const stockLots = useStockLotStore((s) => s.stockLots)
  const movements = useStockMovementStore((s) => s.movements)
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
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showLowStock, setShowLowStock] = useState(false)

  const lowStockProducts = products.filter(p => p.qtyOnHand <= p.reorderPoint)

  let filtered = showLowStock ? lowStockProducts : products
  filtered = filtered.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !filterCategory || p.category === filterCategory
    return matchesSearch && matchesCategory
  })

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
        if (!result.ok) {
          showToast({ tone: 'warning', title: t('inventory.cannotDeleteTitle'), description: result.reason })
        }
      }
    )
  }

  /**
   * What the stock actually on hand cost, per unit — a blend when it came in
   * on batches at different prices. Falls back to the product's own cost price
   * for stock with no lot behind it.
   */
  const unitCostOf = (p: ProductWithStock) =>
    averageUnitCost(lotsByProduct(stockLots, movements, p.id)) ?? p.costPrice

  const getSupplierName = (id: string | null) => {
    if (!id) return '-'
    const s = suppliers.find(x => x.id === id)
    return s?.name || '-'
  }


  return (
    <div>
      <PageHeader
        title={t('inventory.title')}
        action={
          tab === 'products' ? (
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
        <ServiceCatalogTable creating={creatingService} onCreatingChange={setCreatingService} />
      ) : (
      <>
      {lowStockProducts.length > 0 && (
        <div className="bg-danger-muted border-l-4 border-danger p-4 mb-4 rounded-radius-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-danger">{t('inventory.lowStockAlertLabel')}</span>
              <span className="ml-2 text-text-secondary">{t('inventory.lowStockItemsNeed', { count: lowStockProducts.length })}</span>
            </div>
            <button
              onClick={() => setShowLowStock(!showLowStock)}
              className="text-danger hover:opacity-80 text-sm"
            >
              {showLowStock ? t('inventory.showAll') : t('inventory.showLowStockOnly')}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={t('inventory.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">{t('inventory.allCategories')}</option>
            {categories.map(c => <option key={c.id} value={c.name}>{productCategoryLabel(c.name)}</option>)}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search || filterCategory ? t('inventory.emptyTitleFiltered') : t('inventory.emptyTitleNone')}
          message={search || filterCategory ? t('inventory.emptyMessageFiltered') : t('inventory.emptyMessageNone')}
        />
      ) : (
        <div className="bg-surface-card rounded-radius-md overflow-auto max-h-[70vh]">
          <table className="w-full">
            <thead className="bg-surface-sunken border-b border-border-subtle sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.colName')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.colSku')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.colCategory')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colCost')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colPrice')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colStock')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.colSupplier')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} {...rowEditOnDoubleClick(() => openEdit(p))} className={`border-t border-border-subtle hover:bg-surface-sunken ${p.qtyOnHand <= p.reorderPoint ? 'bg-danger-muted' : ''}`}>
                  <td className="p-3 font-medium text-text-primary">{p.name}</td>
                  <td className="p-3 font-mono text-sm text-text-secondary">{p.sku || '-'}</td>
                  <td className="p-3 text-text-secondary">{productCategoryLabel(p.category)}</td>
                  <td className="p-3 text-right font-mono text-text-secondary tabular-nums">{formatCurrency(Math.round(unitCostOf(p)))}</td>
                  <td className="p-3 text-right font-mono font-medium text-text-primary tabular-nums">{formatCurrency(p.sellPrice)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {/* grid, not inline text-align:right — the badge column is flexible/left, the
                        qty+unit column is auto-sized and always anchored to the cell's right edge,
                        so the qty number lines up row-to-row whether or not the badge renders. */}
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <span className="flex justify-end">
                        {p.qtyOnHand < 0 ? (
                          // Negative stock — a real oversell (see stockLedger.ts's
                          // negativeStockProducts), not just "running low", so it
                          // gets its own badge rather than collapsing into "Low".
                          <Badge tone="danger">{t('inventory.negativeStockBadge')}</Badge>
                        ) : (
                          p.qtyOnHand <= p.reorderPoint && <Badge tone="danger">{t('inventory.lowBadge')}</Badge>
                        )}
                      </span>
                      <span className="flex items-baseline gap-1">
                        <span className={`font-mono tabular-nums ${p.qtyOnHand <= p.reorderPoint ? 'text-danger font-medium' : 'text-text-primary'}`}>
                          {p.qtyOnHand}
                        </span>
                        <span className="text-text-secondary text-sm">{unitLabel(p.unit)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-text-secondary">{getSupplierName(p.supplierId)}</td>
                  <td className="p-3 text-right">
                    <DropdownMenu
                      items={[
                        { label: t('inventory.adjustStockAction'), icon: PackagePlus, onClick: () => openAdjust(p) },
                        ...(p.qtyOnHand < 0
                          ? [{ label: t('inventory.reconcileAction'), icon: Scale, onClick: () => setReconcilingProduct(p) }]
                          : []),
                        { label: t('inventory.priceHistoryAction'), icon: History, onClick: () => setHistoryProduct(p) },
                        { label: t('common.edit'), icon: Pencil, onClick: () => openEdit(p) },
                        { label: t('common.delete'), icon: Trash2, onClick: () => handleDelete(p.id), variant: 'danger' },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      <ProductFormDialog open={showModal} product={editing} onClose={() => setShowModal(false)} />

      <AdjustStockDialog open={showAdjustModal} product={adjustingProduct} onClose={() => setShowAdjustModal(false)} />

      {historyProduct && (
        <PriceHistoryDialog open product={historyProduct} onClose={() => setHistoryProduct(null)} />
      )}

      <ReconcileStockDialog open={!!reconcilingProduct} product={reconcilingProduct} onClose={() => setReconcilingProduct(null)} />
    </div>
  )
}
