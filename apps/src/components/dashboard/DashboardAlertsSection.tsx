import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore, type Vehicle } from '../../store/vehicleStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useReminderFollowUpStore } from '../../store/reminderFollowUpStore'
import { useProductStock } from '../../hooks/useProductStock'
import { useTranslation } from '../../lib/i18n'
import { isLowStock } from '../../lib/inventory/stockLedger'
import { ownerName, itemTypeNameLookup } from '../../lib/format/entities'
import { getVehicleReminders } from '../../lib/schedule/reminders'
import { useReminderOptions } from '../../hooks/useReminderOptions'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { LowStockRail } from './LowStockRail'
import { ServiceRemindersRail } from './ServiceRemindersRail'
import { VehicleServiceHistoryDialog } from '../vehicles/VehicleServiceHistoryDialog'

/**
 * Dashboard's alerts row: products running low, and vehicles due for service.
 * Both are things someone acts on today.
 *
 * The charts that used to follow (repeat-customer rate, appointment trend,
 * the customer-activity heatmap) are analysis, not alerts: the first two
 * moved to Reports > Overview, and Reports > Customers already had the
 * heatmap. Owns `historyVehicle` (and renders VehicleServiceHistoryDialog
 * itself) since nothing outside this section reads it.
 */
export function DashboardAlertsSection({ endOfToday }: { endOfToday: Date }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const vehicles = useVehicleStore((s) => s.vehicles)
  const scheduleRules = useScheduleRuleStore((s) => s.scheduleRules)
  const reminderFollowUps = useReminderFollowUpStore((s) => s.followUps)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const products = useProductStock()
  const itemTypeName = itemTypeNameLookup(serviceItemTypes)

  // Drives the service-history popup a reminders-card row opens on click — see
  // Vehicles.tsx's identical historyVehicle/VehicleServiceHistoryDialog pairing.
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null)

  const lowStockProducts = useMemo(() => products.filter(isLowStock), [products])

  // O(vehicles × rules) and a fresh array identity every render otherwise —
  // which re-rendered ServiceRemindersRail on every unrelated tick.
  const reminderOptions = useReminderOptions()
  const vehicleReminders = useMemo(
    () => getVehicleReminders(vehicles, scheduleRules, endOfToday, reminderFollowUps, reminderOptions),
    [vehicles, scheduleRules, endOfToday, reminderFollowUps, reminderOptions]
  )

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.lowStockAlert')}</CardTitle>
            <p className="text-caption">{t('dashboard.lowStockCaption', { count: lowStockProducts.length })}</p>
          </CardHeader>
          <CardContent>
            <LowStockRail items={lowStockProducts} onViewAll={() => navigate('/inventory')} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('dashboard.remindersTitle')}</CardTitle>
            <p className="text-caption">{t('dashboard.remindersCaption', { count: vehicleReminders.length })}</p>
          </CardHeader>
          <CardContent>
            <ServiceRemindersRail
              reminders={vehicleReminders}
              getOwnerName={(vehicle) => ownerName(vehicle, customers, companies)}
              itemTypeName={itemTypeName}
              onSelectVehicle={setHistoryVehicle}
              onViewAll={() => navigate('/schedule?tab=reminders')}
            />
          </CardContent>
        </Card>
      </div>

      {historyVehicle && (
        <VehicleServiceHistoryDialog open vehicle={historyVehicle} onClose={() => setHistoryVehicle(null)} />
      )}
    </>
  )
}
