import { useEffect, useMemo, useState } from 'react'
import { useAppointmentStore } from '../../store/appointmentStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useToastStore } from '../../store/toastStore'
import { initialAppointmentDraft, validateAppointmentDraft, appointmentDraftToData, type AppointmentDraft } from '../../lib/appointmentForm'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import { OwnerTypeRadios } from '../owners/OwnerTypeRadios'
import { OwnerVehicleFields } from './OwnerVehicleFields'

const DRAFT_ERROR_KEYS: Record<'vehicleRequired' | 'invalidDate', string> = {
  vehicleRequired: 'appointments.vehicleRequired',
  invalidDate: 'appointments.dateField',
}

/**
 * Creates a scheduled appointment or a walk-in queue entry — replaces the
 * "coming soon" placeholder that used to sit behind every create button on
 * the Appointments page. Owner/vehicle picker mirrors the fallback picker in
 * components/workOrders/NewWorkOrderDialog.tsx; no inline add-customer /
 * add-vehicle detours here (rare mid-booking) — an owner with no vehicle on
 * file just points at the Vehicles page.
 */
export function AppointmentDialog({
  open,
  walkIn: walkInDefault,
  onClose,
}: {
  open: boolean
  walkIn: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const addAppointment = useAppointmentStore((s) => s.addAppointment)
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const vehicles = useVehicleStore((s) => s.vehicles)
  const showToast = useToastStore((s) => s.show)

  const [draft, setDraft] = useState<AppointmentDraft>(() => initialAppointmentDraft(walkInDefault))
  const patch = (fields: Partial<AppointmentDraft>) => setDraft((d) => ({ ...d, ...fields }))

  // Reset every time the dialog (re)opens — including flipping the walk-in
  // default to match which button was pressed.
  useEffect(() => {
    if (open) setDraft(initialAppointmentDraft(walkInDefault))
  }, [open, walkInDefault])

  const ownerVehicles = useMemo(
    () =>
      vehicles.filter((v) => (draft.ownerType === 'customer' ? v.customerId === draft.ownerId : v.companyId === draft.ownerId)),
    [vehicles, draft.ownerType, draft.ownerId],
  )

  const handleCreate = () => {
    const result = validateAppointmentDraft(draft)
    if (!result.ok) {
      showToast({ tone: 'danger', title: t(DRAFT_ERROR_KEYS[result.error]) })
      return
    }
    addAppointment(appointmentDraftToData(draft, result.scheduledAt))
    showToast({
      tone: 'success',
      title: draft.isWalkIn ? t('appointments.walkInAddedToast') : t('appointments.createdToast'),
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={draft.isWalkIn ? t('appointments.dialogTitleWalkIn') : t('appointments.dialogTitleScheduled')}
    >
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={draft.isWalkIn}
            onChange={(e) => patch({ isWalkIn: e.target.checked })}
            className="accent-accent"
          />
          {t('appointments.walkInToggle')}
        </label>

        <OwnerTypeRadios
          value={draft.ownerType}
          onChange={(next) => patch({ ownerType: next, ownerId: '', vehicleId: '' })}
          label={t('appointments.ownerTypeLabel')}
          individualLabel={t('appointments.ownerIndividual')}
          companyLabel={t('appointments.ownerCompany')}
        />

        <OwnerVehicleFields
          ownerType={draft.ownerType}
          ownerId={draft.ownerId}
          onOwnerIdChange={(id) => patch({ ownerId: id, vehicleId: '' })}
          customers={customers}
          companies={companies}
          ownerVehicles={ownerVehicles}
          vehicleId={draft.vehicleId}
          onVehicleIdChange={(id) => patch({ vehicleId: id })}
        />

        {!draft.isWalkIn && (
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('appointments.dateField')} type="date" value={draft.date} onChange={(e) => patch({ date: e.target.value })} />
            <Input label={t('appointments.timeField')} type="time" value={draft.time} onChange={(e) => patch({ time: e.target.value })} />
          </div>
        )}

        <Input
          label={t('appointments.durationField')}
          type="number"
          min="5"
          mono
          value={draft.duration}
          onChange={(e) => patch({ duration: e.target.value })}
        />

        <Input
          label={t('appointments.serviceTypeField')}
          value={draft.serviceType}
          onChange={(e) => patch({ serviceType: e.target.value })}
          placeholder={t('appointments.serviceTypePlaceholder')}
        />

        <Textarea
          label={t('appointments.notesField')}
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={2}
        />
      </div>

      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleCreate} disabled={!draft.vehicleId}>
          {draft.isWalkIn ? t('appointments.addToQueueButton') : t('appointments.createButton')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
