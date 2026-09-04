import { useState, type FormEvent } from 'react'
import type { Company } from '../../store/companyStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogActions } from '../ui/Dialog'
import { Input, Textarea } from '../ui/Input'

/**
 * Add/Edit Company form. A flat 6-field mapper with one non-blank check —
 * genuinely this simple, not under-decomposed; see .fallowrc.json's
 * thresholdOverrides for why fallow's complexity score on this one is
 * overridden rather than split further.
 */
export function CompanyModal({
  company,
  onSave,
  onClose,
}: {
  company: Company | null
  onSave: (data: Omit<Company, 'id' | 'createdAt' | 'drivers'>) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [companyName, setCompanyName] = useState(company?.companyName ?? '')
  const [contactPerson, setContactPerson] = useState(company?.contactPerson ?? '')
  const [phone, setPhone] = useState(company?.phone ?? '')
  const [email, setEmail] = useState(company?.email ?? '')
  const [billingAddress, setBillingAddress] = useState(company?.billingAddress ?? '')
  const [notes, setNotes] = useState(company?.notes ?? '')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) return
    onSave({ companyName, contactPerson, phone, email, billingAddress, notes })
  }

  return (
    <Dialog open onClose={onClose} title={company ? t('companies.editCompanyTitle') : t('companies.addCompanyTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('companies.companyNameLabel')} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        <Input label={t('companies.contactPersonLabel')} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        <Input label={t('companies.phoneLabel')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label={t('companies.emailFieldLabel')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label={t('companies.billingAddressLabel')} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
        <Textarea label={t('companies.notesFieldLabel')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <DialogActions onCancel={onClose} confirmType="submit" confirmLabel={company ? t('companies.saveChanges') : t('companies.addCompany')} />
      </form>
    </Dialog>
  )
}
