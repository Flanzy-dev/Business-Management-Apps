import { useMemo, useState } from 'react'
import { Filter, Plus, Search } from 'lucide-react'
import type { ProductWithStock } from '../../lib/stockLedger'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { WorkOrderItem } from '../../store/workOrderStore'
import { useProductStock } from '../../hooks/useProductStock'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { ALL_CATEGORIES, SERVICES_CATEGORY, filterVisibleServices, filterVisibleProducts, singleAddableMatch } from '../../lib/checkoutCatalogFilter'
import { ServiceSuggestion } from '../../lib/serviceSuggestions'
import { productCategoryLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { DropdownMenu } from '../ui/DropdownMenu'
import { CatalogEmptyState } from './CatalogEmptyState'
import { ServicesSection } from './ServicesSection'
import { ProductGrid } from './ProductGrid'

interface CheckoutCatalogProps {
  /** The ticket's current lines — drives the on-ticket badge and the stock left per tile. */
  items: WorkOrderItem[]
  /** What this vehicle is due for, already ranked — see src/lib/serviceSuggestions.ts. */
  suggestions: ServiceSuggestion[]
  /** How often each service has been sold, keyed by name; orders the service rows. */
  serviceUsage: Map<string, number>
  onAddProduct: (product: ProductWithStock) => void
  onAddService: (service: ServiceCatalogItem) => void
  onCustomItem: () => void
  /** Double-clicking a sold-out tile calls this instead of onAddProduct — see ProductTile. */
  onRestockProduct: (product: ProductWithStock) => void
}

/**
 * Register-style picker for everything the shop sells: a search box and a
 * category filter button over the service price list (tap-to-add cards, with
 * what the vehicle is due for in their own section up top) and the product
 * catalog (tap-to-add tiles carrying stock). Under "All" both share one
 * scrolling pane instead of two stacked panes with their own scrollbars, so
 * the picker reads as one system rather than two. One tap adds a line,
 * tapping again bumps its quantity (the parent decides — see WorkOrderEditor).
 */
export function CheckoutCatalog({
  items,
  suggestions,
  serviceUsage,
  onAddProduct,
  onAddService,
  onCustomItem,
  onRestockProduct,
}: CheckoutCatalogProps) {
  const { t } = useTranslation()
  const products = useProductStock()
  const categories = useProductCategoryStore(s => s.categories)
  const services = useServiceCatalogStore(s => s.services)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)

  const query = search.trim().toLowerCase()

  const visibleServices = useMemo(
    () => filterVisibleServices(services, category, query, serviceUsage),
    [services, category, query, serviceUsage]
  )

  const visibleProducts = useMemo(() => filterVisibleProducts(products, category, query), [products, category, query])

  // Typing two letters and hitting Enter is the register habit — when the
  // search narrows to a single addable tile, commit it without reaching for
  // the mouse and clear the box for the next line.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const match = singleAddableMatch(visibleServices, visibleProducts, items)
    if (!match) return
    e.preventDefault()
    if (match.kind === 'service') onAddService(match.service)
    else onAddProduct(match.product)
    setSearch('')
  }

  const showingServicesOnly = category === SERVICES_CATEGORY
  const showServices = category === ALL_CATEGORIES || showingServicesOnly
  const showProducts = !showingServicesOnly
  const showingAll = category === ALL_CATEGORIES

  const categoryLabel = (value: string) =>
    value === ALL_CATEGORIES
      ? t('workOrders.categoryAll')
      : value === SERVICES_CATEGORY
        ? t('workOrders.servicesSectionLabel')
        : productCategoryLabel(value)

  const noResultsAtAll = visibleServices.length === 0 && visibleProducts.length === 0

  return (
    <div className="bg-surface-card rounded-radius-md p-4 flex flex-col min-h-0">
      <div className="shrink-0 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('workOrders.searchProductsPlaceholder')}
            className="w-full h-[40px] pl-9 pr-3 bg-surface-input border border-border-2 rounded-radius-sm text-fg-1 text-sm placeholder-fg-3 focus-ring"
          />
        </div>

        {/* Category picker, compiled into one filter button next to search
            rather than a pill row — the pill list grew one entry per product
            category and was starting to wrap on narrower panes. */}
        <DropdownMenu
          align="left"
          trigger={({ onClick }) => (
            <Button variant="secondary" size="md" icon={Filter} onClick={onClick} className="h-[40px] whitespace-nowrap">
              {categoryLabel(category)}
            </Button>
          )}
          items={[
            { label: t('workOrders.categoryAll'), selected: category === ALL_CATEGORIES, onClick: () => setCategory(ALL_CATEGORIES) },
            { label: t('workOrders.servicesSectionLabel'), selected: category === SERVICES_CATEGORY, onClick: () => setCategory(SERVICES_CATEGORY) },
            ...categories.map(c => ({
              label: productCategoryLabel(c.name),
              selected: category === c.name,
              onClick: () => setCategory(c.name),
            })),
          ]}
        />
      </div>

      {/* One scroll pane for whatever the filter/search narrowed to — under
          "All" that's services followed by products, sharing one scrollbar
          instead of two independently-scrolling regions stacked on top of
          each other. Section labels only show up under "All", where both
          groups share the pane and need telling apart; a single-category
          view (Services, or one product category) is unambiguous without them. */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4">
        {noResultsAtAll ? (
          <CatalogEmptyState showingServicesOnly={showingServicesOnly} hasQuery={!!query} />
        ) : (
          <>
            {showServices && visibleServices.length > 0 && (
              <ServicesSection
                services={visibleServices}
                // Only on "All"/"Services": picking a product category is a
                // deliberate "show me just this category," so re-ordering
                // around what this car is due for would fight the request —
                // moot there anyway, since a product category has no services.
                suggestions={showingAll ? suggestions : []}
                items={items}
                showSectionLabel={showingAll}
                onAdd={onAddService}
              />
            )}

            {showProducts && visibleProducts.length > 0 && (
              <ProductGrid
                products={visibleProducts}
                items={items}
                showSectionLabel={showingAll}
                onAdd={onAddProduct}
                onRestock={onRestockProduct}
              />
            )}
          </>
        )}
      </div>

      <div className="shrink-0 pt-4 mt-1 border-t border-border-1 flex justify-end">
        <Button variant="secondary" size="touch" icon={Plus} onClick={onCustomItem}>
          {t('workOrders.customItem')}
        </Button>
      </div>
    </div>
  )
}
