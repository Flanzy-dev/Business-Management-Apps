import { useMemo, useState } from 'react'
import { PackageSearch, Plus, Search, Wrench } from 'lucide-react'
import type { ProductWithStock } from '../../lib/stockLedger'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { WorkOrderItem } from '../../store/workOrderStore'
import { useProductStock } from '../../hooks/useProductStock'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { remainingStock } from '../../lib/orderLifecycle'
import { rankServicesByUsage, ServiceSuggestion } from '../../lib/serviceSuggestions'
import { formatCurrency } from '../../lib/currency'
import { productCategoryLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Tabs } from '../ui/Tabs'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { CheckoutServiceCards } from './CheckoutServiceCards'

const ALL_CATEGORIES = '__all__'
const SERVICES_CATEGORY = '__services__'

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
}

/**
 * Register-style picker for everything the shop sells: search + category pills
 * over the service price list (tap-to-add cards, with what the vehicle is due
 * for in their own section up top) and the product catalog (tap-to-add tiles
 * carrying stock) — one card grid for both, so the pane reads as one system.
 * One tap adds a line, tapping again bumps its quantity (the parent decides —
 * see WorkOrderEditor).
 */
export function CheckoutCatalog({
  items,
  suggestions,
  serviceUsage,
  onAddProduct,
  onAddService,
  onCustomItem,
}: CheckoutCatalogProps) {
  const { t } = useTranslation()
  const products = useProductStock()
  const categories = useProductCategoryStore(s => s.categories)
  const services = useServiceCatalogStore(s => s.services)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)

  const query = search.trim().toLowerCase()

  const visibleServices = useMemo(
    () =>
      category !== ALL_CATEGORIES && category !== SERVICES_CATEGORY
        ? []
        : rankServicesByUsage(
            services.filter(s => !query || s.name.toLowerCase().includes(query)),
            serviceUsage
          ),
    [services, category, query, serviceUsage]
  )

  const visibleProducts = useMemo(
    () =>
      category === SERVICES_CATEGORY
        ? []
        : products.filter(p => {
            // Product.category stores the plain category *name*, not an id.
            if (category !== ALL_CATEGORIES && p.category !== category) return false
            if (!query) return true
            return p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)
          }),
    [products, category, query]
  )

  // Typing two letters and hitting Enter is the register habit — when the
  // search narrows to a single addable tile, commit it without reaching for
  // the mouse and clear the box for the next line.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const addableProducts = visibleProducts.filter(p => remainingStock(items, p) > 0)
    if (addableProducts.length + visibleServices.length !== 1) return
    e.preventDefault()
    if (visibleServices.length === 1) onAddService(visibleServices[0])
    else onAddProduct(addableProducts[0])
    setSearch('')
  }

  const showingServicesOnly = category === SERVICES_CATEGORY
  const showServices = category === ALL_CATEGORIES || showingServicesOnly
  const showProducts = !showingServicesOnly

  return (
    <div className="bg-surface-card rounded-radius-md p-4 flex flex-col min-h-0">
      <div className="shrink-0 space-y-3">
        <div className="relative">
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

        <Tabs
          variant="pill"
          value={category}
          onChange={setCategory}
          tabs={[
            { value: ALL_CATEGORIES, label: t('workOrders.categoryAll') },
            { value: SERVICES_CATEGORY, label: t('workOrders.servicesSectionLabel') },
            ...categories.map(c => ({ value: c.name, label: productCategoryLabel(c.name) })),
          ]}
        />
      </div>

      {/* Services. Under "All" the card grid is capped so a long price list
          can never push the product tiles off-screen; under its own pill it
          takes the pane. A product category has no services in it, so it
          shows none. */}
      {showServices && (
        <div
          className={`mt-4 overflow-y-auto ${showingServicesOnly ? 'flex-1 min-h-0' : 'shrink-0 max-h-[45%]'}`}
        >
          {visibleServices.length === 0 ? (
            showingServicesOnly ? (
              <EmptyState
                icon={Wrench}
                title={t(query ? 'workOrders.catalogNoMatch' : 'workOrders.catalogNoServices')}
                message={t(query ? 'workOrders.catalogNoMatchHint' : 'workOrders.catalogNoServicesHint')}
              />
            ) : (
              // Under "All" the product grid is right below, so a full empty
              // state here would just eat the pane.
              !query && (
                <p className="text-xs text-fg-3">
                  {t('workOrders.catalogNoServices')} — {t('workOrders.catalogNoServicesHint')}
                </p>
              )
            )
          ) : (
            <CheckoutServiceCards
              services={visibleServices}
              // Only on the default pill: picking "Services" is a deliberate
              // "show me the whole price list", so re-ordering it around what
              // this car is due for would fight the request.
              suggestions={category === ALL_CATEGORIES ? suggestions : []}
              items={items}
              onAdd={onAddService}
            />
          )}
        </div>
      )}

      {showProducts && (
        <div className="flex-1 min-h-0 overflow-y-auto mt-4">
          {visibleProducts.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title={t('workOrders.catalogNoMatch')}
              message={t('workOrders.catalogNoMatchHint')}
            />
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {visibleProducts.map(product => (
                <ProductTile
                  key={product.id}
                  product={product}
                  onTicket={items
                    .filter(i => i.productId === product.id)
                    .reduce((sum, i) => sum + i.quantity, 0)}
                  remaining={remainingStock(items, product)}
                  onAdd={() => onAddProduct(product)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="shrink-0 pt-4 mt-1 border-t border-border-1 flex justify-end">
        <Button variant="secondary" size="touch" icon={Plus} onClick={onCustomItem}>
          {t('workOrders.customItem')}
        </Button>
      </div>
    </div>
  )
}

/** Tap-to-add product tile: name, price, and what's left on the shelf. */
function ProductTile({
  product,
  onTicket,
  remaining,
  onAdd,
}: {
  product: ProductWithStock
  onTicket: number
  remaining: number
  onAdd: () => void
}) {
  const { t } = useTranslation()
  const soldOut = remaining <= 0
  const lowStock = product.qtyOnHand <= product.reorderPoint

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={soldOut}
      title={product.name}
      className={`
        relative flex flex-col justify-between text-left min-h-[96px] p-3
        bg-surface-sunken border rounded-radius-sm focus-ring
        transition-colors duration-fast ease-out
        ${soldOut
          ? 'border-border-1 opacity-45 cursor-not-allowed'
          : 'border-border-2 hover:border-accent hover:bg-bg-4 active:bg-bg-4 cursor-pointer'}
      `}
    >
      {onTicket > 0 && (
        <span
          title={t('workOrders.onTicketCount', { count: onTicket })}
          className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-radius-full bg-accent text-fg-inverse font-mono text-2xs font-semibold"
        >
          {onTicket}
        </span>
      )}

      <span className="text-sm text-fg-1 leading-snug pr-6 line-clamp-2">{product.name}</span>

      <span className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm text-accent tabular-nums">{formatCurrency(product.sellPrice)}</span>
        <span
          className={`text-2xs tabular-nums ${soldOut ? 'text-danger' : lowStock ? 'text-warning' : 'text-fg-3'}`}
        >
          {soldOut
            ? t('workOrders.outOfStockBadge')
            : t('workOrders.stockLabel', { qty: product.qtyOnHand, unit: product.unit })}
        </span>
      </span>
    </button>
  )
}
