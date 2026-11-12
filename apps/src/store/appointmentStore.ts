import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getStorageAdapter } from '../lib/storage/storageAdapter'
import { newId } from '../lib/format/id'
import { touchById, removeById } from './entityHelpers'

export interface Appointment {
  id: string
  vehicleId: string | null
  customerId: string | null
  companyId: string | null
  scheduledAt: string
  duration: number
  serviceType: string | null
  isWalkIn: boolean
  status: 'scheduled' | 'arrived' | 'in-progress' | 'completed' | 'cancelled' | 'no-show'
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface AppointmentStore {
  appointments: Appointment[]
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) => Appointment
  updateAppointment: (id: string, updates: Partial<Appointment>) => void
  deleteAppointment: (id: string) => void
  /** Re-point every appointment on any of `fromIds` to `toId`, in one set() — a vehicle merge. */
  reassignVehicle: (fromIds: string[], toId: string) => void
  setStatus: (id: string, status: Appointment['status']) => void
  getAppointmentsForDate: (date: Date) => Appointment[]
  getWalkIns: () => Appointment[]
  getScheduled: () => Appointment[]
}

export const useAppointmentStore = create<AppointmentStore>()(
  persist(
    (set, get) => ({
      appointments: [],

      addAppointment: (appointmentData) => {
        const appointment: Appointment = {
          ...appointmentData,
          id: newId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({ appointments: [...state.appointments, appointment] }))
        return appointment
      },

      updateAppointment: (id, updates) => {
        set((state) => ({ appointments: touchById(state.appointments, id, updates) }))
      },

      deleteAppointment: (id) => {
        set((state) => ({ appointments: removeById(state.appointments, id) }))
      },

      reassignVehicle: (fromIds, toId) => {
        const from = new Set(fromIds)
        const now = new Date().toISOString()
        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.vehicleId !== null && from.has(a.vehicleId) ? { ...a, vehicleId: toId, updatedAt: now } : a
          ),
        }))
      },

      setStatus: (id, status) => {
        set((state) => ({ appointments: touchById(state.appointments, id, { status }) }))
      },

      getAppointmentsForDate: (date) => {
        const dateStr = date.toDateString()
        return get().appointments.filter(
          (a) => new Date(a.scheduledAt).toDateString() === dateStr
        )
      },

      getWalkIns: () => {
        return get().appointments.filter(
          (a) => a.isWalkIn && !['completed', 'cancelled', 'no-show'].includes(a.status)
        )
      },

      getScheduled: () => {
        return get().appointments.filter(
          (a) => !a.isWalkIn && !['completed', 'cancelled', 'no-show'].includes(a.status)
        )
      },
    }),
    {
      name: 'appointment-storage',
      storage: createJSONStorage(getStorageAdapter),
    }
  )
)
