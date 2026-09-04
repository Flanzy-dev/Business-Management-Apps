import type { Driver } from '../../store/companyStore'
import { rowEditOnDoubleClick } from '../../lib/rowInteraction'
import { useTranslation } from '../../lib/i18n'
import { RowActions } from '../ui/RowActions'

/** A company card's expanded drivers list — a table, or the "no drivers
 *  yet" line when empty. */
export function DriversTable({
  drivers,
  onEdit,
  onDelete,
}: {
  drivers: Driver[]
  onEdit: (driver: Driver) => void
  onDelete: (driverId: string) => void
}) {
  const { t } = useTranslation()

  if (drivers.length === 0) {
    return <p className="text-sm text-text-secondary">{t('companies.noDriversYet')}</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-text-secondary">
          <th className="px-3 py-1">{t('companies.colName')}</th>
          <th className="px-3 py-1">{t('companies.colPhone')}</th>
          <th className="px-3 py-1">{t('companies.colEmployeeId')}</th>
          <th className="px-3 py-1 text-right">{t('companies.colActions')}</th>
        </tr>
      </thead>
      <tbody>
        {drivers.map((driver) => (
          <tr key={driver.id} {...rowEditOnDoubleClick(() => onEdit(driver))} className="border-t border-border-subtle">
            <td className="px-3 py-2 text-text-primary">{driver.name}</td>
            <td className="px-3 py-2 text-text-secondary">{driver.phone}</td>
            <td className="px-3 py-2 text-text-secondary font-mono">{driver.employeeId}</td>
            <td className="px-3 py-2 text-right">
              <RowActions onEdit={() => onEdit(driver)} onDelete={() => onDelete(driver.id)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
