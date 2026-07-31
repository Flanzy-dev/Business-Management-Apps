import { useState } from 'react'
import { History, Search, Car, Wrench, User } from 'lucide-react'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useWorkerStore } from '../store/workerStore'
import { formatCurrency } from '../lib/currency'
import { formatDistance } from '../lib/units'
import { formatDate } from '../lib/dates'
import { ownerName, workerName } from '../lib/entities'

export default function ServiceHistory() {
  const { vehicles } = useVehicleStore()
  const { workOrders } = useWorkOrderStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { workers } = useWorkerStore()
  const [search, setSearch] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [filterOilOnly, setFilterOilOnly] = useState(false)

  const matchingVehicles = search.length >= 2
    ? vehicles.filter(v => {
        const q = search.toLowerCase()
        return (
          v.licensePlate?.toLowerCase().includes(q) ||
          v.vin?.toLowerCase().includes(q) ||
          `${v.make} ${v.model}`.toLowerCase().includes(q)
        )
      })
    : []

  const selectedVehicle = selectedVehicleId ? vehicles.find(v => v.id === selectedVehicleId) : null

  const vehicleHistory = selectedVehicleId
    ? workOrders
        .filter(wo => wo.vehicleId === selectedVehicleId && wo.status === 'completed')
        .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
    : []

  const getOwnerName = (vehicle: typeof vehicles[0]) => ownerName(vehicle, customers, companies)
  const getWorkerName = (workerId: string | null) => workerName(workerId, workers)

  const totalSpent = vehicleHistory.reduce((sum, wo) => sum + wo.total, 0)
  const totalVisits = vehicleHistory.length

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Service History</h1>
          <p className="text-caption">Look up past services by vehicle</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-surface-card rounded-radius-md p-6 mb-6">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Search by License Plate or VIN
        </label>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedVehicleId(null)
            }}
            placeholder="Enter plate number or VIN..."
            className="w-full max-w-md pl-10 pr-4 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary placeholder-text-secondary font-mono focus:outline-none focus:border-accent"
          />
        </div>

        {/* Search Results */}
        {search.length >= 2 && !selectedVehicleId && (
          <div className="mt-4">
            {matchingVehicles.length === 0 ? (
              <p className="text-text-secondary text-sm">No vehicles found matching "{search}"</p>
            ) : (
              <div className="space-y-2">
                <p className="text-caption mb-2">{matchingVehicles.length} vehicle(s) found:</p>
                {matchingVehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVehicleId(v.id)
                      setSearch('')
                    }}
                    className="w-full flex items-center gap-4 p-3 bg-surface-sunken rounded-radius-sm text-left hover:border-accent border border-transparent transition-colors"
                  >
                    <Car size={20} className="text-text-secondary" />
                    <div className="flex-1">
                      <div className="text-text-primary font-medium">
                        {v.year} {v.make} {v.model}
                      </div>
                      <div className="text-caption">
                        <span className="font-mono">{v.licensePlate || 'No plate'}</span>
                        {v.vin && <span className="ml-3 font-mono">VIN: {v.vin}</span>}
                      </div>
                    </div>
                    <span className="text-text-secondary text-sm">{getOwnerName(v)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Vehicle */}
      {selectedVehicle && (
        <>
          {/* Vehicle Info Card */}
          <div className="bg-surface-card rounded-radius-md p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-radius-sm bg-accent/20 flex items-center justify-center">
                  <Car size={24} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">
                    {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                  </h2>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-text-secondary font-mono">{selectedVehicle.licensePlate || 'No plate'}</span>
                    {selectedVehicle.vin && (
                      <span className="text-caption font-mono">VIN: {selectedVehicle.vin}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <User size={14} className="text-text-secondary" />
                    <span className="text-text-secondary text-sm">{getOwnerName(selectedVehicle)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedVehicleId(null)}
                className="text-text-secondary hover:text-text-primary text-sm"
              >
                Clear
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border-subtle">
              <div>
                <p className="text-caption">Total Visits</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{totalVisits}</p>
              </div>
              <div>
                <p className="text-caption">Total Spent</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(totalSpent)}</p>
              </div>
              <div>
                <p className="text-caption">Current Mileage</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">
                  {selectedVehicle.currentMileage ? formatDistance(selectedVehicle.currentMileage) : '-'}
                </p>
              </div>
            </div>

            {/* Vehicle Specs */}
            {(selectedVehicle.oilTypeRequired || selectedVehicle.engineSize) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border-subtle">
                {selectedVehicle.oilTypeRequired && (
                  <div>
                    <p className="text-caption">Oil Type</p>
                    <p className="text-text-primary text-sm">{selectedVehicle.oilTypeRequired}</p>
                  </div>
                )}
                {selectedVehicle.oilCapacity && (
                  <div>
                    <p className="text-caption">Oil Capacity</p>
                    <p className="text-text-primary text-sm">{selectedVehicle.oilCapacity}</p>
                  </div>
                )}
                {selectedVehicle.engineSize && (
                  <div>
                    <p className="text-caption">Engine</p>
                    <p className="text-text-primary text-sm">{selectedVehicle.engineSize}</p>
                  </div>
                )}
                {selectedVehicle.transmissionType && (
                  <div>
                    <p className="text-caption">Transmission</p>
                    <p className="text-text-primary text-sm">{selectedVehicle.transmissionType}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service History */}
          <div className="bg-surface-card rounded-radius-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History size={20} className="text-accent" />
                <h3 className="text-card-title text-text-primary">Service Timeline</h3>
              </div>
              <label className="flex items-center text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={filterOilOnly}
                  onChange={(e) => setFilterOilOnly(e.target.checked)}
                  className="mr-2"
                />
                Oil changes only
              </label>
            </div>

            {vehicleHistory.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <History size={48} className="mx-auto mb-4 opacity-50" />
                <p>No service history found for this vehicle</p>
              </div>
            ) : (
              <div className="space-y-4">
                {vehicleHistory.map((wo, index) => (
                  <div
                    key={wo.id}
                    className="flex gap-4 pb-4 border-b border-border-subtle last:border-0 last:pb-0"
                  >
                    {/* Timeline Dot */}
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-accent" />
                      {index < vehicleHistory.length - 1 && (
                        <div className="w-px flex-1 bg-border-subtle mt-2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-text-primary font-mono text-sm">#{wo.orderNumber}</span>
                          <span className="text-text-secondary text-sm tabular-nums">
                            {formatDate(wo.completedAt || wo.createdAt)}
                          </span>
                        </div>
                        <span className="text-text-primary font-medium tabular-nums">
                          {formatCurrency(wo.total)}
                        </span>
                      </div>

                      {/* Services */}
                      <div className="space-y-1">
                        {wo.items.map(item => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <Wrench size={12} className="text-text-secondary" />
                            <span className="text-text-secondary">{item.description}</span>
                            <span className="text-caption">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-2 text-caption">
                        <span>Mileage: {wo.mileageIn ? formatDistance(wo.mileageIn) : '-'}</span>
                        <span>Tech: {getWorkerName(wo.workerId)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {!selectedVehicle && search.length < 2 && (
        <div className="bg-surface-card rounded-radius-md p-12 text-center">
          <History size={48} className="mx-auto mb-4 text-text-secondary opacity-50" />
          <h2 className="text-lg font-medium text-text-primary mb-2">Search for a vehicle</h2>
          <p className="text-text-secondary">Enter a license plate or VIN to view service history</p>
        </div>
      )}
    </div>
  )
}
