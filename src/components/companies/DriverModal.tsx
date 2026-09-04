import { useState, type FormEvent } from 'react'
import type { Driver } from '../../store/companyStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogActions } from '../ui/Dialog'
import { Input, Textarea } from '../ui/Input'

/** Add/Edit Driver form — same flat-mapper shape as CompanyModal. */
export function DriverModal({
  driver,
  onSave,
  onClose,
}: {
  driver: Driver | null
  onSave: (data: Omit<Driver, 'id' | 'companyId'>) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(driver?.name ?? '')
  const [phone, setPhone] = useState(driver?.phone ?? '')
  const [employeeId, setEmployeeId] = useState(driver?.employeeId ?? '')
  const [notes, setNotes] = useState(driver?.notes ?? '')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name, phone, employeeId, notes })
  }

  return (
    <Dialog open onClose={onClose} title={driver ? t('companies.editDriverTitle') : t('companies.addDriverTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('companies.driverNameLabel')} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label={t('companies.driverPhoneLabel')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label={t('companies.driverEmployeeIdLabel')} mono value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        <Textarea label={t('companies.driverNotesLabel')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <DialogActions onCancel={onClose} confirmType="submit" confirmLabel={driver ? t('companies.saveChanges') : t('companies.addDriverSubmit')} />
      </form>
    </Dialog>
  )
}
