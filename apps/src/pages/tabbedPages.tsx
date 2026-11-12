// The sidebar items that hold more than one section. Each section is still its
// own page component; these only decide which tabs exist, in what order, and
// which ones this mode may see. See src/components/layout/TabbedPage.tsx.
import { TabbedPage } from '../components/layout/TabbedPage'
import { useTranslation } from '../lib/i18n'
import { useMode } from '../store/authStore'
import { canManageSuppliers } from '../lib/auth/permissions'
import Customers from './Customers'
import Companies from './sections/Companies'
import Appointments from './sections/Appointments'
import Reminders from './sections/Reminders'
import Inventory from './Inventory'
import Suppliers from './sections/Suppliers'

/** Both kinds of vehicle owner (see src/lib/vehicles/vehicleOwner.ts) in one place. */
export function CustomersPage() {
  const { t } = useTranslation()
  return (
    <TabbedPage
      tabs={[
        { value: 'customers', label: t('nav.customers'), render: () => <Customers /> },
        { value: 'companies', label: t('nav.companies'), render: () => <Companies /> },
      ]}
    />
  )
}

/** What's booked, and who's due back. */
export function SchedulePage() {
  const { t } = useTranslation()
  return (
    <TabbedPage
      tabs={[
        { value: 'appointments', label: t('nav.appointments'), render: () => <Appointments /> },
        { value: 'reminders', label: t('nav.reminders'), render: () => <Reminders /> },
      ]}
    />
  )
}

/** Parts, labor and the suppliers behind them. Workers see stock and prices
 *  but not supplier records — the Suppliers tab is admin-only, as its own
 *  page was. */
export function InventoryPage() {
  const { t } = useTranslation()
  const mode = useMode()
  return (
    <TabbedPage
      tabs={[
        { value: 'products', label: t('inventory.tabProducts'), render: () => <Inventory section="products" /> },
        { value: 'services', label: t('inventory.tabServices'), render: () => <Inventory section="services" /> },
        ...(canManageSuppliers(mode) ? [{ value: 'suppliers', label: t('nav.suppliers'), render: () => <Suppliers /> }] : []),
      ]}
    />
  )
}
