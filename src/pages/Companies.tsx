import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCompanyStore, Company, Driver } from '../store/companyStore'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { deleteCompanyChecked } from '../lib/ops/entityOps'
import { rowEditOnDoubleClick, useExpandOrEdit } from '../lib/rowInteraction'
import { useTranslation } from '../lib/i18n'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Dialog, DialogFooter } from '../components/ui/Dialog'
import { Input, Textarea } from '../components/ui/Input'

export default function Companies() {
  const { t, tc } = useTranslation()
  const companies = useCompanyStore((s) => s.companies)
  const addCompany = useCompanyStore((s) => s.addCompany)
  const updateCompany = useCompanyStore((s) => s.updateCompany)
  const addDriver = useCompanyStore((s) => s.addDriver)
  const updateDriver = useCompanyStore((s) => s.updateDriver)
  const deleteDriver = useCompanyStore((s) => s.deleteDriver)
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [returnToOrder, setReturnToOrder] = useState(false)
  const [driverReturnToOrder, setDriverReturnToOrder] = useState(false)
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [driverCompanyId, setDriverCompanyId] = useState<string | null>(null)
  const rowHandlers = useExpandOrEdit()

  const filteredCompanies = companies.filter(
    (c) =>
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.contactPerson.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = () => {
    setEditingCompany(null)
    setIsModalOpen(true)
  }

  // Auto-open the add form when arriving via ?new=1 (e.g. from the new-order dialog).
  useEffect(() => {
    if (searchParams.get('new')) {
      setReturnToOrder(searchParams.get('fromOrder') === '1')
      handleAdd()
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('newDriver')) {
      const companyId = searchParams.get('companyId')
      if (companyId) {
        setDriverReturnToOrder(searchParams.get('fromOrder') === '1')
        handleAddDriver(companyId)
      }
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  const handleEdit = (company: Company) => {
    setEditingCompany(company)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    requestConfirm(
      { title: t('companies.deleteConfirmTitle'), message: t('companies.deleteConfirmMessage') },
      () => {
        const result = deleteCompanyChecked(id)
        if (!result.ok) {
          showToast({ tone: 'warning', title: t('companies.cannotDeleteTitle'), description: result.reason })
        }
      }
    )
  }

  const handleSave = (data: Omit<Company, 'id' | 'createdAt' | 'drivers'>) => {
    if (editingCompany) {
      updateCompany(editingCompany.id, data)
    } else {
      const created = addCompany(data)
      if (returnToOrder) {
        setReturnToOrder(false)
        setIsModalOpen(false)
        navigate(`/work-orders?new=1&ownerType=company&ownerId=${created.id}`)
        return
      }
    }
    setIsModalOpen(false)
  }

  const handleAddDriver = (companyId: string) => {
    setDriverCompanyId(companyId)
    setEditingDriver(null)
    setIsDriverModalOpen(true)
  }

  const handleEditDriver = (companyId: string, driver: Driver) => {
    setDriverCompanyId(companyId)
    setEditingDriver(driver)
    setIsDriverModalOpen(true)
  }

  const handleDeleteDriver = (companyId: string, driverId: string) => {
    requestConfirm(
      { title: t('companies.deleteDriverConfirmTitle'), message: t('companies.deleteDriverConfirmMessage') },
      () => deleteDriver(companyId, driverId)
    )
  }

  const handleSaveDriver = (data: Omit<Driver, 'id' | 'companyId'>) => {
    if (driverCompanyId) {
      if (editingDriver) {
        updateDriver(driverCompanyId, editingDriver.id, data)
      } else {
        const created = addDriver(driverCompanyId, data)
        if (driverReturnToOrder) {
          setDriverReturnToOrder(false)
          setIsDriverModalOpen(false)
          navigate(`/work-orders?new=1&ownerType=company&ownerId=${driverCompanyId}&driverId=${created.id}`)
          return
        }
      }
    }
    setIsDriverModalOpen(false)
  }

  return (
    <div>
      <PageHeader
        title={t('companies.title')}
        action={
          <Button variant="primary" icon={Plus} onClick={handleAdd}>
            {t('companies.addCompany')}
          </Button>
        }
      />

      <div className="mb-4 max-w-md">
        <Input
          placeholder={t('companies.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filteredCompanies.length === 0 ? (
          <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
            {companies.length === 0 ? t('companies.emptyNone') : t('companies.emptySearch')}
          </div>
        ) : (
          filteredCompanies.map((company) => (
            <div key={company.id} className="bg-surface-card rounded-radius-md overflow-hidden">
              <div
                className="group p-4 flex justify-between items-center cursor-pointer hover:bg-surface-sunken active:bg-bg-4 transition-colors"
                {...rowHandlers(company.id, () => setExpandedCompany(expandedCompany === company.id ? null : company.id), () => handleEdit(company))}
              >
                <div>
                  <h3 className="font-semibold text-text-primary">{company.companyName}</h3>
                  <p className="text-sm text-text-secondary">
                    {company.contactPerson && `${company.contactPerson} • `}
                    {company.phone}
                    {company.drivers.length > 0 && ` • ${tc('companies.driverCount', company.drivers.length)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Pencil
                    size={14}
                    className="text-fg-3 opacity-0 group-hover:opacity-60 transition-opacity"
                    aria-hidden="true"
                  />
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      items={[
                        { label: t('common.edit'), icon: Pencil, onClick: () => handleEdit(company) },
                        { label: t('common.delete'), icon: Trash2, onClick: () => handleDelete(company.id), variant: 'danger' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {expandedCompany === company.id && (
                <div className="border-t border-border-subtle p-4 bg-surface-sunken">
                  <div className="mb-4 text-sm text-text-secondary">
                    {company.email && <p>{t('companies.emailLabel')}: {company.email}</p>}
                    {company.billingAddress && <p>{t('companies.billingLabel')}: {company.billingAddress}</p>}
                    {company.notes && <p>{t('companies.notesLabel')}: {company.notes}</p>}
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-text-primary">{t('companies.driversHeading')}</h4>
                    <button
                      onClick={() => handleAddDriver(company.id)}
                      className="text-sm bg-surface-card text-text-secondary px-3 py-1 rounded-radius-sm hover:text-text-primary border border-border-subtle"
                    >
                      {t('companies.addDriver')}
                    </button>
                  </div>

                  {company.drivers.length === 0 ? (
                    <p className="text-sm text-text-secondary">{t('companies.noDriversYet')}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-text-secondary">
                          <th className="px-3 py-1">{t('companies.colName')}</th>
                          <th className="px-3 py-1">{t('companies.colPhone')}</th>
                          <th className="px-3 py-1">{t('companies.colEmployeeId')}</th>
                          <th className="px-3 py-1 text-right">{t('companies.colActions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {company.drivers.map((driver) => (
                          <tr key={driver.id} {...rowEditOnDoubleClick(() => handleEditDriver(company.id, driver))} className="border-t border-border-subtle">
                            <td className="px-3 py-2 text-text-primary">{driver.name}</td>
                            <td className="px-3 py-2 text-text-secondary">{driver.phone}</td>
                            <td className="px-3 py-2 text-text-secondary font-mono">{driver.employeeId}</td>
                            <td className="px-3 py-2 text-right">
                              <DropdownMenu
                                items={[
                                  { label: t('common.edit'), icon: Pencil, onClick: () => handleEditDriver(company.id, driver) },
                                  { label: t('common.delete'), icon: Trash2, onClick: () => handleDeleteDriver(company.id, driver.id), variant: 'danger' },
                                ]}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <CompanyModal
          company={editingCompany}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {isDriverModalOpen && (
        <DriverModal
          driver={editingDriver}
          onSave={handleSaveDriver}
          onClose={() => setIsDriverModalOpen(false)}
        />
      )}
    </div>
  )
}

function CompanyModal({
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

  const handleSubmit = (e: React.FormEvent) => {
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
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit">
            {company ? t('companies.saveChanges') : t('companies.addCompany')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function DriverModal({
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

  const handleSubmit = (e: React.FormEvent) => {
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
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit">
            {driver ? t('companies.saveChanges') : t('companies.addDriverSubmit')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
