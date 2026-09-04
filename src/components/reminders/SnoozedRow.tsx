import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { VehicleReminder } from '../../lib/reminders'
import { ownerName, vehicleLabelWithPlate } from '../../lib/entities'
import { formatDate } from '../../lib/dates'
import { useTranslation } from '../../lib/i18n'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

/** One snoozed vehicle row — simpler than ServiceDueRow/ReceivableRow: no
 *  contact actions, just the snooze-until date and a way to clear it. */
export function SnoozedRow({
  reminder,
  customers,
  companies,
  onClearSnooze,
}: {
  reminder: VehicleReminder
  customers: Customer[]
  companies: Company[]
  onClearSnooze: (vehicleId: string) => void
}) {
  const { t } = useTranslation()
  const { vehicle, followUp } = reminder
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-text-primary font-medium">{vehicleLabelWithPlate(vehicle)}</p>
        <p className="text-sm text-text-secondary">{ownerName(vehicle, customers, companies)}</p>
        {followUp?.snoozeUntil && (
          <p className="text-sm text-text-secondary">{t('reminders.snoozedUntilLabel', { date: formatDate(followUp.snoozeUntil) })}</p>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={() => onClearSnooze(vehicle.id)}>
        {t('reminders.removeSnoozeAction')}
      </Button>
    </Card>
  )
}
