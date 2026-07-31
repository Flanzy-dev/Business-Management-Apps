import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
  createdAt: string
}

interface CustomerStore {
  customers: Customer[]
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer
  updateCustomer: (id: string, data: Partial<Customer>) => void
  deleteCustomer: (id: string) => void
  getCustomer: (id: string) => Customer | undefined
}

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set, get) => ({
      customers: [],

      addCustomer: (data) => {
        const customer = newEntity(data)
        set((state) => ({ customers: [...state.customers, customer] }))
        return customer
      },

      updateCustomer: (id, data) => {
        set((state) => ({ customers: updateById(state.customers, id, data) }))
      },

      deleteCustomer: (id) => {
        set((state) => ({ customers: removeById(state.customers, id) }))
      },

      getCustomer: (id) => {
        return get().customers.find((c) => c.id === id)
      },
    }),
    { name: 'customer-store' }
  )
)
