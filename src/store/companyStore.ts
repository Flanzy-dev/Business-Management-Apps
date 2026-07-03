import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
        const company: Company = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          drivers: [],
        }
        set((state) => ({ companies: [...state.companies, company] }))
        return company
      },

      updateCompany: (id, data) => {
        set((state) => ({
          companies: state.companies.map((c) =>
            c.id === id ? { ...c, ...data } : c
          ),
        }))
      },

      deleteCompany: (id) => {
        set((state) => ({
          companies: state.companies.filter((c) => c.id !== id),
        }))
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
              ? {
                  ...c,
                  drivers: c.drivers.map((d) =>
                    d.id === driverId ? { ...d, ...data } : d
                  ),
                }
              : c
          ),
        }))
      },

      deleteDriver: (companyId, driverId) => {
        set((state) => ({
          companies: state.companies.map((c) =>
            c.id === companyId
              ? { ...c, drivers: c.drivers.filter((d) => d.id !== driverId) }
              : c
          ),
        }))
      },
    }),
    { name: 'company-store' }
  )
)
