import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { VehicleReminder } from '../../lib/schedule/reminders'
import { buildReminderMessage, formatDueDescription, signWithShop } from '../../lib/schedule/reminders'
import { useSettingsStore } from '../../store/settingsStore'
import { formatDueLine } from '../../lib/schedule/scheduleEngine'
import { dueStatusLabel, dueStatusBadgeTone } from '../../lib/vehicles/vehicleDueSummary'
import { ownerName, ownerContact, vehicleLabelWithPlate } from '../../lib/format/entities'
import { formatDate } from '../../lib/format/dates'
import { formatNumber } from '../../lib/format/numbers'
import { daysFromNowKey } from '../../lib/format/dateKeys'
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
  const description = formatDueDescription(reminder.dueLines, itemTypeName)
  const shopName = useSettingsStore((s) => s.settings.shopName)
  const message = signWithShop(
    buildReminderMessage(t, ownerName(vehicle, customers, companies), vehicleLabelWithPlate(vehicle), description),
    shopName,
    (shop) => t('reminders.messageSignature', { shop })
  )

  return (
    <ContactRow
      contact={contact}
      message={message}
      onContacted={() => onMarkContacted(vehicle.id)}
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
          {/* One line per due item — the joined `description` is for the message below. */}
          <ul className="text-sm text-text-secondary">
            {reminder.dueLines.map((line) => {
              const { when, what } = formatDueLine(line, itemTypeName)
              return (
                <li key={`${line.dueKm}-${line.dueDate}`}>
                  <span className="tabular-nums text-text-primary">{when}</span>
                  {' — '}
                  {what}
                </li>
              )
            })}
          </ul>
          {/* Say where the figures came from when they aren't the car's own. */}
          {reminder.odometerEstimated && (
            <p className="text-2xs text-fg-3 mt-0.5 tabular-nums">{t('reminders.odometerEstimated', { km: formatNumber(reminder.odometer) })}</p>
          )}
          {reminder.basis === 'default' && <p className="text-2xs text-fg-3 mt-0.5">{t('reminders.basisDefault')}</p>}
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
