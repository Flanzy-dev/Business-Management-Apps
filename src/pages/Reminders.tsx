import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useWorkerStore } from '../store/workerStore'
import { useWorkOrderStore, WorkOrder } from '../store/workOrderStore'
import { useSettingsStore } from '../store/settingsStore'
import { useReminderFollowUpStore } from '../store/reminderFollowUpStore'
import { getVehicleReminders, getSnoozedVehicleReminders } from '../lib/reminders'
import { outstandingReceivables } from '../lib/receivables'
import { workOrderReturnPath } from '../lib/returnTrip'
import { useRecordPayment } from '../hooks/useRecordPayment'
import { ownerName, vehicleLabelWithPlate, workerName, itemTypeNameLookup } from '../lib/entities'
import { formatDistance } from '../lib/units'
import { formatDate } from '../lib/dates'
import { useTranslation } from '../lib/i18n'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Dialog, DialogFooter } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { PaymentDialog } from '../components/workOrders/PaymentDialog'
import { OrderBreakdown } from '../components/workOrders/OrderBreakdown'
import { VehicleServiceHistoryDialog } from '../components/vehicles/VehicleServiceHistoryDialog'
import { printReceipt, receiptShopInfoFromSettings } from '../components/Receipt'
import { ReceivableRow } from '../components/reminders/ReceivableRow'
import { ServiceDueRow } from '../components/reminders/ServiceDueRow'
import { SnoozedRow } from '../components/reminders/SnoozedRow'
import { CalendarClock } from 'lucide-react'

export default function Reminders() {
  const { t } = useTranslation()
  const vehicles = useVehicleStore((s) => s.vehicles)
  const scheduleRules = useScheduleRuleStore((s) => s.scheduleRules)
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const workers = useWorkerStore((s) => s.workers)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const settings = useSettingsStore((s) => s.settings)
  const followUps = useReminderFollowUpStore((s) => s.followUps)
  const markContacted = useReminderFollowUpStore((s) => s.markContacted)
  const snooze = useReminderFollowUpStore((s) => s.snooze)
  const clearSnooze = useReminderFollowUpStore((s) => s.clearSnooze)
  const navigate = useNavigate()
  const recordPaymentWithToast = useRecordPayment()
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  // Drives the transaction-detail popup a Payments Due row opens on
  // double-click — separate from payingOrderId so viewing a transaction and
  // recording its payment can never fight over the same piece of state.
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null)
  // Drives the service-history popup a service-due row opens on double-click —
  // same pairing Vehicles.tsx and Dashboard.tsx use.
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null)

  const itemTypeName = itemTypeNameLookup(serviceItemTypes)

  // `autoAdd` is only ever true from the Overdue section below — it tells
  // NewWorkOrderDialog to add a line for whatever's overdue once the order
  // is created, instead of opening to an empty ticket.
  const startWorkOrder = (vehicle: Vehicle, autoAdd: boolean) => {
    const ownerType = vehicle.companyId ? 'company' : 'customer'
    const ownerId = vehicle.companyId ?? vehicle.customerId ?? ''
    navigate(workOrderReturnPath(ownerType, ownerId, { vehicleId: vehicle.id, ...(autoAdd ? { autoAddOverdue: '1' } : {}) }))
  }

  const now = new Date()
  const reminders = getVehicleReminders(vehicles, scheduleRules, now, followUps)
  const overdue = reminders.filter((r) => r.status.tone === 'overdue')
  const dueSoon = reminders.filter((r) => r.status.tone === 'due_soon')
  const snoozed = getSnoozedVehicleReminders(vehicles, scheduleRules, now, followUps)

  const receivables = outstandingReceivables(workOrders)
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]))
  const payingOrder = payingOrderId ? workOrders.find((wo) => wo.id === payingOrderId) ?? null : null
  const viewingOrder = viewingOrderId ? workOrders.find((wo) => wo.id === viewingOrderId) ?? null : null
  const viewingVehicle = viewingOrder ? vehicleById.get(viewingOrder.vehicleId) : undefined

  const handlePrintReceipt = (order: WorkOrder) => {
    printReceipt(order, receiptShopInfoFromSettings(settings))
  }

  const handleRecordPayment = (method: WorkOrder['paymentMethod'], amountReceived: number | null) => {
    if (!payingOrderId) return
    setPayingOrderId(null)
    recordPaymentWithToast(payingOrderId, method, amountReceived)
  }

  const nothingToShow = reminders.length === 0 && receivables.length === 0 && snoozed.length === 0

  return (
    <div>
      <PageHeader title={t('reminders.title')} />
      {nothingToShow ? (
        <EmptyState icon={CalendarClock} title={t('reminders.emptyTitle')} message={t('reminders.emptyMessage')} />
      ) : (
        <div className="space-y-8">
          {receivables.length > 0 && (
            <section>
              <h2 className="text-card-title text-text-primary mb-3">{t('receivables.sectionTitle')}</h2>
              <div className="space-y-3">
                {receivables.map((r) => (
                  <ReceivableRow
                    key={r.order.id}
                    receivable={r}
                    vehicleById={vehicleById}
                    customers={customers}
                    companies={companies}
                    onRecordPayment={setPayingOrderId}
                    onViewOrder={setViewingOrderId}
                  />
                ))}
              </div>
            </section>
          )}
          {overdue.length > 0 && (
            <section>
              <h2 className="text-card-title text-text-primary mb-3">{t('reminders.overdueSection')}</h2>
              <div className="space-y-3">
                {overdue.map((r) => (
                  <ServiceDueRow
                    key={r.vehicle.id}
                    reminder={r}
                    customers={customers}
                    companies={companies}
                    itemTypeName={itemTypeName}
                    onStartWorkOrder={(v) => startWorkOrder(v, true)}
                    onMarkContacted={(vehicleId) => markContacted(vehicleId, new Date().toISOString())}
                    onSnooze={snooze}
                    onShowHistory={setHistoryVehicle}
                  />
                ))}
              </div>
            </section>
          )}
          {dueSoon.length > 0 && (
            <section>
              <h2 className="text-card-title text-text-primary mb-3">{t('reminders.dueSoonSection')}</h2>
              <div className="space-y-3">
                {dueSoon.map((r) => (
                  <ServiceDueRow
                    key={r.vehicle.id}
                    reminder={r}
                    customers={customers}
                    companies={companies}
                    itemTypeName={itemTypeName}
                    onStartWorkOrder={(v) => startWorkOrder(v, false)}
                    onMarkContacted={(vehicleId) => markContacted(vehicleId, new Date().toISOString())}
                    onSnooze={snooze}
                    onShowHistory={setHistoryVehicle}
                  />
                ))}
              </div>
            </section>
          )}
          {snoozed.length > 0 && (
            <section>
              <h2 className="text-card-title text-text-primary mb-3">{t('reminders.snoozedSection')}</h2>
              <div className="space-y-3">
                {snoozed.map((r) => (
                  <SnoozedRow key={r.vehicle.id} reminder={r} customers={customers} companies={companies} onClearSnooze={clearSnooze} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <PaymentDialog
        open={!!payingOrder}
        total={payingOrder?.total ?? 0}
        allowPending={false}
        selectTitle={t('workOrders.selectPaymentMethodForRecordTitle')}
        onClose={() => setPayingOrderId(null)}
        onConfirm={handleRecordPayment}
      />

      {/* Double-clicking a Payments Due row opens this in place — see
          renderReceivableRow — rather than navigating away from Reminders. */}
      <Dialog
        open={!!viewingOrder}
        onClose={() => setViewingOrderId(null)}
        title={viewingOrder ? `SB-${viewingOrder.orderNumber}` : ''}
        size="md"
      >
        {viewingOrder && (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-text-primary">
                {ownerName(viewingVehicle, customers, companies)} · {vehicleLabelWithPlate(viewingVehicle)}
              </p>
              <p className="text-caption">
                {formatDate(viewingOrder.completedAt || viewingOrder.createdAt)}
                {' · '}
                {t('serviceHistory.mileageField')}{' '}
                {(() => {
                  const odo = viewingOrder.odometerAtService ?? viewingOrder.odometerAtArrival
                  return odo != null ? formatDistance(odo) : '-'
                })()}
                {' · '}
                {t('serviceHistory.techField')} {workerName(viewingOrder.workerId, workers)}
              </p>
            </div>
            <OrderBreakdown order={viewingOrder} itemTypeName={itemTypeName} onPrint={handlePrintReceipt} />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setViewingOrderId(null)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </Dialog>

      {historyVehicle && (
        <VehicleServiceHistoryDialog open vehicle={historyVehicle} onClose={() => setHistoryVehicle(null)} />
      )}
    </div>
  )
}
