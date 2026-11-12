import { Pencil, UserPlus } from 'lucide-react'
import type { Company, Driver } from '../../store/companyStore'
import type { useExpandOrEdit } from '../../lib/app/rowInteraction'
import { useTranslation } from '../../lib/i18n'
import { RowActions } from '../ui/RowActions'
import { DriversTable } from './DriversTable'
import { Button } from '../ui/Button'

/** One company card on the Companies page — the collapsed summary row, and,
 *  when expanded, its contact details and drivers table. */
export function CompanyRow({
  company,
  expanded,
  rowHandlers,
  onEdit,
  onDelete,
  onAddDriver,
  onEditDriver,
  onDeleteDriver,
  onToggle,
}: {
  company: Company
  expanded: boolean
  /** Spread onto the row's wrapper — see useExpandOrEdit (click to expand, double-click to edit). */
  rowHandlers: ReturnType<ReturnType<typeof useExpandOrEdit>>
  onEdit: () => void
  onDelete: () => void
  onAddDriver: () => void
  onEditDriver: (driver: Driver) => void
  onDeleteDriver: (driverId: string) => void
  /** Expand/collapse from the keyboard (Enter/Space); the pointer path goes through rowHandlers. */
  onToggle: () => void
}) {
  const { t, tc } = useTranslation()

  return (
    <div className="bg-surface-card border border-border-2 rounded-radius-md overflow-hidden">
      <div className="flex items-center hover:bg-surface-sunken transition-colors">
        {/* The summary toggles the details (click, tap, or Enter/Space when
            focused); double-click edits. The menu sits beside it, never
            inside this role="button". */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          className="group flex-1 min-w-0 p-4 flex justify-between items-center gap-3 cursor-pointer active:bg-bg-4 focus-ring rounded-radius-md"
          {...rowHandlers}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
            e.preventDefault()
            onToggle()
          }}
        >
          <div className="min-w-0">
            <h3 className="font-semibold text-text-primary">{company.companyName}</h3>
            <p className="text-sm text-text-secondary">
              {company.contactPerson && `${company.contactPerson} • `}
              {company.phone}
              {company.drivers.length > 0 && ` • ${tc('companies.driverCount', company.drivers.length)}`}
            </p>
          </div>
          <Pencil size={14} className="shrink-0 text-fg-3 opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
        </div>
        <div className="pr-3">
          <RowActions leadingItems={[{ label: t('companies.addDriverAction'), icon: UserPlus, onClick: onAddDriver }]} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-subtle p-4 bg-surface-sunken">
          <div className="mb-4 text-sm text-text-secondary">
            {company.email && (
              <p>
                {t('companies.emailLabel')}: {company.email}
              </p>
            )}
            {company.billingAddress && (
              <p>
                {t('companies.billingLabel')}: {company.billingAddress}
              </p>
            )}
            {company.notes && (
              <p>
                {t('companies.notesLabel')}: {company.notes}
              </p>
            )}
          </div>

          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-text-primary">{t('companies.driversHeading')}</h4>
            <Button variant="secondary" size="sm" icon={UserPlus} onClick={onAddDriver}>
              {t('companies.addDriver')}
            </Button>
          </div>

          <DriversTable drivers={company.drivers} onEdit={onEditDriver} onDelete={onDeleteDriver} />
        </div>
      )}
    </div>
  )
}
