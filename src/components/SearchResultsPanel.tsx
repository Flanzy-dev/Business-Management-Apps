import type { ServiceItemType } from '../store/serviceItemTypeStore'
import type { SearchResult } from '../lib/globalSearch'
import { useTranslation } from '../lib/i18n'
import { SearchResultRow } from './SearchResultRow'

/** The three states of the results pane: "type more" below the 2-character
 *  floor, "nothing matched", or the list itself. */
export function SearchResultsPanel({
  query,
  results,
  selectedIndex,
  serviceItemTypes,
  onSelect,
}: {
  query: string
  results: SearchResult[]
  selectedIndex: number
  serviceItemTypes: ServiceItemType[]
  onSelect: (result: SearchResult) => void
}) {
  const { t } = useTranslation()

  if (query.length < 2) {
    return <div className="px-4 py-8 text-center text-text-secondary text-sm">{t('globalSearch.typeToSearch')}</div>
  }
  if (results.length === 0) {
    return <div className="px-4 py-8 text-center text-text-secondary text-sm">{t('globalSearch.noResultsFound', { query })}</div>
  }
  return (
    <div className="py-2">
      {results.map((result, index) => (
        <SearchResultRow
          key={`${result.type}-${result.id}`}
          result={result}
          selected={index === selectedIndex}
          serviceItemTypes={serviceItemTypes}
          onSelect={() => onSelect(result)}
        />
      ))}
    </div>
  )
}
