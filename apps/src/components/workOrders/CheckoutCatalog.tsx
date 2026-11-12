import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { ProductWithStock } from '../../lib/inventory/stockLedger'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { WorkOrderItem } from '../../store/workOrderStore'
import { useProductStock } from '../../hooks/useProductStock'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { ALL_CATEGORIES, SERVICES_CATEGORY, filterVisibleServices, filterVisibleProducts, singleAddableMatch } from '../../lib/orders/checkoutCatalogFilter'
import { ServiceSuggestion } from '../../lib/schedule/serviceSuggestions'
import { splitFrequentProducts } from '../../lib/orders/productUsage'
import { productCategoryLabel } from '../../lib/format/entities'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { CatalogCategoryChips } from './CatalogCategoryChips'
import { CatalogEmptyState } from './CatalogEmptyState'
import { ServicesSection } from './ServicesSection'
import { ProductList } from './ProductList'
import { isTouchPrimary } from '../../lib/app/environment'
import { Input } from '../ui/Input'

/** How many best sellers get pinned above the A–Z product list. */
const FREQUENT_LIMIT = 8
/** Services shown under "All" before the "show all" button — the shop's price
 *  list is long enough to fill the pane and hide every product otherwise. */
const SERVICES_COLLAPSED_COUNT = 6

interface CheckoutCatalogProps {
  /** The ticket's current lines — drives the on-ticket badge and the stock left per tile. */
  items: WorkOrderItem[]
  /** What this vehicle is due for, already ranked — see src/lib/schedule/serviceSuggestions.ts. */
  suggestions: ServiceSuggestion[]
  /** How often each service has been sold, keyed by name; orders the service rows. */
  serviceUsage: Map<string, number>
  /** How often each product has sold (product id → count); the best sellers are pinned on top. */
  productUsage: Map<string, number>
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
  productUsage,
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
  const [servicesExpanded, setServicesExpanded] = useState(false)

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
    const match = singleAddableMatch(visibleServices, visibleProducts, items, query)
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
  // A search or the Services chip is a request to see services, so they only
  // collapse in the plain "All" view.
  const collapseServices = showingAll && !query && !servicesExpanded

  // Best sellers pinned above the A–Z list — only under "All" with nothing
  // typed: a search or a chosen category is a deliberate narrowing, and
  // re-ordering it around popularity would fight the request.
  const { frequent, rest } = useMemo(
    () => (showingAll && !query ? splitFrequentProducts(visibleProducts, productUsage, FREQUENT_LIMIT) : { frequent: [], rest: visibleProducts }),
    [showingAll, query, visibleProducts, productUsage]
  )

  const chips = [
    { value: ALL_CATEGORIES, label: t('workOrders.categoryAll') },
    { value: SERVICES_CATEGORY, label: t('workOrders.servicesSectionLabel') },
    ...categories.map(c => ({ value: c.name, label: productCategoryLabel(c.name) })),
  ]

  const noResultsAtAll = visibleServices.length === 0 && visibleProducts.length === 0

  return (
    <div className="bg-surface-card border border-border-2 rounded-radius-md p-4 flex flex-col min-h-0">
      <div className="shrink-0 flex gap-2 mb-3">
        <div className="flex-1">
          <Input
            type="text"
            leadingIcon={Search}
            // Not on a tablet: the on-screen keyboard would cover the catalog.
            autoFocus={!isTouchPrimary()}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('workOrders.searchProductsPlaceholder')}
            aria-label={t('workOrders.searchProductsPlaceholder')}
          />
        </div>
      </div>

      {/* Category filter: every category one tap away, scrolling sideways
          (no bar) rather than wrapping, so the catalog below never shifts. */}
      <CatalogCategoryChips
        chips={chips}
        value={category}
        onChange={setCategory}
        label={t('workOrders.categoryFilterLabel')}
      />

      {/* One scroll pane for whatever the filter/search narrowed to — under
          "All" that's services followed by products, sharing one scrollbar
          instead of two independently-scrolling regions stacked on top of
          each other. Section labels only show up under "All", where both
          groups share the pane and need telling apart; a single-category
          view (Services, or one product category) is unambiguous without them. */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-4">
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
                collapseTo={collapseServices ? SERVICES_COLLAPSED_COUNT : undefined}
                onShowAll={() => setServicesExpanded(true)}
              />
            )}

            {showProducts && visibleProducts.length > 0 && (
              <ProductList
                products={rest}
                frequent={frequent}
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
