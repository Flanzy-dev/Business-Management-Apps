import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'

export interface Driver {
  id: string
  companyId: string
  name: string
  phone: string
  employeeId: string
  notes: string
}

export interface Company {
  id: string
  companyName: string
  contactPerson: string
  phone: string
  email: string
  billingAddress: string
  notes: string
  createdAt: string
  drivers: Driver[]
}

interface CompanyStore {
  companies: Company[]
  addCompany: (company: Omit<Company, 'id' | 'createdAt' | 'drivers'>) => Company
  updateCompany: (id: string, data: Partial<Company>) => void
  deleteCompany: (id: string) => void
  getCompany: (id: string) => Company | undefined
  addDriver: (companyId: string, driver: Omit<Driver, 'id' | 'companyId'>) => Driver
  updateDriver: (companyId: string, driverId: string, data: Partial<Driver>) => void
  deleteDriver: (companyId: string, driverId: string) => void
}

export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set, get) => ({
      companies: [],

      addCompany: (data) => {
        const company: Company = { ...newEntity(data), drivers: [] }
        set((state) => ({ companies: [...state.companies, company] }))
        return company
      },

      updateCompany: (id, data) => {
        set((state) => ({ companies: updateById(state.companies, id, data) }))
      },

      deleteCompany: (id) => {
        set((state) => ({ companies: removeById(state.companies, id) }))
      },

      getCompany: (id) => {
        return get().companies.find((c) => c.id === id)
      },

      addDriver: (companyId, data) => {
        const driver: Driver = {
          ...data,
          id: crypto.randomUUID(),
          companyId,
        }
        set((state) => ({
          companies: state.companies.map((c) =>
            c.id === companyId
              ? { ...c, drivers: [...c.drivers, driver] }
              : c
          ),
        }))
        return driver
      },

      updateDriver: (companyId, driverId, data) => {
        set((state) => ({
          companies: state.companies.map((c) =>
            c.id === companyId
              ? { ...c, drivers: updateById(c.drivers, driverId, data) }
              : c
          ),
        }))
      },

      deleteDriver: (companyId, driverId) => {
        set((state) => ({
          companies: state.companies.map((c) =>
            c.id === companyId
              ? { ...c, drivers: removeById(c.drivers, driverId) }
              : c
          ),
        }))
      },
    }),
    { name: 'company-store' }
  )
)
