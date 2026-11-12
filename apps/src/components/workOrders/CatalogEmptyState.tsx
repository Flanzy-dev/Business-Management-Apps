import { PackageSearch, Wrench } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { useTranslation } from '../../lib/i18n'

/**
 * Services-only with an empty catalog and no search typed is "you haven't
 * added any services yet," not "nothing matched" — every other empty case
 * (a search, or an empty product category) is.
 */
export function CatalogEmptyState({
  showingServicesOnly,
  hasQuery,
}: {
  showingServicesOnly: boolean
  hasQuery: boolean
}) {
  const { t } = useTranslation()

  if (showingServicesOnly && !hasQuery) {
    return (
      <EmptyState
        icon={Wrench}
        title={t('workOrders.catalogNoServices')}
        message={t('workOrders.catalogNoServicesHint')}
      />
    )
  }

  return (
    <EmptyState
      icon={showingServicesOnly ? Wrench : PackageSearch}
      title={t('workOrders.catalogNoMatch')}
      message={t('workOrders.catalogNoMatchHint')}
    />
  )
}
