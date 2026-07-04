import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { validateVIN, validateLicensePlate, formatVIN, formatLicensePlate } from '../lib/validators'
import { formatDistance } from '../lib/units'
import { ownerName } from '../lib/entities'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Badge } from '../components/ui/Badge'
import { Pencil, Trash2 } from 'lucide-react'

// Distance between services before a vehicle is considered due (DESIGN.md §5.3
// tone semantics: warning="Due soon" / danger="Overdue" / neutral="On track").
// Derived from mileage since vehicles don't store a next-due date directly.
const SERVICE_INTERVAL_KM = 5000
const DUE_SOON_WINDOW_KM = 500

type DueStatus = { label: string; tone: 'warning' | 'danger' | 'neutral' }

function getDueStatus(vehicle: Vehicle, lastServiceMileage: number | null): DueStatus {
  if (!vehicle.currentMileage || lastServiceMileage === null) {
    return { label: 'On track', tone: 'neutral' }
  }
  const remaining = lastServiceMileage + SERVICE_INTERVAL_KM - vehicle.currentMileage
  if (remaining <= 0) return { label: 'Overdue', tone: 'danger' }
  if (remaining <= DUE_SOON_WINDOW_KM) return { label: 'Due soon', tone: 'warning' }
  return { label: 'On track', tone: 'neutral' }
}

export default function Vehicles() {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useVehicleStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { workOrders } = useWorkOrderStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null)
  const [returnToOrder, setReturnToOrder] = useState(false)
  const [newOwnerType, setNewOwnerType] = useState<'customer' | 'company' | null>(null)
  const [newOwnerId, setNewOwnerId] = useState('')

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      v.vin.toLowerCase().includes(search.toLowerCase())
  )

  const getLastServiceMileage = (vehicleId: string): number | null => {
    const completed = workOrders
      .filter(wo => wo.vehicleId === vehicleId && wo.status === 'completed' && wo.mileageIn)
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
    return completed[0]?.mileageIn ?? null
  }

  const getOwnerName = (vehicle: Vehicle) => ownerName(vehicle, customers, companies)

  const handleAdd = () => {
    setEditingVehicle(null)
    setIsModalOpen(true)
  }

  // Auto-open the add form when arriving via ?new=1 (e.g. from the new-order dialog),
  // prefilling the owner passed in the URL so the vehicle is created under it.
  useEffect(() => {
    if (searchParams.get('new')) {
      setReturnToOrder(searchParams.get('fromOrder') === '1')
      const ot = searchParams.get('ownerType')
      setNewOwnerType(ot === 'company' ? 'company' : ot === 'customer' ? 'customer' : null)
      setNewOwnerId(searchParams.get('ownerId') ?? '')
      handleAdd()
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      deleteVehicle(id)
    }
  }

  const handleSave = (data: Omit<Vehicle, 'id' | 'createdAt'>) => {
    if (editingVehicle) {
      updateVehicle(editingVehicle.id, data)
    } else {
      const created = addVehicle(data)
      if (returnToOrder) {
        setReturnToOrder(false)
        setIsModalOpen(false)
        const ot = data.companyId ? 'company' : 'customer'
        const oid = data.companyId ?? data.customerId ?? ''
        navigate(`/work-orders?new=1&ownerType=${ot}&ownerId=${oid}&vehicleId=${created.id}`)
        return
      }
    }
    setIsModalOpen(false)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-page-title text-text-primary">Vehicles</h1>
        <button
          onClick={handleAdd}
          className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
        >
          + Add Vehicle
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by make, model, plate, or VIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent font-mono"
        />
      </div>

      <div className="space-y-3">
        {filteredVehicles.length === 0 ? (
          <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
            {vehicles.length === 0
              ? 'No vehicles yet. Add your first vehicle to get started.'
              : 'No vehicles match your search.'}
          </div>
        ) : (
          filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-surface-card rounded-radius-md overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-surface-sunken transition-colors"
                onClick={() => setExpandedVehicle(expandedVehicle === vehicle.id ? null : vehicle.id)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                      {vehicle.color && <span className="text-text-secondary ml-2">({vehicle.color})</span>}
                    </h3>
                    <Badge tone={getDueStatus(vehicle, getLastServiceMileage(vehicle.id)).tone} dot>
                      {getDueStatus(vehicle, getLastServiceMileage(vehicle.id)).label}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-secondary">
                    {vehicle.licensePlate && <span className="font-mono">Plate: {vehicle.licensePlate}</span>}
                    {vehicle.licensePlate && vehicle.currentMileage && ' • '}
                    {vehicle.currentMileage && <span className="tabular-nums">{formatDistance(vehicle.currentMileage)}</span>}
                    {' • '}
                    <span className="text-accent">{getOwnerName(vehicle)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      items={[
                        { label: 'Edit', icon: Pencil, onClick: () => handleEdit(vehicle) },
                        { label: 'Delete', icon: Trash2, onClick: () => handleDelete(vehicle.id), variant: 'danger' },
                      ]}
                    />
                  </div>
                  <span className="text-text-secondary">{expandedVehicle === vehicle.id ? '▼' : '▶'}</span>
                </div>
              </div>

              {expandedVehicle === vehicle.id && (
                <div className="border-t border-border-subtle p-4 bg-surface-sunken">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">Basic Info</h4>
                      <div className="space-y-1 text-text-secondary">
                        {vehicle.vin && <p>VIN: <span className="font-mono">{vehicle.vin}</span></p>}
                        {vehicle.licensePlate && <p>Plate: <span className="font-mono">{vehicle.licensePlate}</span></p>}
                        {vehicle.currentMileage && <p>Mileage: <span className="tabular-nums">{formatDistance(vehicle.currentMileage)}</span></p>}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-text-primary mb-2">Engine</h4>
                      <div className="space-y-1 text-text-secondary">
                        {vehicle.engineType && <p>Type: {vehicle.engineType}</p>}
                        {vehicle.engineSize && <p>Size: {vehicle.engineSize}</p>}
                        {vehicle.oilTypeRequired && <p>Oil: {vehicle.oilTypeRequired}</p>}
                        {vehicle.oilCapacity && <p>Capacity: {vehicle.oilCapacity}</p>}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-text-primary mb-2">Transmission</h4>
                      <div className="space-y-1 text-text-secondary">
                        {vehicle.transmissionType && <p>Type: {vehicle.transmissionType}</p>}
                        {vehicle.transmissionFluidType && <p>Fluid: {vehicle.transmissionFluidType}</p>}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-text-primary mb-2">Gardan / Differential</h4>
                      <div className="space-y-1 text-text-secondary">
                        {vehicle.driveType && <p>Drive: {vehicle.driveType}</p>}
                        {vehicle.differentialFluidType && <p>Fluid: {vehicle.differentialFluidType}</p>}
                      </div>
                    </div>

                    {vehicle.notes && (
                      <div className="md:col-span-2">
                        <h4 className="font-medium text-text-primary mb-2">Notes</h4>
                        <p className="text-text-secondary">{vehicle.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <VehicleModal
          vehicle={editingVehicle}
          customers={customers}
          companies={companies}
          initialOwnerType={newOwnerType ?? undefined}
          initialCustomerId={newOwnerType === 'customer' ? newOwnerId : ''}
          initialCompanyId={newOwnerType === 'company' ? newOwnerId : ''}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}

function VehicleModal({
  vehicle,
  customers,
  companies,
  initialOwnerType,
  initialCustomerId,
  initialCompanyId,
  onSave,
  onClose,
}: {
  vehicle: Vehicle | null
  customers: { id: string; name: string }[]
  companies: { id: string; companyName: string }[]
  initialOwnerType?: 'customer' | 'company'
  initialCustomerId?: string
  initialCompanyId?: string
  onSave: (data: Omit<Vehicle, 'id' | 'createdAt'>) => void
  onClose: () => void
}) {
  const [ownerType, setOwnerType] = useState<'customer' | 'company'>(
    vehicle?.companyId ? 'company' : (initialOwnerType ?? 'customer')
  )
  const [customerId, setCustomerId] = useState(vehicle?.customerId ?? initialCustomerId ?? '')
  const [companyId, setCompanyId] = useState(vehicle?.companyId ?? initialCompanyId ?? '')

  const [make, setMake] = useState(vehicle?.make ?? '')
  const [model, setModel] = useState(vehicle?.model ?? '')
  const [year, setYear] = useState(vehicle?.year?.toString() ?? '')
  const [vin, setVin] = useState(vehicle?.vin ?? '')
  const [vinError, setVinError] = useState<string | undefined>()
  const [licensePlate, setLicensePlate] = useState(vehicle?.licensePlate ?? '')
  const [plateError, setPlateError] = useState<string | undefined>()
  const [color, setColor] = useState(vehicle?.color ?? '')
  const [currentMileage, setCurrentMileage] = useState(vehicle?.currentMileage?.toString() ?? '')

  const [engineType, setEngineType] = useState(vehicle?.engineType ?? '')
  const [engineSize, setEngineSize] = useState(vehicle?.engineSize ?? '')
  const [oilTypeRequired, setOilTypeRequired] = useState(vehicle?.oilTypeRequired ?? '')
  const [oilCapacity, setOilCapacity] = useState(vehicle?.oilCapacity ?? '')

  const [transmissionType, setTransmissionType] = useState(vehicle?.transmissionType ?? '')
  const [transmissionFluidType, setTransmissionFluidType] = useState(vehicle?.transmissionFluidType ?? '')

  const [driveType, setDriveType] = useState(vehicle?.driveType ?? '')
  const [differentialFluidType, setDifferentialFluidType] = useState(vehicle?.differentialFluidType ?? '')

  const [notes, setNotes] = useState(vehicle?.notes ?? '')

  const handleVinChange = (value: string) => {
    const formatted = formatVIN(value)
    setVin(formatted)
    const validation = validateVIN(formatted)
    setVinError(validation.error)
  }

  const handlePlateChange = (value: string) => {
    const formatted = formatLicensePlate(value)
    setLicensePlate(formatted)
    const validation = validateLicensePlate(formatted)
    setPlateError(validation.error)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!make.trim() || !model.trim()) return

    // Check for validation errors
    const vinValidation = validateVIN(vin)
    const plateValidation = validateLicensePlate(licensePlate)
    if (!vinValidation.valid || !plateValidation.valid) {
      setVinError(vinValidation.error)
      setPlateError(plateValidation.error)
      return
    }

    onSave({
      customerId: ownerType === 'customer' ? customerId || null : null,
      companyId: ownerType === 'company' ? companyId || null : null,
      make,
      model,
      year: year ? parseInt(year) : null,
      vin,
      licensePlate,
      color,
      currentMileage: currentMileage ? parseInt(currentMileage) : null,
      engineType,
      engineSize,
      oilTypeRequired,
      oilCapacity,
      transmissionType,
      transmissionFluidType,
      driveType,
      differentialFluidType,
      notes,
    })
  }

  const inputClass = "w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
  const labelClass = "block text-sm text-text-secondary mb-1"

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
      <div className="bg-surface-card rounded-radius-md w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          {vehicle ? 'Edit Vehicle' : 'Add Vehicle'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto flex-1 pr-2">
          <div className="bg-surface-sunken p-4 rounded-radius-sm">
            <label className="block text-sm font-medium text-text-primary mb-2">Owner</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center text-text-secondary cursor-pointer">
                <input
                  type="radio"
                  checked={ownerType === 'customer'}
                  onChange={() => setOwnerType('customer')}
                  className="mr-2 accent-accent"
                />
                Individual Customer
              </label>
              <label className="flex items-center text-text-secondary cursor-pointer">
                <input
                  type="radio"
                  checked={ownerType === 'company'}
                  onChange={() => setOwnerType('company')}
                  className="mr-2 accent-accent"
                />
                Company / Fleet
              </label>
            </div>
            {ownerType === 'customer' ? (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className={inputClass}
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={inputClass}
              >
                <option value="">-- Select Company --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Make *</label>
                <input type="text" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}>Model *</label>
                <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Camry" className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}>Year</label>
                <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Color</label>
                <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Silver" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>License Plate</label>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={(e) => handlePlateChange(e.target.value)}
                  placeholder="ABC-1234"
                  className={`${inputClass} font-mono ${plateError ? 'border-danger' : ''}`}
                />
                {plateError && (
                  <p className="text-xs text-danger mt-1">{plateError}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>VIN</label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => handleVinChange(e.target.value)}
                  placeholder="1HGBH41JXMN109186"
                  className={`${inputClass} font-mono ${vinError ? 'border-danger' : ''}`}
                />
                {vinError && (
                  <p className="text-xs text-danger mt-1">{vinError}</p>
                )}
                {!vinError && vin && vin.length < 17 && (
                  <p className="text-xs text-text-secondary mt-1">{vin.length}/17 characters</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Current Mileage</label>
                <input type="number" value={currentMileage} onChange={(e) => setCurrentMileage(e.target.value)} placeholder="50000" className={`${inputClass} tabular-nums`} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Engine</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Engine Type</label>
                <input type="text" value={engineType} onChange={(e) => setEngineType(e.target.value)} placeholder="Gasoline, Diesel, Hybrid" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Engine Size</label>
                <input type="text" value={engineSize} onChange={(e) => setEngineSize(e.target.value)} placeholder="2.5L, V6" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Oil Type Required</label>
                <input type="text" value={oilTypeRequired} onChange={(e) => setOilTypeRequired(e.target.value)} placeholder="5W-30, 0W-20" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Oil Capacity</label>
                <input type="text" value={oilCapacity} onChange={(e) => setOilCapacity(e.target.value)} placeholder="4.5 L" className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Transmission</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Transmission Type</label>
                <select value={transmissionType} onChange={(e) => setTransmissionType(e.target.value)} className={inputClass}>
                  <option value="">-- Select --</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                  <option value="CVT">CVT</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Transmission Fluid Type</label>
                <input type="text" value={transmissionFluidType} onChange={(e) => setTransmissionFluidType(e.target.value)} placeholder="ATF Type T-IV" className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Gardan / Differential</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Drive Type</label>
                <select value={driveType} onChange={(e) => setDriveType(e.target.value)} className={inputClass}>
                  <option value="">-- Select --</option>
                  <option value="FWD">FWD (Front-Wheel Drive)</option>
                  <option value="RWD">RWD (Rear-Wheel Drive)</option>
                  <option value="AWD">AWD (All-Wheel Drive)</option>
                  <option value="4WD">4WD (Four-Wheel Drive)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Differential Fluid Type</label>
                <input type="text" value={differentialFluidType} onChange={(e) => setDifferentialFluidType(e.target.value)} placeholder="75W-90" className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
            <button type="button" onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary">
              Cancel
            </button>
            <button
              type="submit"
              className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
            >
              {vehicle ? 'Save Changes' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
