import { useNavigate } from 'react-router-dom'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useToastStore } from '../store/toastStore'
import { getVehicleReminders, buildReminderMessage, normalizeWhatsAppPhone } from '../lib/reminders'
import { dueStatusLabel, dueStatusBadgeTone } from '../lib/vehicleDueSummary'
import { ownerName, ownerContact, vehicleLabelWithPlate, serviceItemTypeLabel } from '../lib/entities'
import { formatDistance } from '../lib/units'
import { formatDate } from '../lib/dates'
import { openExternalLink } from '../lib/openExternal'
import { useTranslation } from '../lib/i18n'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { CalendarClock, Copy, Phone, MessageCircle, Wrench } from 'lucide-react'

export default function Reminders() {
  const { t } = useTranslation()
  const vehicles = useVehicleStore((s) => s.vehicles)
  const scheduleRules = useScheduleRuleStore((s) => s.scheduleRules)
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const showToast = useToastStore((s) => s.show)
  const navigate = useNavigate()

  const itemTypeName = (id: string) => {
    const found = serviceItemTypes.find((it) => it.id === id)
    return found ? serviceItemTypeLabel(found.name) : t('common.unknown')
  }

  const dueDescription = (lines: { dueKm: number | null; dueDate: string | null; itemTypeIds: string[] }[]) =>
    lines
      .map((line) => {
        const when = [line.dueKm != null ? formatDistance(line.dueKm) : null, line.dueDate != null ? formatDate(line.dueDate) : null]
          .filter(Boolean)
          .join(' / ')
        return `${when} — ${line.itemTypeIds.map(itemTypeName).join(', ')}`
      })
      .join('; ')

  const startWorkOrder = (vehicle: Vehicle) => {
    const ownerType = vehicle.companyId ? 'company' : 'customer'
    const ownerId = vehicle.companyId ?? vehicle.customerId ?? ''
    navigate(`/work-orders?new=1&ownerType=${ownerType}&ownerId=${ownerId}&vehicleId=${vehicle.id}`)
  }

  const copyMessage = async (vehicle: Vehicle, lines: { dueKm: number | null; dueDate: string | null; itemTypeIds: string[] }[]) => {
    const message = buildReminderMessage(t, ownerName(vehicle, customers, companies), vehicleLabelWithPlate(vehicle), dueDescription(lines))
    try {
      await navigator.clipboard.writeText(message)
      showToast({ tone: 'success', title: t('reminders.messageCopied') })
    } catch {
      showToast({ tone: 'danger', title: t('reminders.messageCopied') })
    }
  }

  const reminders = getVehicleReminders(vehicles, scheduleRules)
  const overdue = reminders.filter((r) => r.status.tone === 'overdue')
  const dueSoon = reminders.filter((r) => r.status.tone === 'due_soon')

  const renderRow = (reminder: (typeof reminders)[number]) => {
    const { vehicle, status } = reminder
    const contact = ownerContact(vehicle, customers, companies)
    const message = buildReminderMessage(t, ownerName(vehicle, customers, companies), vehicleLabelWithPlate(vehicle), dueDescription(status.lines))
    return (
      <Card key={vehicle.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-text-primary font-medium">{vehicleLabelWithPlate(vehicle)}</span>
            <Badge tone={dueStatusBadgeTone(status)}>{dueStatusLabel(status)}</Badge>
          </div>
          <p className="text-sm text-text-secondary">{ownerName(vehicle, customers, companies)}</p>
          <p className="text-sm text-text-secondary">{dueDescription(status.lines)}</p>
          {!contact?.phone && <p className="text-2xs text-text-secondary mt-1">{t('reminders.noContact')}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={Copy} onClick={() => copyMessage(vehicle, status.lines)}>
            {t('reminders.copyMessage')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Phone}
            disabled={!contact?.phone}
            onClick={() => contact?.phone && openExternalLink(`tel:${contact.phone}`)}
          >
            {t('reminders.call')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={MessageCircle}
            disabled={!contact?.phone}
            onClick={() =>
              contact?.phone &&
              openExternalLink(`https://wa.me/${normalizeWhatsAppPhone(contact.phone)}?text=${encodeURIComponent(message)}`)
            }
          >
            {t('reminders.whatsapp')}
          </Button>
          <Button variant="primary" size="sm" icon={Wrench} onClick={() => startWorkOrder(vehicle)}>
            {t('reminders.startWorkOrder')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader title={t('reminders.title')} />
      {reminders.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t('reminders.emptyTitle')} message={t('reminders.emptyMessage')} />
      ) : (
        <div className="space-y-8">
          {overdue.length > 0 && (
            <section>
              <h2 className="text-card-title text-text-primary mb-3">{t('reminders.overdueSection')}</h2>
              <div className="space-y-3">{overdue.map(renderRow)}</div>
            </section>
          )}
          {dueSoon.length > 0 && (
            <section>
              <h2 className="text-card-title text-text-primary mb-3">{t('reminders.dueSoonSection')}</h2>
              <div className="space-y-3">{dueSoon.map(renderRow)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
