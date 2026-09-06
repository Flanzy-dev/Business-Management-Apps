import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { Vehicle } from '../../store/vehicleStore'
import { type Receivable, receivableBadgeTone, receivableStatusLabel, buildPaymentReminderMessage } from '../../lib/receivables'
import { ownerName, ownerContact, vehicleLabelWithPlate } from '../../lib/entities'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/dates'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { DropdownMenu } from '../ui/DropdownMenu'
import { Receipt as ReceiptIcon, FileText } from 'lucide-react'
import { ContactRow } from './ContactRow'

/** One outstanding-payment row in Reminders' Payments Due section. */
export function ReceivableRow({
  receivable,
  vehicleById,
  customers,
  companies,
  onRecordPayment,
  onViewOrder,
}: {
  receivable: Receivable
  vehicleById: Map<string, Vehicle>
  customers: Customer[]
  companies: Company[]
  onRecordPayment: (orderId: string) => void
  onViewOrder: (orderId: string) => void
}) {
  const { t } = useTranslation()
  const { order, dueDate } = receivable
  const vehicle = vehicleById.get(order.vehicleId)
  const contact = ownerContact(vehicle, customers, companies)
  const owner = ownerName(vehicle, customers, companies)
  const orderLabel = `SB-${order.orderNumber}`
  const amount = formatCurrency(order.total)
  const message = buildPaymentReminderMessage(t, owner, orderLabel, amount, dueDate ? formatDate(dueDate) : null)

  return (
    <ContactRow
      contact={contact}
      message={message}
      onDoubleClick={() => onViewOrder(order.id)}
      heading={
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-medium">{orderLabel}</span>
          <span className="font-mono text-sm text-text-secondary">{amount}</span>
          <Badge tone={receivableBadgeTone(receivable)}>{receivableStatusLabel(receivable)}</Badge>
        </div>
      }
      body={
        <>
          <p className="text-sm text-text-secondary">
            {owner} · {vehicleLabelWithPlate(vehicle)}
          </p>
          <p className="text-sm text-text-secondary">
            {dueDate ? t('receivables.dueLabel', { date: formatDate(dueDate) }) : t('receivables.noDueDate')}
          </p>
        </>
      }
      primaryAction={
        <>
          <Button variant="primary" size="sm" icon={ReceiptIcon} onClick={() => onRecordPayment(order.id)}>
            {t('workOrders.recordPaymentAction')}
          </Button>
          {/* The tap-reachable twin of this row's onDoubleClick above — that
              gesture had no substitute at all before this: the row's only
              other button is "Record payment", which does something
              entirely different. */}
          <DropdownMenu items={[{ label: t('workOrders.viewOrderAction'), icon: FileText, onClick: () => onViewOrder(order.id) }]} />
        </>
      }
    />
  )
}
