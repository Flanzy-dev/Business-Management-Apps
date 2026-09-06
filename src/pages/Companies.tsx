import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCompanyStore, Company, Driver } from '../store/companyStore'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { createCompany, updateCompanyLogged, deleteCompanyChecked, deleteDriverChecked } from '../lib/ops/entityOps'
import { filterBySearch } from '../lib/entitySearch'
import { parseNewEntityRequest, workOrderReturnPath } from '../lib/returnTrip'
import { deleteOutcomeToast } from '../lib/deleteOutcome'
import { useExpandOrEdit } from '../lib/rowInteraction'
import { useTranslation } from '../lib/i18n'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { CompanyModal } from '../components/companies/CompanyModal'
import { DriverModal } from '../components/companies/DriverModal'
import { CompanyRow } from '../components/companies/CompanyRow'

export default function Companies() {
  const { t } = useTranslation()
  const companies = useCompanyStore((s) => s.companies)
  const addDriver = useCompanyStore((s) => s.addDriver)
  const updateDriver = useCompanyStore((s) => s.updateDriver)
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

  const filteredCompanies = filterBySearch(companies, search, (c) => [c.companyName, c.phone, c.contactPerson])

  const handleAdd = () => {
    setEditingCompany(null)
    setIsModalOpen(true)
  }

  // Auto-open the add form when arriving via ?new=1 (e.g. from the new-order dialog).
  useEffect(() => {
    const request = parseNewEntityRequest(searchParams)
    const driverRequest = parseNewEntityRequest(searchParams, { param: 'newDriver' })
    if (request.open) {
      setReturnToOrder(request.shouldReturn)
      handleAdd()
      setSearchParams({}, { replace: true })
    } else if (driverRequest.open) {
      const companyId = searchParams.get('companyId')
      if (companyId) {
        setDriverReturnToOrder(driverRequest.shouldReturn)
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
        // The activity-log entry is written by deleteCompanyChecked — see
        // Customers.tsx's handleDelete and src/lib/ops/activityOps.ts.
        const result = deleteCompanyChecked(id)
        const toast = deleteOutcomeToast(result, {
          cannotDeleteTitle: t('companies.cannotDeleteTitle'),
          deletedTitle: t('companies.deletedToast'),
        })
        if (toast) showToast(toast)
      }
    )
  }

  const handleSave = (data: Omit<Company, 'id' | 'createdAt' | 'drivers'>) => {
    if (editingCompany) {
      // Store write + activity log as one step — see src/lib/ops/entityOps.ts.
      updateCompanyLogged(editingCompany.id, data)
    } else {
      const created = createCompany(data)
      if (returnToOrder) {
        setReturnToOrder(false)
        setIsModalOpen(false)
        navigate(workOrderReturnPath('company', created.id))
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

  // Triggered from the row's action menu — expand the card so the newly added
  // driver is visible in the drivers table once the dialog closes.
  const handleAddDriverFromRow = (companyId: string) => {
    setExpandedCompany(companyId)
    handleAddDriver(companyId)
  }

  const handleEditDriver = (companyId: string, driver: Driver) => {
    setDriverCompanyId(companyId)
    setEditingDriver(driver)
    setIsDriverModalOpen(true)
  }

  const handleDeleteDriver = (companyId: string, driverId: string) => {
    requestConfirm(
      { title: t('companies.deleteDriverConfirmTitle'), message: t('companies.deleteDriverConfirmMessage') },
      () => {
        // A work order can name a driver (WorkOrder.driverId), so this goes
        // through the same checked-delete shape as every other referenced
        // entity — see deletionPolicy.ts's driverDeletionBlocker.
        const result = deleteDriverChecked(companyId, driverId)
        const toast = deleteOutcomeToast(result, { cannotDeleteTitle: t('companies.cannotDeleteDriverTitle') })
        if (toast) showToast(toast)
      }
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
          navigate(workOrderReturnPath('company', driverCompanyId, { driverId: created.id }))
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
            <CompanyRow
              key={company.id}
              company={company}
              expanded={expandedCompany === company.id}
              rowHandlers={rowHandlers(company.id, () => setExpandedCompany(expandedCompany === company.id ? null : company.id), () => handleEdit(company))}
              onEdit={() => handleEdit(company)}
              onDelete={() => handleDelete(company.id)}
              onAddDriver={() => handleAddDriverFromRow(company.id)}
              onEditDriver={(driver) => handleEditDriver(company.id, driver)}
              onDeleteDriver={(driverId) => handleDeleteDriver(company.id, driverId)}
            />
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
