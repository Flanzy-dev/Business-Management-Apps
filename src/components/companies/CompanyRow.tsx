import { Pencil, UserPlus } from 'lucide-react'
import type { Company, Driver } from '../../store/companyStore'
import type { useExpandOrEdit } from '../../lib/rowInteraction'
import { useTranslation } from '../../lib/i18n'
import { RowActions } from '../ui/RowActions'
import { DriversTable } from './DriversTable'

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
}) {
  const { t, tc } = useTranslation()

  return (
    <div className="bg-surface-card rounded-radius-md overflow-hidden">
      <div className="group p-4 flex justify-between items-center cursor-pointer hover:bg-surface-sunken active:bg-bg-4 transition-colors" {...rowHandlers}>
        <div>
          <h3 className="font-semibold text-text-primary">{company.companyName}</h3>
          <p className="text-sm text-text-secondary">
            {company.contactPerson && `${company.contactPerson} • `}
            {company.phone}
            {company.drivers.length > 0 && ` • ${tc('companies.driverCount', company.drivers.length)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Pencil size={14} className="text-fg-3 opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
          <div onClick={(e) => e.stopPropagation()}>
            <RowActions leadingItems={[{ label: t('companies.addDriverAction'), icon: UserPlus, onClick: onAddDriver }]} onEdit={onEdit} onDelete={onDelete} />
          </div>
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
            <button
              onClick={onAddDriver}
              className="text-sm bg-surface-card text-text-secondary px-3 py-1 rounded-radius-sm hover:text-text-primary border border-border-subtle"
            >
              {t('companies.addDriver')}
            </button>
          </div>

          <DriversTable drivers={company.drivers} onEdit={onEditDriver} onDelete={onDeleteDriver} />
        </div>
      )}
    </div>
  )
}
