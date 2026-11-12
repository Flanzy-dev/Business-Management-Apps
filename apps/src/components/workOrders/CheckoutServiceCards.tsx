import { Plus } from 'lucide-react'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { WorkOrderItem } from '../../store/workOrderStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import type { ServiceSuggestion, SuggestionReason } from '../../lib/schedule/serviceSuggestions'
import { formatCurrency, formatNumber } from '../../lib/format/numbers'
import { serviceItemTypeLabel, serviceCatalogLabel } from '../../lib/format/entities'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'

/**
 * The shop's labor price list inside the checkout, as tap-to-add cards —
 * matching the product grid beside it so the two halves of the catalog read
 * as one system. Services the vehicle is due for get their own labeled
 * section up top, with the reason spelled out (see lib/schedule/serviceSuggestions.ts).
 */
export function CheckoutServiceCards({
  services,
  suggestions,
  items,
  onAdd,
  collapseTo,
  onShowAll,
}: {
  /** Already filtered by the search box and ranked by usage. */
  services: ServiceCatalogItem[]
  suggestions: ServiceSuggestion[]
  items: WorkOrderItem[]
  onAdd: (service: ServiceCatalogItem) => void
  /** Show only this many cards (due-now ones always count first), plus a
   *  "show all" button — keeps a long price list from pushing every product
   *  below the fold. Omit to show everything. */
  collapseTo?: number
  onShowAll?: () => void
}) {
  const { t } = useTranslation()

  // Suggestions are computed against the whole catalog, so intersect them with
  // what's visible — the search box filters the pinned cards too.
  const visibleIds = new Set(services.map(s => s.id))
  const suggested = suggestions.filter(s => visibleIds.has(s.service.id))
  const suggestedIds = new Set(suggested.map(s => s.service.id))
  const allRest = services.filter(s => !suggestedIds.has(s.id))
  const rest = collapseTo === undefined ? allRest : allRest.slice(0, Math.max(0, collapseTo - suggested.length))
  const hiddenCount = allRest.length - rest.length

  const onTicketQty = (service: ServiceCatalogItem) =>
    items
      .filter(i => !i.productId && i.description === service.name)
      .reduce((sum, i) => sum + i.quantity, 0)

  // One tap for everything the vehicle is due for that isn't on the ticket
  // yet — the usual case is "do what's due", and tapping each card was a
  // click per item.
  const dueNotOnTicket = suggested.filter(s => onTicketQty(s.service) === 0)

  return (
    <div>
      {suggested.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xs uppercase font-semibold tracking-wide text-fg-3">
              {t('workOrders.dueNowHeading')}
            </h3>
            {dueNotOnTicket.length > 1 && (
              <button
                type="button"
                onClick={() => dueNotOnTicket.forEach(s => onAdd(s.service))}
                className="flex items-center gap-1 text-sm text-accent hover:opacity-80 rounded-radius-xs focus-ring"
              >
                <Plus size={14} />
                {t('workOrders.addAllDue', { count: dueNotOnTicket.length })}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {suggested.map(({ service, reason }) => (
              <ServiceCard
                key={service.id}
                service={service}
                reason={reason}
                onTicket={onTicketQty(service)}
                onAdd={() => onAdd(service)}
              />
            ))}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className={suggested.length > 0 ? 'mt-4' : ''}>
          {suggested.length > 0 && (
            <h3 className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-2">
              {t('workOrders.allServicesHeading')}
            </h3>
          )}
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {rest.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                onTicket={onTicketQty(service)}
                onAdd={() => onAdd(service)}
              />
            ))}
          </div>
          {hiddenCount > 0 && onShowAll && (
            <button
              type="button"
              onClick={onShowAll}
              className="mt-2 text-sm text-accent hover:underline underline-offset-2 rounded-radius-xs focus-ring coarse:min-h-[44px]"
            >
              {t('workOrders.showAllServices', { count: services.length })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Tap-to-add service card: name, optional schedule tag, price, and why it's due (if it is). */
function ServiceCard({
  service,
  reason,
  onTicket,
  onAdd,
}: {
  service: ServiceCatalogItem
  reason?: SuggestionReason
  onTicket: number
  onAdd: () => void
}) {
  const { t } = useTranslation()
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)
  const taggedType = service.serviceItemTypeId
    ? serviceItemTypes.find(it => it.id === service.serviceItemTypeId)
    : undefined

  const reasonText =
    reason?.kind === 'overdue'
      ? t('workOrders.suggestedOverdue', { km: formatNumber(reason.byKm) })
      : reason?.kind === 'overdue_date'
        ? t('workOrders.suggestedOverdueDays', { days: reason.byDays })
        : reason?.kind === 'interval_elapsed'
          ? t('workOrders.suggestedIntervalElapsed', { km: formatNumber(reason.sinceKm) })
          : ''

  return (
    <button
      type="button"
      onClick={onAdd}
      title={serviceCatalogLabel(service.name)}
      className="
        relative flex flex-col justify-between text-left min-h-[72px] coarse:min-h-[80px] p-2.5
        bg-surface-sunken border border-border-2 rounded-radius-sm focus-ring
        hover:border-accent hover:bg-bg-4 active:bg-bg-4
        transition-colors duration-fast ease-out
      "
    >
      {onTicket > 0 && (
        <span
          title={t('workOrders.onTicketCount', { count: onTicket })}
          className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-radius-full bg-accent text-fg-inverse font-mono text-2xs font-semibold"
        >
          {onTicket}
        </span>
      )}

      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-fg-1 leading-snug pr-6 line-clamp-2">{serviceCatalogLabel(service.name)}</span>
        {reason && <span className="text-2xs text-danger tabular-nums">{reasonText}</span>}
      </span>

      {/* Price, then the schedule tag as quiet text beside it (not a chip on
          its own line — that line was most of why a card ran 96px tall). */}
      <span className="mt-1.5 flex items-center gap-2">
        {service.price > 0 ? (
          <span className="shrink-0 font-mono text-sm text-accent tabular-nums">{formatCurrency(service.price)}</span>
        ) : (
          <Badge tone="warning">{t('inventory.missingPriceBadge')}</Badge>
        )}
        {taggedType && (
          <span className="min-w-0 flex-1 truncate text-2xs text-fg-3" title={serviceItemTypeLabel(taggedType.name)}>
            {serviceItemTypeLabel(taggedType.name)}
          </span>
        )}
        {/* Purely decorative — the whole card is the one and only click
            target (see CheckoutServiceCards docblock). A nested <button>
            here would double-fire onAdd on bubble, which is the bug this
            replaced (src/components/workOrders/CheckoutServiceTable.tsx). */}
        <span
          aria-hidden="true"
          className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-radius-full bg-accent-muted text-accent shrink-0"
        >
          <Plus size={14} />
        </span>
      </span>
    </button>
  )
}
