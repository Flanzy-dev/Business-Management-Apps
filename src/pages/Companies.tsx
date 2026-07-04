import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCompanyStore, Company, Driver } from '../store/companyStore'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2 } from 'lucide-react'

export default function Companies() {
  const { companies, addCompany, updateCompany, deleteCompany, addDriver, updateDriver, deleteDriver } = useCompanyStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [returnToOrder, setReturnToOrder] = useState(false)
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [driverCompanyId, setDriverCompanyId] = useState<string | null>(null)

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
    }
  }, [searchParams])

  const handleEdit = (company: Company) => {
    setEditingCompany(company)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this company and all its drivers?')) {
      deleteCompany(id)
    }
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
    if (confirm('Are you sure you want to delete this driver?')) {
      deleteDriver(companyId, driverId)
    }
  }

  const handleSaveDriver = (data: Omit<Driver, 'id' | 'companyId'>) => {
    if (driverCompanyId) {
      if (editingDriver) {
        updateDriver(driverCompanyId, editingDriver.id, data)
      } else {
        addDriver(driverCompanyId, data)
      }
    }
    setIsDriverModalOpen(false)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-page-title text-text-primary">Companies / Fleet Accounts</h1>
        <button
          onClick={handleAdd}
          className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
        >
          + Add Company
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by company name, contact, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-4">
        {filteredCompanies.length === 0 ? (
          <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
            {companies.length === 0
              ? 'No companies yet. Add your first fleet account to get started.'
              : 'No companies match your search.'}
          </div>
        ) : (
          filteredCompanies.map((company) => (
            <div key={company.id} className="bg-surface-card rounded-radius-md overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-surface-sunken transition-colors"
                onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
              >
                <div>
                  <h3 className="font-semibold text-text-primary">{company.companyName}</h3>
                  <p className="text-sm text-text-secondary">
                    {company.contactPerson && `${company.contactPerson} • `}
                    {company.phone}
                    {company.drivers.length > 0 && ` • ${company.drivers.length} driver(s)`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      items={[
                        { label: 'Edit', icon: Pencil, onClick: () => handleEdit(company) },
                        { label: 'Delete', icon: Trash2, onClick: () => handleDelete(company.id), variant: 'danger' },
                      ]}
                    />
                  </div>
                  <span className="text-text-secondary">{expandedCompany === company.id ? '▼' : '▶'}</span>
                </div>
              </div>

              {expandedCompany === company.id && (
                <div className="border-t border-border-subtle p-4 bg-surface-sunken">
                  <div className="mb-4 text-sm text-text-secondary">
                    {company.email && <p>Email: {company.email}</p>}
                    {company.billingAddress && <p>Billing: {company.billingAddress}</p>}
                    {company.notes && <p>Notes: {company.notes}</p>}
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-text-primary">Drivers</h4>
                    <button
                      onClick={() => handleAddDriver(company.id)}
                      className="text-sm bg-surface-card text-text-secondary px-3 py-1 rounded-radius-sm hover:text-text-primary border border-border-subtle"
                    >
                      + Add Driver
                    </button>
                  </div>

                  {company.drivers.length === 0 ? (
                    <p className="text-sm text-text-secondary">No drivers added yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-text-secondary">
                          <th className="py-1">Name</th>
                          <th className="py-1">Phone</th>
                          <th className="py-1">Employee ID</th>
                          <th className="py-1 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {company.drivers.map((driver) => (
                          <tr key={driver.id} className="border-t border-border-subtle">
                            <td className="py-2 text-text-primary">{driver.name}</td>
                            <td className="py-2 text-text-secondary">{driver.phone}</td>
                            <td className="py-2 text-text-secondary font-mono">{driver.employeeId}</td>
                            <td className="py-2 text-right">
                              <DropdownMenu
                                items={[
                                  { label: 'Edit', icon: Pencil, onClick: () => handleEditDriver(company.id, driver) },
                                  { label: 'Delete', icon: Trash2, onClick: () => handleDeleteDriver(company.id, driver.id), variant: 'danger' },
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
  const [companyName, setCompanyName] = useState(company?.companyName ?? '')
  const [contactPerson, setContactPerson] = useState(company?.contactPerson ?? '')
  const [phone, setPhone] = useState(company?.phone ?? '')
  const [email, setEmail] = useState(company?.email ?? '')
  const [billingAddress, setBillingAddress] = useState(company?.billingAddress ?? '')
  const [notes, setNotes] = useState(company?.notes ?? '')

  const inputClass = "w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) return
    onSave({ companyName, contactPerson, phone, email, billingAddress, notes })
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
      <div className="bg-surface-card rounded-radius-md w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          {company ? 'Edit Company' : 'Add Company'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Company Name *</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Contact Person</label>
            <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Billing Address</label>
            <input type="text" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary">
              Cancel
            </button>
            <button
              type="submit"
              className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
            >
              {company ? 'Save Changes' : 'Add Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const [name, setName] = useState(driver?.name ?? '')
  const [phone, setPhone] = useState(driver?.phone ?? '')
  const [employeeId, setEmployeeId] = useState(driver?.employeeId ?? '')
  const [notes, setNotes] = useState(driver?.notes ?? '')

  const inputClass = "w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name, phone, employeeId, notes })
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
      <div className="bg-surface-card rounded-radius-md w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          {driver ? 'Edit Driver' : 'Add Driver'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Employee ID</label>
            <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary">
              Cancel
            </button>
            <button
              type="submit"
              className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
            >
              {driver ? 'Save Changes' : 'Add Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
