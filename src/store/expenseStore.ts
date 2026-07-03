import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Expense {
  id: string
  date: string
  category: string
  description: string
  amount: number // cents
  vendor: string
  notes: string
  createdAt: string
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
        const expense: Expense = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ expenses: [...state.expenses, expense] }))
        return expense
      },

      updateExpense: (id, data) => {
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id ? { ...e, ...data } : e
          ),
        }))
      },

      deleteExpense: (id) => {
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        }))
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
    { name: 'expense-store' }
  )
)

export { EXPENSE_CATEGORIES }
