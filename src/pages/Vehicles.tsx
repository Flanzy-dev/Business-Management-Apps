import { useState } from 'react'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { validateVIN, validateLicensePlate, formatVIN, formatLicensePlate } from '../lib/validators'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2 } from 'lucide-react'

export default function Vehicles() {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useVehicleStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null)

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      v.vin.toLowerCase().includes(search.toLowerCase())
  )

  const getOwnerName = (vehicle: Vehicle) => {
    if (vehicle.customerId) {
      const customer = customers.find((c) => c.id === vehicle.customerId)
      return customer?.name || 'Unknown Customer'
    }
    if (vehicle.companyId) {
      const company = companies.find((c) => c.id === vehicle.companyId)
      return company?.companyName || 'Unknown Company'
    }
    return 'No Owner'
  }

  const handleAdd = () => {
    setEditingVehicle(null)
    setIsModalOpen(true)
  }

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
      addVehicle(data)
    }
    setIsModalOpen(false)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-page-title text-text-primary">Vehicles</h1>
        <button
          onClick={handleAdd}
          className="bg-accent-mint text-surface-canvas px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
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
          className="w-full max-w-md px-4 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-mint font-mono"
        />
      </div>

      <div className="space-y-3">
        {filteredVehicles.length === 0 ? (
          <div className="bg-surface-card rounded-card p-8 text-center text-text-secondary">
            {vehicles.length === 0
              ? 'No vehicles yet. Add your first vehicle to get started.'
              : 'No vehicles match your search.'}
          </div>
        ) : (
          filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-surface-card rounded-card overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-surface-sunken transition-colors"
                onClick={() => setExpandedVehicle(expandedVehicle === vehicle.id ? null : vehicle.id)}
              >
                <div>
                  <h3 className="font-semibold text-text-primary">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                    {vehicle.color && <span className="text-text-secondary ml-2">({vehicle.color})</span>}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {vehicle.licensePlate && <span className="font-mono">Plate: {vehicle.licensePlate}</span>}
                    {vehicle.licensePlate && vehicle.currentMileage && ' • '}
                    {vehicle.currentMileage && <span className="tabular-nums">{vehicle.currentMileage.toLocaleString()} mi</span>}
                    {' • '}
                    <span className="text-accent-mint">{getOwnerName(vehicle)}</span>
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
                        {vehicle.currentMileage && <p>Mileage: <span className="tabular-nums">{vehicle.currentMileage.toLocaleString()}</span> mi</p>}
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
  onSave,
  onClose,
}: {
  vehicle: Vehicle | null
  customers: { id: string; name: string }[]
  companies: { id: string; companyName: string }[]
  onSave: (data: Omit<Vehicle, 'id' | 'createdAt'>) => void
  onClose: () => void
}) {
  const [ownerType, setOwnerType] = useState<'customer' | 'company'>(
    vehicle?.companyId ? 'company' : 'customer'
  )
  const [customerId, setCustomerId] = useState(vehicle?.customerId ?? '')
  const [companyId, setCompanyId] = useState(vehicle?.companyId ?? '')

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

  const inputClass = "w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-primary focus:outline-none focus:border-accent-mint"
  const labelClass = "block text-sm text-text-secondary mb-1"

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card rounded-card w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          {vehicle ? 'Edit Vehicle' : 'Add Vehicle'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto flex-1 pr-2">
          <div className="bg-surface-sunken p-4 rounded-tile">
            <label className="block text-sm font-medium text-text-primary mb-2">Owner</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center text-text-secondary cursor-pointer">
                <input
                  type="radio"
                  checked={ownerType === 'customer'}
                  onChange={() => setOwnerType('customer')}
                  className="mr-2 accent-accent-mint"
                />
                Individual Customer
              </label>
              <label className="flex items-center text-text-secondary cursor-pointer">
                <input
                  type="radio"
                  checked={ownerType === 'company'}
                  onChange={() => setOwnerType('company')}
                  className="mr-2 accent-accent-mint"
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
                  className={`${inputClass} font-mono ${plateError ? 'border-accent-critical' : ''}`}
                />
                {plateError && (
                  <p className="text-xs text-accent-critical mt-1">{plateError}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>VIN</label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => handleVinChange(e.target.value)}
                  placeholder="1HGBH41JXMN109186"
                  className={`${inputClass} font-mono ${vinError ? 'border-accent-critical' : ''}`}
                />
                {vinError && (
                  <p className="text-xs text-accent-critical mt-1">{vinError}</p>
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
                <input type="text" value={oilCapacity} onChange={(e) => setOilCapacity(e.target.value)} placeholder="5 quarts" className={inputClass} />
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
              className="bg-accent-mint text-surface-canvas px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
            >
              {vehicle ? 'Save Changes' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
