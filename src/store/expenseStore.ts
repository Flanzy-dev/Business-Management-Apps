import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface Expense {
  id: string
  date: string
  category: string
  description: string
  amount: number // whole Rupiah
  vendor: string
  notes: string
  createdAt: string
  // Set when this expense is tied to a specific inventory product (typically
  // an "Inventory Purchase" expense created from — or linked to — Inventory).
  // quantityAffected is the stock this expense added, kept alongside so
  // deleting the expense can reverse exactly that much (see
  // src/lib/ops/inventoryOps.ts). Additive/optional: older persisted
  // expenses simply lack these keys, read as undefined ~ null everywhere.
  productId: string | null
  quantityAffected: number | null
}

const EXPENSE_CATEGORIES = [
  'Inventory Purchase',
  'Rent',
  'Utilities',
  'Equipment',
  'Payroll',
  'Insurance',
  'Marketing',
  'Supplies',
  'Repairs & Maintenance',
  'Other',
]

interface ExpenseStore {
  expenses: Expense[]
  categories: string[]
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Expense
  updateExpense: (id: string, data: Partial<Expense>) => void
  deleteExpense: (id: string) => void
  getExpense: (id: string) => Expense | undefined
  getExpensesByDateRange: (start: Date, end: Date) => Expense[]
  getExpensesByCategory: (category: string) => Expense[]
  getTotalByCategory: (category: string, start?: Date, end?: Date) => number
}

export const useExpenseStore = create<ExpenseStore>()(
  persist(
    (set, get) => ({
      expenses: [],
      categories: EXPENSE_CATEGORIES,

      addExpense: (data) => {
        const expense = newEntity(data)
        set((state) => ({ expenses: [...state.expenses, expense] }))
        return expense
      },

      updateExpense: (id, data) => {
        set((state) => ({ expenses: updateById(state.expenses, id, data) }))
      },

      deleteExpense: (id) => {
        set((state) => ({ expenses: removeById(state.expenses, id) }))
      },

      getExpense: (id) => {
        return get().expenses.find((e) => e.id === id)
      },

      getExpensesByDateRange: (start, end) => {
        return get().expenses.filter((e) => {
          const date = new Date(e.date)
          return date >= start && date <= end
        })
      },

      getExpensesByCategory: (category) => {
        return get().expenses.filter((e) => e.category === category)
      },

      getTotalByCategory: (category, start, end) => {
        let filtered = get().expenses.filter((e) => e.category === category)
        if (start && end) {
          filtered = filtered.filter((e) => {
            const date = new Date(e.date)
            return date >= start && date <= end
          })
        }
        return filtered.reduce((sum, e) => sum + e.amount, 0)
      },
    }),
    { name: 'expense-store', storage: createJSONStorage(getStorageAdapter) }
  )
)

export { EXPENSE_CATEGORIES }
