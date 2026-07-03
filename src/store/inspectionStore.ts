import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type InspectionStatus = 'pass' | 'fail' | 'attention' | 'not-checked'

export interface InspectionItem {
  id: string
  category: string
  name: string
  status: InspectionStatus
  notes: string
  photoBase64?: string
}

export interface Inspection {
  id: string
  workOrderId: string
  vehicleId: string
  technicianId: string | null
  createdAt: string
  updatedAt: string
  items: InspectionItem[]
  completed: boolean
}

// Standard multi-point inspection template
export const INSPECTION_TEMPLATE: Omit<InspectionItem, 'id'>[] = [
  // Tires & Brakes
  { category: 'Tires & Brakes', name: 'Front Left Tire Tread', status: 'not-checked', notes: '' },
  { category: 'Tires & Brakes', name: 'Front Right Tire Tread', status: 'not-checked', notes: '' },
  { category: 'Tires & Brakes', name: 'Rear Left Tire Tread', status: 'not-checked', notes: '' },
  { category: 'Tires & Brakes', name: 'Rear Right Tire Tread', status: 'not-checked', notes: '' },
  { category: 'Tires & Brakes', name: 'Tire Pressure', status: 'not-checked', notes: '' },
  { category: 'Tires & Brakes', name: 'Front Brake Pads', status: 'not-checked', notes: '' },
  { category: 'Tires & Brakes', name: 'Rear Brake Pads', status: 'not-checked', notes: '' },
  { category: 'Tires & Brakes', name: 'Brake Fluid Level', status: 'not-checked', notes: '' },

  // Fluids
  { category: 'Fluids', name: 'Engine Oil Level', status: 'not-checked', notes: '' },
  { category: 'Fluids', name: 'Coolant Level', status: 'not-checked', notes: '' },
  { category: 'Fluids', name: 'Power Steering Fluid', status: 'not-checked', notes: '' },
  { category: 'Fluids', name: 'Windshield Washer Fluid', status: 'not-checked', notes: '' },
  { category: 'Fluids', name: 'Transmission Fluid', status: 'not-checked', notes: '' },

  // Engine & Belts
  { category: 'Engine & Belts', name: 'Serpentine Belt', status: 'not-checked', notes: '' },
  { category: 'Engine & Belts', name: 'Timing Belt (if visible)', status: 'not-checked', notes: '' },
  { category: 'Engine & Belts', name: 'Hoses Condition', status: 'not-checked', notes: '' },
  { category: 'Engine & Belts', name: 'Air Filter', status: 'not-checked', notes: '' },
  { category: 'Engine & Belts', name: 'Cabin Air Filter', status: 'not-checked', notes: '' },

  // Electrical & Lights
  { category: 'Electrical & Lights', name: 'Battery Condition', status: 'not-checked', notes: '' },
  { category: 'Electrical & Lights', name: 'Battery Terminals', status: 'not-checked', notes: '' },
  { category: 'Electrical & Lights', name: 'Headlights', status: 'not-checked', notes: '' },
  { category: 'Electrical & Lights', name: 'Tail Lights', status: 'not-checked', notes: '' },
  { category: 'Electrical & Lights', name: 'Brake Lights', status: 'not-checked', notes: '' },
  { category: 'Electrical & Lights', name: 'Turn Signals', status: 'not-checked', notes: '' },

  // Wipers & Visibility
  { category: 'Wipers & Visibility', name: 'Front Wiper Blades', status: 'not-checked', notes: '' },
  { category: 'Wipers & Visibility', name: 'Rear Wiper Blade', status: 'not-checked', notes: '' },
  { category: 'Wipers & Visibility', name: 'Windshield Condition', status: 'not-checked', notes: '' },

  // Under Vehicle
  { category: 'Under Vehicle', name: 'Oil Leaks', status: 'not-checked', notes: '' },
  { category: 'Under Vehicle', name: 'Coolant Leaks', status: 'not-checked', notes: '' },
  { category: 'Under Vehicle', name: 'Exhaust System', status: 'not-checked', notes: '' },
  { category: 'Under Vehicle', name: 'Suspension Components', status: 'not-checked', notes: '' },
]

interface InspectionState {
  inspections: Inspection[]
  addInspection: (workOrderId: string, vehicleId: string, technicianId: string | null) => Inspection
  updateInspectionItem: (inspectionId: string, itemId: string, updates: Partial<InspectionItem>) => void
  completeInspection: (inspectionId: string) => void
  getInspectionByWorkOrder: (workOrderId: string) => Inspection | undefined
  getInspectionsByVehicle: (vehicleId: string) => Inspection[]
  deleteInspection: (id: string) => void
}

export const useInspectionStore = create<InspectionState>()(
  persist(
    (set, get) => ({
      inspections: [],

      addInspection: (workOrderId, vehicleId, technicianId) => {
        const now = new Date().toISOString()
        const inspection: Inspection = {
          id: crypto.randomUUID(),
          workOrderId,
          vehicleId,
          technicianId,
          createdAt: now,
          updatedAt: now,
          completed: false,
          items: INSPECTION_TEMPLATE.map(item => ({
            ...item,
            id: crypto.randomUUID(),
          })),
        }
        set(state => ({ inspections: [...state.inspections, inspection] }))
        return inspection
      },

      updateInspectionItem: (inspectionId, itemId, updates) => {
        set(state => ({
          inspections: state.inspections.map(insp =>
            insp.id === inspectionId
              ? {
                  ...insp,
                  updatedAt: new Date().toISOString(),
                  items: insp.items.map(item =>
                    item.id === itemId ? { ...item, ...updates } : item
                  ),
                }
              : insp
          ),
        }))
      },

      completeInspection: (inspectionId) => {
        set(state => ({
          inspections: state.inspections.map(insp =>
            insp.id === inspectionId
              ? { ...insp, completed: true, updatedAt: new Date().toISOString() }
              : insp
          ),
        }))
      },

      getInspectionByWorkOrder: (workOrderId) => {
        return get().inspections.find(i => i.workOrderId === workOrderId)
      },

      getInspectionsByVehicle: (vehicleId) => {
        return get().inspections.filter(i => i.vehicleId === vehicleId)
      },

      deleteInspection: (id) => {
        set(state => ({
          inspections: state.inspections.filter(i => i.id !== id),
        }))
      },
    }),
    {
      name: 'inspection-store',
    }
  )
)
