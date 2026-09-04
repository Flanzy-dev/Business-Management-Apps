import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { WorkOrderItem } from '../../store/workOrderStore'
import type { ServiceSuggestion } from '../../lib/serviceSuggestions'
import { useTranslation } from '../../lib/i18n'
import { CheckoutServiceCards } from './CheckoutServiceCards'

/** The catalog pane's services group — a section label only shows up under
 *  "All", where products share the pane and the two groups need telling apart. */
export function ServicesSection({
  services,
  suggestions,
  items,
  showSectionLabel,
  onAdd,
}: {
  services: ServiceCatalogItem[]
  suggestions: ServiceSuggestion[]
  items: WorkOrderItem[]
  showSectionLabel: boolean
  onAdd: (service: ServiceCatalogItem) => void
}) {
  const { t } = useTranslation()

  return (
    <div>
      {showSectionLabel && (
        <h3 className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-2">
          {t('workOrders.servicesSectionLabel')}
        </h3>
      )}
      <CheckoutServiceCards services={services} suggestions={suggestions} items={items} onAdd={onAdd} />
    </div>
  )
}
