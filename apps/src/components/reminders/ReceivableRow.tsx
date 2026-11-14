import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { Vehicle } from '../../store/vehicleStore'
import { type Receivable, receivableBadgeTone, receivableStatusLabel, buildPaymentReminderMessage } from '../../lib/orders/receivables'
import { orderLabel } from '../../lib/format/entities'
import { orderOwnerName, orderOwnerContact, orderVehicleLabel } from '../../lib/orders/orderOwner'
import { formatCurrency } from '../../lib/format/numbers'
import { formatDate } from '../../lib/format/dates'
import { signWithShop } from '../../lib/schedule/reminders'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { DropdownMenu } from '../ui/DropdownMenu'
import { Receipt as ReceiptIcon, FileText, CalendarPlus } from 'lucide-react'
import { ContactRow } from './ContactRow'

/** One outstanding-payment row in Reminders' Payments Due section. */
export function ReceivableRow({
  receivable,
  vehicleById,
  customers,
  companies,
  onRecordPayment,
  onViewOrder,
  onExtendDue,
}: {
  receivable: Receivable
  vehicleById: Map<string, Vehicle>
  customers: Customer[]
  companies: Company[]
  onRecordPayment: (orderId: string) => void
  onViewOrder: (orderId: string) => void
  /** Admin only — leave undefined and the menu simply has no such item. */
  onExtendDue?: (orderId: string) => void
}) {
  const { t } = useTranslation()
  const { order, dueDate } = receivable
  const vehicle = vehicleById.get(order.vehicleId)
  const contact = orderOwnerContact(order, vehicleById, customers, companies)
  const owner = orderOwnerName(order, vehicleById, customers, companies)
  const orderText = orderLabel(order.orderNumber, order.orderNumberSuffix)
  const amount = formatCurrency(order.total)
  const shopName = useSettingsStore((s) => s.settings.shopName)
  const message = signWithShop(
    buildPaymentReminderMessage(t, owner, orderText, amount, dueDate ? formatDate(dueDate) : null),
    shopName,
    (shop) => t('reminders.messageSignature', { shop })
  )

  return (
    <ContactRow
      contact={contact}
      message={message}
      onDoubleClick={() => onViewOrder(order.id)}
      heading={
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-medium">{orderText}</span>
          <span className="font-mono text-sm text-text-secondary">{amount}</span>
          <Badge tone={receivableBadgeTone(receivable)}>{receivableStatusLabel(receivable)}</Badge>
        </div>
      }
      body={
        <>
          <p className="text-sm text-text-secondary">
            {owner} · {orderVehicleLabel(order, vehicle)}
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
          <DropdownMenu
            items={[
              { label: t('workOrders.viewOrderAction'), icon: FileText, onClick: () => onViewOrder(order.id) },
              ...(onExtendDue ? [{ label: t('receivables.extendDueAction'), icon: CalendarPlus, onClick: () => onExtendDue(order.id) }] : []),
            ]}
          />
        </>
      }
    />
  )
}
