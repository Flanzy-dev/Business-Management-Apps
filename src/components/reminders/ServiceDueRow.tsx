import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { VehicleReminder } from '../../lib/reminders'
import { buildReminderMessage, formatDueDescription } from '../../lib/reminders'
import { dueStatusLabel, dueStatusBadgeTone } from '../../lib/vehicleDueSummary'
import { ownerName, ownerContact, vehicleLabelWithPlate } from '../../lib/entities'
import { formatDate } from '../../lib/dates'
import { daysFromNowKey } from '../../lib/dateKeys'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { DropdownMenu } from '../ui/DropdownMenu'
import { Wrench, CheckCircle2, Clock, History } from 'lucide-react'
import { ContactRow } from './ContactRow'

/** One overdue/due-soon vehicle row — Reminders.tsx's Overdue and Due Soon
 *  sections both render this, just with a different filtered list. */
export function ServiceDueRow({
  reminder,
  customers,
  companies,
  itemTypeName,
  onStartWorkOrder,
  onMarkContacted,
  onSnooze,
  onShowHistory,
}: {
  reminder: VehicleReminder
  customers: Customer[]
  companies: Company[]
  itemTypeName: (id: string) => string
  onStartWorkOrder: (vehicle: Vehicle) => void
  onMarkContacted: (vehicleId: string) => void
  onSnooze: (vehicleId: string, untilDate: string) => void
  onShowHistory: (vehicle: Vehicle) => void
}) {
  const { t } = useTranslation()
  const { vehicle, status, followUp } = reminder
  const contact = ownerContact(vehicle, customers, companies)
  const description = formatDueDescription(status.lines, itemTypeName)
  const message = buildReminderMessage(t, ownerName(vehicle, customers, companies), vehicleLabelWithPlate(vehicle), description)

  return (
    <ContactRow
      contact={contact}
      message={message}
      onDoubleClick={() => onShowHistory(vehicle)}
      heading={
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-medium">{vehicleLabelWithPlate(vehicle)}</span>
          <Badge tone={dueStatusBadgeTone(status)}>{dueStatusLabel(status)}</Badge>
        </div>
      }
      body={
        <>
          <p className="text-sm text-text-secondary">{ownerName(vehicle, customers, companies)}</p>
          <p className="text-sm text-text-secondary">{description}</p>
          {followUp?.contactedAt && (
            <p className="text-2xs text-fg-3 mt-0.5">{t('reminders.contactedOnLabel', { date: formatDate(followUp.contactedAt) })}</p>
          )}
        </>
      }
      primaryAction={
        <>
          <Button variant="primary" size="sm" icon={Wrench} onClick={() => onStartWorkOrder(vehicle)}>
            {t('reminders.startWorkOrder')}
          </Button>
          {/* Not a message-sending action, so it's tucked in the overflow menu
              rather than sitting beside Copy/Call/WhatsApp/Start Work Order. */}
          <DropdownMenu
            items={[
              // The tap-reachable twin of this row's onDoubleClick above —
              // that gesture had no substitute here at all before this.
              { label: t('vehicles.serviceHistoryAction'), icon: History, onClick: () => onShowHistory(vehicle) },
              { label: t('reminders.markContactedAction'), icon: CheckCircle2, onClick: () => onMarkContacted(vehicle.id) },
              { label: t('reminders.snoozeOneWeekAction'), icon: Clock, onClick: () => onSnooze(vehicle.id, daysFromNowKey(7)) },
              { label: t('reminders.snoozeTwoWeeksAction'), icon: Clock, onClick: () => onSnooze(vehicle.id, daysFromNowKey(14)) },
              { label: t('reminders.snoozeOneMonthAction'), icon: Clock, onClick: () => onSnooze(vehicle.id, daysFromNowKey(30)) },
            ]}
          />
        </>
      }
    />
  )
}
