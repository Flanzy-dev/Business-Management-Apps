import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import { useTranslation } from '../../lib/i18n'
import { Select } from '../ui/Input'

const ADD_NEW = '__add_new__'

/**
 * The customer/company owner picker, including its "+ Add new..." option.
 * Individual customers get an inline detour (the caller swaps in
 * AddCustomerStepDialog); a fleet company is rare enough mid-order that it
 * keeps the round trip to the Companies page instead — that distinction
 * stays the caller's call (`onAddNew`), this component only ever reports
 * that "add new" was picked.
 */
export function OwnerSelect({
  ownerType,
  ownerId,
  customers,
  companies,
  onSelectOwner,
  onAddNew,
  label,
  emptyLabel,
}: {
  ownerType: 'customer' | 'company'
  ownerId: string
  customers: Customer[]
  companies: Company[]
  onSelectOwner: (ownerId: string) => void
  /** Omit to leave "+ Add new..." out of the list (a dialog with no inline add flow). */
  onAddNew?: () => void
  /** Replaces the default "Customer"/"Company" label — a parts sale names its buyer optionally. */
  label?: string
  /** Replaces the "Select customer..." empty option, for a picker where leaving it empty is a valid answer. */
  emptyLabel?: string
}) {
  const { t } = useTranslation()
  return (
    <Select
      label={label ?? (ownerType === 'customer' ? t('workOrders.customerLabel') : t('workOrders.companyLabel'))}
      value={ownerId}
      onChange={(e) => {
        const v = e.target.value
        if (v === ADD_NEW) {
          onAddNew?.()
          return
        }
        onSelectOwner(v)
      }}
    >
      <option value="">{emptyLabel ?? (ownerType === 'customer' ? t('workOrders.selectCustomer') : t('workOrders.selectCompany'))}</option>
      {/* Second row, not last: with a thousand customers on file the new-customer
          entry was a scroll to the very bottom of the list. */}
      {onAddNew && (
        <option value={ADD_NEW}>{ownerType === 'customer' ? t('workOrders.addNewCustomer') : t('workOrders.addNewCompany')}</option>
      )}
      {ownerType === 'customer'
        ? customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} - {c.phone}
            </option>
          ))
        : companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
    </Select>
  )
}
